import {ContentType, InteractiveMessageType, QuickReplyDisplayStyle} from "../components/Chat/datamodel/Model";
import {INTERACTIVE_MESSAGE} from "../components/Chat/constants";
import * as DOMPurify from 'dompurify';

export function shouldDisplayMessageForType(correntType) {
  let isValid = false;
  for (let key in ContentType.MESSAGE_CONTENT_TYPE) {
    if (ContentType.MESSAGE_CONTENT_TYPE[key] === correntType) {
      isValid = true;
    }
  }
  return isValid;
}

export function getTimeFromTimeStamp(timeStamp) {
  return new Date(timeStamp).getTime();
}

// timestamp is in epoch seconds (matches transportDetails.sentTime)
export function formatTimeDisplay(timestamp) {
  const d = new Date(0);
  d.setUTCSeconds(timestamp);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "numeric" });
}

export function formatDateDisplay(timestamp) {
  const d = new Date(0);
  d.setUTCSeconds(timestamp);
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

export function createInteractiveMessagePayload(
  selectedElement,
  preIndex,
  nextIndex,
  listId,
  templateType,
  referenceId,
  isCarouselElem = false,
  listTitle,
  carouselTemplateId
) {
  if (isCarouselElem) {
    return {
        text: JSON.stringify({
          templateIdentifier: carouselTemplateId,
          listTitle,
          selectionText: selectedElement.title
        })
    }
  }

  const payload = {text: selectedElement.title};
  if (
    selectedElement.actionDetail &&
    (selectedElement.actionDetail === INTERACTIVE_MESSAGE.ACTIONS.SHOW_MORE ||
      selectedElement.actionDetail ===
        INTERACTIVE_MESSAGE.ACTIONS.PREVIOUS_OPTIONS)
  ) {
    const requestBody = {
      version: INTERACTIVE_MESSAGE.VERSION,

      data: {
        actionName: selectedElement.actionDetail,
        preIndex,
        nextIndex,
        listId,
        templateType,
        referenceId,
      },
      action: selectedElement.actionDetail,
    };
    const jsonStr = JSON.stringify(requestBody);
    payload.text = jsonStr;
    payload.type = ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE;
  }
  return payload;
}

// Recognizes only the one shape we repair - our backend's Python
// str(dict)/repr(dict) output, which opens with a single-quoted key, e.g.
// {'templateType': ...}. Anything else that fails JSON.parse (plain chat
// text, corrupted data, etc.) is left alone rather than guessed at.
function isKnownMalformedFormat(str) {
  return /^\s*\{\s*'/.test(str);
}

// Converts that one known malformed shape's quote delimiters into valid
// JSON. Not a blind ' -> " replace - apostrophes can legitimately appear
// inside message text (e.g. "don't"), and Python's repr() already handles
// that by switching a string's own delimiter to " whenever its content
// contains an apostrophe. So this only has to track whichever quote
// character opened the current string and copy through to its matching
// close, decoding \n along the way (the one escape the payload uses for
// its title's embedded line breaks).
function convertKnownMalformedFormatToJSON(input) {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = "";
      i++;
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          value += input[i + 1] === "n" ? "\n" : input[i + 1];
          i += 2;
        } else {
          value += input[i];
          i++;
        }
      }
      i++; // consume closing quote
      out += JSON.stringify(value);
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/**
 * Parses `message.content.data`:
 *
 *   content.data
 *       |
 *       v
 *   JSON.parse()
 *       |
 *   success --> existing renderer
 *       | failure
 *       v
 *   known BE malformed format?
 *       | yes                    | no
 *       v                        v
 *   controlled conversion    existing renderer
 *   -> JSON.parse()          (undefined - falls through to
 *       |                     the existing plain-text path)
 *       v
 *   existing renderer
 *
 * @param {string} data
 * @returns {object|undefined} parsed payload, or undefined if it's neither
 *   valid JSON nor the one recognized malformed shape
 */
export function safeParseInteractiveMessageJSON(data) {
  if (typeof data !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    // fall through - only the recognized malformed shape gets converted
  }
  if (!isKnownMalformedFormat(data)) {
    return undefined;
  }
  try {
    return JSON.parse(convertKnownMalformedFormatToJSON(data));
  } catch (e) {
    return undefined;
  }
}

/**
 * Frontend validations for interactive messages
 *  - Client will always receive a valid template to render
 *  - Frontend will truncate fields
 *  - Upper limits not enforced by backend, beyond a 20k char limit for the entire message
 *
 * Documentation: https://docs.aws.amazon.com/connect/latest/adminguide/interactive-messages.html
 */
export const INTERACTIVE_MESSAGE_CONSTRAINTS = {
  [InteractiveMessageType.PANEL]: {
    titleCharLimit: 400,
    subtitleCharLimit: 400,
    elementTitleCharLimit: 400
  },
  [InteractiveMessageType.LIST_PICKER]: {
    titleCharLimit: 400,
    subtitleCharLimit: 400,
    elementTitleCharLimit: 400,
    elementSubtitleCharLimit: 400,
  },
  [InteractiveMessageType.TIME_PICKER]: {
    titleCharLimit: 400,
    subtitleCharLimit: 400,
  },
  [InteractiveMessageType.CAROUSEL]: {
    titleCharLimit: 400,
  },
  [InteractiveMessageType.QUICK_REPLY]: {
    titleCharLimit: 400,
    replyOptionCharLimit: 200,
  }
}

/**
 * Truncates a string for interactive message based on hard-coded constraints
 *
 * @param {string} str - input string to truncate (e.g. title, subtitle).
 * @param {string} InteractiveMessageType - interactive message templateType.
 * @param {string} fieldLimitKey - field key for contraint (e.g. titleCharLimit).
 * @returns {string} the truncated string.
 */
export const truncateStrFromCharLimit = (str, InteractiveMessageType, fieldLimitKey) => {
  const templateContraints = INTERACTIVE_MESSAGE_CONSTRAINTS[InteractiveMessageType] || {};
  const MAX_LENGTH = templateContraints[fieldLimitKey] || 0;

  if (!(str && typeof str === "string" && MAX_LENGTH)) {
    return "";
  }

  /**
   * Mitigate Interactive Message fields XSS vulnerabilites with `dompurify`
   *
   * React will always render these passed template field values as strings not HTML.
   * React auto-escapes by default unless using dangerouslySetInnerHTML.
   */
  const sanitizedStr = DOMPurify.sanitize(str);

  if (sanitizedStr.length <= MAX_LENGTH) {
    return sanitizedStr;
  } else {
    console.warn(`[${InteractiveMessageType} template] ${fieldLimitKey} of ${MAX_LENGTH} was exceeded`)
    return sanitizedStr.substring(0, MAX_LENGTH) + "...";
  }
}

/* -------------------------------------------------------------------------
 * QuickReply rating / feedback handling
 *
 * Shared by the render path (QuickReply.js shows the Figma face/digit chip
 * glyphs for these) and the send path (buildQuickReplyResponsePayload below,
 * which flattens the answer to plain text so Connect/Lex intent matching
 * fires the same way it does for a free-typed reply).
 * ---------------------------------------------------------------------- */

// The fixed 1-5 feedback scale.
export const RATING_QUICK_REPLY_VALUES = ["1", "2", "3", "4", "5"];

/**
 * Resolves a QuickReply element to its rating value ("1".."5"), or undefined.
 * Some bot integrations don't set element.value at all (just a descriptive
 * title like "1 Very Dissatisfied") - fall back to the leading digit in the
 * title so a rating scale still resolves either way.
 */
export function getQuickReplyElementRatingValue(element) {
  if (element && element.value !== undefined && element.value !== null) {
    return String(element.value);
  }
  const match = /^\s*([1-5])(?!\d)/.exec((element && element.title) || "");
  return match ? match[1] : undefined;
}

/**
 * Render-path check: should this QuickReply show the Figma face/digit rating
 * chips? True when the bot marks it explicitly (content.displayStyle ===
 * "rating") OR its elements are exactly the 1-5 scale (regardless of order),
 * so existing bot payloads get the chip icons without a bot-side change.
 *
 * This is intentionally looser than isFeedbackRatingQuickReply below - it only
 * affects how the chips look, never the wire format of the response.
 *
 * @param {object} content - a QuickReply content object (title, elements,
 *   displayStyle).
 * @returns {boolean}
 */
export function isRatingQuickReply(content) {
  if (!content || typeof content !== "object") {
    return false;
  }
  if (content.displayStyle === QuickReplyDisplayStyle.RATING) {
    return true;
  }
  const {elements} = content;
  return (
    Array.isArray(elements) &&
    elements.length === RATING_QUICK_REPLY_VALUES.length &&
    RATING_QUICK_REPLY_VALUES.every((value) =>
      elements.some((element) => getQuickReplyElementRatingValue(element) === value))
  );
}

/**
 * Send-path check: should a tap on this QuickReply go out as plain text
 * instead of the interactive.response envelope?
 *
 * True when the interactive payload carries a feedback-flow `metadata` marker
 * (`nucId` / `actionExpected`, which the feedback BE attaches to every prompt
 * in the flow - rating scales AND the Yes/No resolution question) OR the bot
 * set the explicit `content.displayStyle === "rating"` marker.
 *
 * Any other QuickReply - from LEX / VA or any integration that sends neither
 * signal - keeps the interactive.response contract untouched.
 *
 * @param {object} content - a QuickReply content object.
 * @param {object} [metadata] - the interactive payload's top-level `metadata`
 *   object (sibling of `data`), if any.
 * @returns {boolean}
 */
export function isFeedbackFlowQuickReply(content, metadata) {
  if (
    metadata && typeof metadata === "object" &&
    (metadata.nucId != null || metadata.actionExpected != null)
  ) {
    return true;
  }
  return (
    !!content && typeof content === "object" &&
    content.displayStyle === QuickReplyDisplayStyle.RATING
  );
}

/**
 * Rewrites an outgoing QuickReply interactive.response to plain text when the
 * prompt it answers belongs to the feedback flow, so Connect/Lex runs intent
 * matching on the answer ("2 Dissatisfied", "Yes") exactly as it would for a
 * free-typed reply.
 *
 * The QuickReply component always emits the structured interactive.response
 * envelope; the decision to flatten lives here (called from ChatSession)
 * because it depends on the *incoming* prompt's payload - specifically its
 * `metadata` marker, which the component never receives. Any response that is
 * not a QuickReply interactive.response, or whose prompt is not a feedback-
 * flow QuickReply (LEX / VA and every other integration), is returned
 * unchanged.
 *
 * @param {{text: string, type: string}} outgoingData - the message about to be sent.
 * @param {object} [lastIncomingInteractive] - the last incoming interactive
 *   payload, already JSON-parsed ({templateType, data: {content}, metadata}).
 * @returns {{text: string, type: string}} the original data, or a text/plain rewrite.
 */
export function flattenFeedbackQuickReplyResponse(outgoingData, lastIncomingInteractive) {
  if (!outgoingData || outgoingData.type !== ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE) {
    return outgoingData;
  }
  let parsedOutgoing;
  try {
    parsedOutgoing = JSON.parse(outgoingData.text);
  } catch (e) {
    return outgoingData;
  }
  if (
    !parsedOutgoing ||
    parsedOutgoing.templateType !== InteractiveMessageType.QUICK_REPLY ||
    typeof parsedOutgoing.action !== "string"
  ) {
    return outgoingData;
  }
  if (!lastIncomingInteractive || lastIncomingInteractive.templateType !== InteractiveMessageType.QUICK_REPLY) {
    return outgoingData;
  }
  const incomingContent = lastIncomingInteractive.data && lastIncomingInteractive.data.content;
  if (!isFeedbackFlowQuickReply(incomingContent, lastIncomingInteractive.metadata)) {
    return outgoingData;
  }
  return {
    text: parsedOutgoing.action,
    type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
  };
}

/**
 * Generates the url to fetch guides renderer
 */
export const constructGuidesRendererUrl = (instanceAlias, rendererVersion) => {
  if (!instanceAlias || !rendererVersion) {
    console.warn("[GuidesInChat] Unable to generate guides renderer url. Chat will not be able to render views");
    return '';
  }
  const url = `https://${instanceAlias}.my.connect.aws/connectwidget/static/views/renderer/${rendererVersion}/index.js`;
  return url;
}

/**
 * Insert script in head to fetch guides renderer if required
 * @param {object} props props that were passed with the init call for this widget
 */
export const setupGuidesRenderer = (props) => {
  const logger = connect.LogManager ? connect.LogManager.getLogger({prefix: "ChatInterface-Chat"}): console;
  if (props.guidesInChat) {
    const version = props.guidesInChat.version || 'latest';
    const instanceAlias = props.guidesInChat.instanceAlias;
    if (instanceAlias) {
      const guidesRendererUrl = constructGuidesRendererUrl(instanceAlias, version);
      logger && logger.debug('[GuidesInChat] Using guides renderer url ',guidesRendererUrl);

      const script = document.createElement("script");
      script.src = guidesRendererUrl;
      document.head.appendChild(script);
    } else {
      logger && logger.warn('[GuidesInChat] Could not find necessary configuration to fetch renderer. Guides in chat may not render');
    }
  } else {
    logger &&logger.warn('[GuidesInChat] Configuration was not provided. Guides in chat may not render if used outside of connect communication widget');
  }
}
