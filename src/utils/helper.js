import {ContentType, InteractiveMessageType} from "../components/Chat/datamodel/Model";
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
