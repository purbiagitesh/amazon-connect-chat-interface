import React, { PureComponent, useState, useEffect, useMemo } from "react";
import { FormattedMessage } from "react-intl";
import styled from "styled-components";
import PT from "prop-types";
import Linkify from "react-linkify";
import { getCurrentChatSessionInstance } from "../../ChatSession";
import {
  ATTACHMENT_MESSAGE,
  AttachmentStatus,
  ContentType,
  Status,
  Direction,
  InteractiveMessageType,
  PARTICIPANT_TYPES,
} from "../../datamodel/Model";
import { ErrorBoundary } from 'react-error-boundary';
import { Icon, TypingLoader } from "connect-core";
import { InteractiveMessage } from "./InteractiveMessage";
import { CSM_CONSTANTS, CSM_CATEGORY } from "../../../../constants/global";
import { InView } from "react-intersection-observer";
import { shouldDisplayMessageForType, safeParseInteractiveMessageJSON } from "../../../../utils/helper";
import { modelUtils } from "../../datamodel/Utils";
import { RichMessageRenderer } from "../../RichMessageComponents";
import { formatCarouselInteractiveSelection, isCarouselSelectionMessage } from "./InteractiveMessages/Carousel";

// The widget is typically rendered inside the vendor's iframe, which never
// loads clientInfo.js itself - only the host page does. Fall back to the
// parent window's copy (same pattern used in index.js and Chat.js).
function getClientAvatarUrl() {
  if (window.__CHAT_BRAND_INFO__ && window.__CHAT_BRAND_INFO__.assets) {
    return window.__CHAT_BRAND_INFO__.assets.avatar;
  }
  try {
    if (window.parent && window.parent !== window && window.parent.__CHAT_BRAND_INFO__ && window.parent.__CHAT_BRAND_INFO__.assets) {
      return window.parent.__CHAT_BRAND_INFO__.assets.avatar;
    }
  } catch (e) {
    // window.parent is cross-origin; client info isn't reachable
  }
  return null;
}

// Only a real human agent (ParticipantRole "AGENT") is an Advisor. Everything
// else incoming - the Lex/CUSTOM_BOT participant (DisplayName "BOT") AND
// SYSTEM participant messages like the "Please wait while I connect you with
// an advisor" queueing message - is still the Virtual Assistant experience
// and should keep showing the brand's avatar, not the generic Advisor icon
// (see modelUtils.isParticipantAgentOrCustomer for the same AGENT/CUSTOMER
// role check used elsewhere for read receipts).
export function isAdvisorSender(messageDetails) {
  return messageDetails.participantRole === PARTICIPANT_TYPES.AGENT;
}

// Same brand title the top header bar renders (see Chat.js's
// defaultHeaderConfig, which reads this same window.__CHAT_BRAND_INFO__.config
// .header.title, itself populated from each brand's config/env.*.json
// "title" field, e.g. "Estee Lauder Virtual Assistant"). Reused here so the
// per-message sender label matches the header instead of showing the raw
// Connect participant DisplayName ("SYSTEM_MESSAGE"/"BOT").
function getVirtualAssistantName() {
  if (window.__CHAT_BRAND_INFO__ && window.__CHAT_BRAND_INFO__.config && window.__CHAT_BRAND_INFO__.config.header) {
    return window.__CHAT_BRAND_INFO__.config.header.title;
  }
  try {
    if (
      window.parent &&
      window.parent !== window &&
      window.parent.__CHAT_BRAND_INFO__ &&
      window.parent.__CHAT_BRAND_INFO__.config &&
      window.parent.__CHAT_BRAND_INFO__.config.header
    ) {
      return window.parent.__CHAT_BRAND_INFO__.config.header.title;
    }
  } catch (e) {
    // window.parent is cross-origin; client info isn't reachable
  }
  return null;
}

export const MessageBox = styled.div`
  padding: ${({ theme }) => theme.globals.basePadding} ${({ theme }) => theme.spacing.base};
  word-break: break-word;
  overflow: auto;
  text-align: ${(props) => props.textAlign};
`;
const Header = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.mini};
`;
Header.Sender = styled.div`
  ${({ theme }) => theme.typography.supportingText};
  max-width: 75%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
  vertical-align: middle;
  color: ${({ theme }) => theme.globals.timestampColor};
`;
Header.Status = styled.div`
  ${({ theme }) => theme.typography.supportingText};
  color: ${({ theme }) => theme.globals.timestampColor};
`;
const Footer = styled.div`
  ${({ theme }) => theme.typography.supportingText};
  overflow: auto;
  color: ${({ theme }) => theme.globals.textSecondaryColor};
  padding-right: ${({ theme }) => theme.spacing.mini};
`;
Footer.MessageReceipt = styled.div`
  float: right;
`;

const Body = styled.div`
  --incomingMsgBg-background-color: ${(props) => props.theme.chatTranscriptor.incomingMsgBg};
  --outgoingMsgBg-background-color: ${(props) => props.theme.chatTranscriptor.outgoingMsgBg};
  
  ${(props) =>
    props.direction === Direction.Outgoing
      ? props.theme.chatTranscriptor.outgoingMsg
      : props.theme.chatTranscriptor.incomingMsg};

  ${(props) =>
    props.direction === Direction.Outgoing
      ? `
       background-color: var(
  --ac-widget-transcript-customer-bubble-color,
  var(--outgoingMsgBg-background-color)
);
        color: var(--ac-widget-transcript-customer-textcolor);
      `
      : `
        background-color: var(--ac-widget-transcript-agent-bubble-color, var(--incomingMsgBg-background-color));
        color: var(--ac-widget-transcript-agent-textcolor);
      `};

  ${(props) => (props.messageStyle ? props.messageStyle : "")};

  /* An image attachment bubble stays in the customer/outgoing colours
     (the normal "sent" look) for a fully APPROVED batch, or while it's still
     uploading. Only once at least one image/video in the batch comes back
     REJECTED (see useIncomingBubbleColors in ChatMessage's render) does the
     whole bubble switch to the agent/incoming colours. Colour only:
     direction, alignment, timestamp, sizing and the chip grid inside are all
     unaffected. */
  ${(props) => (props.useIncomingBubbleColors
    ? `
      background: var(--ac-widget-transcript-agent-bubble-color, var(--incomingMsgBg-background-color));
      background-color: var(--ac-widget-transcript-agent-bubble-color, var(--incomingMsgBg-background-color));
      color: var(--ac-widget-transcript-agent-textcolor);
    `
    : "")}

  ${(props) => props.childWillAddBackground ? "background: none" : ""}

  ${({ theme }) => theme.typography.body};

  /* Message bubble sizing per Figma (padding sp-10, radius rd-16, max-width
     200) - applies to every incoming/outgoing bubble, typed text and
     interactive responses alike. Interactive-message containers (Carousel,
     ListPicker, etc. - identified by removePadding) are exempt: they
     intentionally fill the available width for their own internal layout
     and manage their own padding. */
  padding: ${(props) => (props.removePadding ? 0 : props.theme.spacing.small)};
  margin-top: ${(props) => props.theme.spacing.mini};
  border-radius: 16px;
  max-width: ${(props) => (props.removePadding ? "none" : "200px")};
  position: relative;

  /* A plain-text/response bubble must hug its own text width rather than
     the default block behavior of stretching to fill MessageContainer's
     resolved width - since that width is set by the widest of Header/Body/
     Footer, a short message ("Yes") under a wider Header row ("Gitesh
     2:37 PM") would otherwise show as a bubble background stretched well
     past its own text. Interactive-message containers (Carousel, ListPicker,
     etc. - identified by removePadding) are exempt: they intentionally fill
     the available width for their own internal layout. */
    display: ${(props) => (props.removePadding ? "block" : "inline-block")};

  /* MessageBox sets text-align: right on outgoing messages purely to push
     this inline-block bubble to the right edge of the row - since
     text-align is inherited, that value otherwise leaks into the message
     text itself and right-aligns wrapped lines inside the bubble. */
  text-align: left;
`;

// Wraps Header/Body/Footer as one unit so the bubble hugs its content
// instead of stretching across the full transcript width. Both customer
// (outgoing) and VA/agent (incoming) bubbles share the same sizing - see
// Body's max-width above for the actual Figma cap.
const MessageContainer = styled.div`
  display: inline-block;
  max-width: 100%;
`;

// Wraps RichMessageRenderer output - both real text/markdown messages and
// bot/system text/plain messages sniffed as markdown (see renderContent) -
// so a multi-paragraph reply matches Figma: a visible gap between
// consecutive blocks and body copy at Regular weight, with **bold** spans at
// 700. Font family/size/color/line-height still inherit from the bubble's
// brand theme - only weight and spacing are set here.
//
// RichMessageRenderer's ParaRenderer/list renderers put an INLINE
// style={{ margin: 0 }} on every <p>/<ol>/<ul> (see RichMessageComponents/
// dist.js), which beats any stylesheet selector - so the block-gap rule
// below has to be !important to land, otherwise paragraphs render flush.
const RichText = styled.div`
  font-weight: 400;

  > * + * {
    margin-top: ${({ theme }) => theme.spacing.small} !important;
  }

  strong {
    font-weight: 700;
  }
`;

const ErrorText = styled.div`
  ${({ theme }) => theme.typography.supportingText};
  color: ${({ theme }) => theme.palette.red};
  display: flex;
  > img {
    margin-right: ${({ theme }) => theme.spacing.mini};
  }
`;

// Only rendered for incoming messages (see render() below). Virtual
// Assistant messages get the brand's own avatar asset (see
// window.__CHAT_BRAND_INFO__.assets.avatar, populated by
// scripts/prepare-brand.js); a customer's own messages keep the original
// single-column layout untouched.
const MessageRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.mini};
`;
const AvatarImg = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
`;
// Advisor (live agent) icon: per spec this is NOT a per-brand asset - the
// white person glyph is identical across every brand, only the circle's
// background adapts to the brand's primary color. Reuses the same CSS var
// generateBrandThemeCss() writes for the header background so it can never
// drift out of sync with the rest of the brand's theme.
const AdvisorAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--ac-widget-color-primary-500, ${({ theme }) => theme.color.primary});
`;
const AdvisorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="12" cy="8" r="4" fill="#FFFFFF" />
    <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" fill="#FFFFFF" />
  </svg>
);
// Invisible stand-in for AvatarImg/AdvisorAvatar on a continuation message
// (showAvatar === false) - keeps the same 32px + gap indentation as the
// group's first message instead of the content jumping flush left once its
// own avatar is suppressed.
const AvatarSpacer = styled.div`
  width: 32px;
  flex-shrink: 0;
`;
const MessageContent = styled.div`
  flex: 1;
  min-width: 0;
`;
// Holds a QuickReply's option chips / rating scale when they are lifted out
// of the message bubble so the avatar can align to the bubble instead of the
// controls (see render()). The left inset exactly reproduces the avatar
// column - 32px avatar (AvatarImg/AdvisorAvatar/AvatarSpacer width) plus
// MessageRow's gap - so the controls stay in the identical horizontal
// position they occupied inside MessageContent. No vertical margin: the
// controls' own top padding provides the same gap below the bubble as
// before. When there is no avatar column (indented === false) it is flush
// with the bubble, matching the pre-change layout for that case.
const QuickReplyActionsRow = styled.div`
  &[data-indented="true"] {
    padding-left: calc(32px + ${({ theme }) => theme.spacing.mini});
  }
`;
const StatusText = styled.span`
  ${({ theme }) => theme.typography.supportingText};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
  padding-right: ${({ theme }) => theme.spacing.mini};
`;

const TransportErrorMessage = styled.div`
  ${({ theme }) => theme.typography.supportingText};
  /* MessageContainer is inline-block, so it sizes to its widest child. An
     unconstrained error paragraph here would stretch the whole message -
     and for a media attachment (whose Body fills that resolved width) it
     drags the bubble background wide with it, leaving a small chip
     floating in a full-width bubble. Cap the caption at the Figma bubble
     width (see Body/MediaAttachmentGridContainer) and count padding
     inward so it wraps directly beneath the bubble instead. */
  box-sizing: border-box;
  max-width: 200px;
  word-break: break-word;
  margin-left: ${(props) => props.theme.chatTranscriptor.msgStatusWidth};
  padding: ${({ theme }) => theme.spacing.small} ${({ theme }) => theme.spacing.small} ${({ theme }) => theme.spacing.micro};

  span {
    color: ${({ theme }) => theme.palette.red};
  }
`;

TransportErrorMessage.RetryButton = styled.a`
  ${({ theme }) => theme.typography.inlineButton};
  margin-left: ${({ theme }) => theme.spacing.micro};
`;

export const ErrorFallback = ({ error, resetErrorBoundary, InteractiveMessageType }) => {
  const metricName = InteractiveMessageType + "_ERROR"
  if (window.connect && window.connect.csmService) {
    window.connect.csmService.addCountAndErrorMetric(metricName, CSM_CATEGORY.UI, false);
  }
  console.warn("Render Error for:", error);
  return (
    <div role="alert">
      <p>Something went wrong</p>
      <button onClick={resetErrorBoundary}>Reload Editor</button>
    </div>
  )
}

const INTERACTIVE_MESSAGE_TEMPLATE_TYPES = Object.values(InteractiveMessageType);

// Amazon Connect's "Play prompt" contact-flow block can only send messages
// as text/plain - it has no content-type option - so a bot author who wants
// a message rendered as markdown wraps its body in a <Markdown>...</Markdown>
// tag. When an incoming message's text is wrapped this way, strip the tag
// and render the inner content through RichMessageRenderer (see
// renderContent). This is an explicit per-message opt-in: every other
// text/plain reply, wrapped or not, stays literal.
const MARKDOWN_WRAPPER_RE = /^\s*<markdown>\s*([\s\S]*?)\s*<\/markdown>\s*$/i;

// Amazon Connect's SendMessage API only accepts ContentType text/plain or
// text/markdown for a CUSTOM_BOT participant (confirmed via a live
// ValidationException: "supported value(s) [text/plain, text/markdown]") -
// application/vnd.amazonaws.connect.message.interactive is rejected outside
// Lex's own internal integration. Rather than requiring Lex, this lets a
// plain-text/markdown message still render as the real interactive
// component (ListPicker, QuickReply, etc.) if its content is shaped like a
// genuine interactive-message payload - both a native Lex-sent interactive
// message (matched via contentType above) and this same JSON sent as
// text/plain by a custom-bot Lambda end up rendering identically.
function isInteractiveMessagePayload(content) {
  const parsed = safeParseInteractiveMessageJSON(content);
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    INTERACTIVE_MESSAGE_TEMPLATE_TYPES.includes(parsed.templateType) &&
    typeof parsed.data === "object" &&
    parsed.data !== null &&
    typeof parsed.data.content === "object" &&
    parsed.data.content !== null
  );
}

export class ParticipantMessage extends PureComponent {
  static propTypes = {
    messageDetails: PT.object.isRequired,
    incomingMsgStyle: PT.object,
    outgoingMsgStyle: PT.object,
    mediaOperations: PT.object,
    isLatestMessage: PT.bool,
    shouldShowMessageReceipts: PT.bool,
    sendReadReceipt: PT.func.isRequired,
    // Consecutive messages from the same assistant/advisor "sender" share a
    // single avatar (set by ChatTranscriptor based on the previous transcript
    // item) - explicitly false means "this message is a continuation of the
    // previous one, don't draw a second avatar". Omitted/true keeps the
    // original per-message behavior, so existing callers/tests are unaffected.
    showAvatar: PT.bool,
    // Set (by ChatTranscriptor) when this ATTACHMENT_MESSAGE is the
    // representative of one or more consecutive outgoing image/video
    // attachments - renders all of them as one grid bubble instead of the
    // plain filename-link AttachmentMessage.
    groupedAttachmentItems: PT.array,
  };

  constructor(props) {
    super(props);
    this.state = {
      inView: false,
      isVisible: false,
    };
    this.csmService = undefined
    if (window.connect && window.connect.csmService) {
      this.csmService = window.connect.csmService;
    }
  }

  timestampToDisplayable(timestamp) {
    const d = new Date(0);
    d.setUTCSeconds(timestamp);
    const today = new Date().toDateString();
    const thatDay = new Date(timestamp * 1000).toDateString();
    const option = { hour: "numeric", minute: "numeric" };
    if (today === thatDay) {
      return d.toLocaleTimeString([], option);
    }
    return d.toLocaleTimeString([], {
      ...option,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  renderHeader(hideSenderName) {
    const isOutgoingMsg = this.props.messageDetails.transportDetails.direction === Direction.Outgoing;
    const authenticatedParticipantDisplayName = getCurrentChatSessionInstance().authenticatedParticipantDisplayName;
    let displayName = this.props.messageDetails.displayName || (isOutgoingMsg ? "Customer" : "Agent");
    if (isOutgoingMsg && authenticatedParticipantDisplayName) {
      displayName = authenticatedParticipantDisplayName;
    } else if (!isOutgoingMsg && !isAdvisorSender(this.props.messageDetails)) {
      // SYSTEM/BOT participant (raw DisplayName "SYSTEM_MESSAGE"/"BOT") is
      // the Virtual Assistant experience, same as the avatar logic in
      // render() below - label it with the brand's name instead of the raw
      // Connect DisplayName.
      displayName = getVirtualAssistantName() || displayName;
    }
    const transportDetails = this.props.messageDetails.transportDetails;
    const statusStringPrefix = "connect-chat-transport-status-";

    let transportStatusElement = <React.Fragment />;
    switch (transportDetails.status) {
      case Status.Sending:
        transportStatusElement = (
          <React.Fragment>
            <StatusText>
              <span>
                <FormattedMessage
                  id={statusStringPrefix + "sending"}
                  defaultMessage="Sending"
                />
              </span>
            </StatusText>
          </React.Fragment>
        );
        break;
      case Status.SendSuccess:
        transportStatusElement = <React.Fragment>{this.timestampToDisplayable(transportDetails.sentTime, isOutgoingMsg)}</React.Fragment>;
        break;
      case Status.SendFailed:
        transportStatusElement = (
          <ErrorText>
            <Icon />
            <span>
              <FormattedMessage
                id={statusStringPrefix + "sendFailed"}
                defaultMessage="Failed to send! "
              />
            </span>
          </ErrorText>
        );
        break;
      default:
        transportStatusElement = <React.Fragment />;
    }
    return (
      <React.Fragment>
        {!hideSenderName && (
          <Header.Sender>
            <FormattedMessage
              id={displayName || "DISPLAY_NAME_MISSING"}
              defaultMessage={displayName}
            />
          </Header.Sender>
        )}
        <Header.Status>{transportStatusElement}</Header.Status>
      </React.Fragment>
    );
  }

  renderMessageReceipts() {
    const {
      messageDetails: {
        lastReadReceipt = false,
        lastDeliveredReceipt = false,
        transportDetails: { messageReceiptType, direction } = {},
      },
    } = this.props;
    if (direction !== Direction.Outgoing || !messageReceiptType) {
      return null;
    }
    return (
      <React.Fragment>
        <Footer.MessageReceipt>
          {lastReadReceipt && <FormattedMessage
            id="connect-chat-read-receipt"
            defaultMessage="Read"
            aria-live="polite"
          />}
          {lastDeliveredReceipt && <FormattedMessage
            id="connect-chat-delivered-receipt"
            defaultMessage="Delivered"
            aria-live="polite"
          />}
        </Footer.MessageReceipt>
      </React.Fragment>
    );
  }

  visibilityChangeListener() {
    const isVisible = document.visibilityState === "visible";
    this.setState({ isVisible });
  }

  componentDidUpdate() {
    const {
      transportDetails: { direction },
      type,
      id,
      participantRole,
    } = this.props.messageDetails;
    //Note: type valid values: https://docs.aws.amazon.com/connect-participant/latest/APIReference/API_Item.html#connectparticipant-Type-Item-Type
    if (
      this.state.inView &&
      this.state.isVisible &&
      modelUtils.isTypeMessageOrAttachment(type) &&
      modelUtils.isParticipantAgentOrCustomer(participantRole) &&
      direction === Direction.Incoming
    ) {
      this.props.sendReadReceipt(
        id,
        type === ATTACHMENT_MESSAGE ? { disableThrottle: true } : {},
      );
    }
  }

  componentDidMount() {
    //Bug-Fix: In Firefox react-intersection-observer is not able to identify if a page is active or minimized.
    this.visibilityChangeListener();
    document.addEventListener(
      "visibilitychange",
      this.visibilityChangeListener.bind(this),
    );
  }

  componentWillUnmount() {
    document.removeEventListener(
      "visibilitychange",
      this.visibilityChangeListener.bind(this),
    );
  }

  render() {
    let { direction, error } = this.props.messageDetails.transportDetails;
    const messageStyle =
      direction === Direction.Outgoing
        ? this.props.outgoingMsgStyle
        : this.props.incomingMsgStyle;
    const isIncoming = direction === Direction.Incoming;
    // ChatTranscriptor passes showAvatar === false when the previous
    // transcript item was also an incoming assistant/advisor message - draws
    // one avatar per consecutive group instead of one per message.
    const isConsecutiveContinuation = isIncoming && this.props.showAvatar === false;
    // Per Figma the brand avatar tags only the text message that introduces a
    // Carousel/OrderCarousel/CaseCarousel - the carousel row itself shows no
    // avatar. It still occupies the same avatar column (AvatarSpacer) so the
    // carousel keeps its exact current position/width - nothing else moves.
    const isCarouselMessage =
      this.props.messageDetails.type !== ATTACHMENT_MESSAGE &&
      !!this.props.messageDetails.content &&
      (this.props.messageDetails.content.type === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE ||
        isInteractiveMessagePayload(this.props.messageDetails.content.data)) &&
      [
        InteractiveMessageType.CAROUSEL,
        InteractiveMessageType.ORDER_CAROUSEL,
        InteractiveMessageType.CASE_CAROUSEL,
      ].includes((safeParseInteractiveMessageJSON(this.props.messageDetails.content.data) || {}).templateType);
    const suppressOwnAvatar = isIncoming && isCarouselMessage;
    const showAdvisorIcon =
      isIncoming && !isConsecutiveContinuation && !suppressOwnAvatar && isAdvisorSender(this.props.messageDetails);
    const avatarUrl =
      isIncoming && !isConsecutiveContinuation && !suppressOwnAvatar && !showAdvisorIcon && getClientAvatarUrl();

    //Hack to simulate ChatJS response with attachment content types
    const bodyStyleConfig = {};
    if (
      this.props.isLatestMessage &&
      this.props.messageDetails.content &&
      (this.props.messageDetails.content.type ===
        ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE ||
        // CUSTOM_BOT participants can only send text/plain (see
        // isInteractiveMessagePayload below) - this same JSON payload needs
        // this Body styling regardless of which transport carried it, or
        // Order/Case Carousel's own card background/padding gets layered
        // underneath the bubble's default padded background.
        isInteractiveMessagePayload(this.props.messageDetails.content.data))
    ) {
      bodyStyleConfig.hideDirectionArrow = true;
      bodyStyleConfig.removePadding = true;

      const { templateType } = safeParseInteractiveMessageJSON(this.props.messageDetails.content.data) || {};
      if (
        templateType === InteractiveMessageType.VIEW_RESOURCE ||
        templateType === InteractiveMessageType.QUICK_REPLY ||
        templateType === InteractiveMessageType.CAROUSEL ||
        templateType === InteractiveMessageType.ORDER_CAROUSEL ||
        templateType === InteractiveMessageType.CASE_CAROUSEL ||
        templateType === InteractiveMessageType.RESHIP_CASE_CREATION
      ) {
        bodyStyleConfig.childWillAddBackground = true;
      }
    }

    // The media grid (see MediaAttachmentGrid) sizes/pads/rounds itself
    // (padding 10, radius 16, gap 8 - matching this same Body spec, hugging
    // however many chips were sent up to a 3-wide cap) rather than reusing
    // Body's own inline-block sizing.
    const isMediaGridAttachment =
      this.props.messageDetails.type === ATTACHMENT_MESSAGE &&
      this.props.groupedAttachmentItems &&
      this.props.groupedAttachmentItems.length > 0;
    if (isMediaGridAttachment) {
      bodyStyleConfig.removePadding = true;
    }

    let content, contentType;
    if (this.props.messageDetails.type === ATTACHMENT_MESSAGE) {
      const attachmentContentAndType = modelUtils.getAttachmentContentAndType(this.props.messageDetails);
      content = attachmentContentAndType.content;
      contentType = attachmentContentAndType.contentType;
      // A rejected image/video (media-grid) upload no longer gets an inline
      // caption here - the guideline explanation instead renders as its own
      // incoming Virtual Assistant message right after this bubble (see
      // ChatTranscriptor's buildRejectionNoticeItem), so it looks exactly
      // like any other bot reply instead of a small note under the
      // customer's own bubble. A rejected non-media attachment (e.g. a
      // rejected PDF, which never goes through the media grid) keeps this
      // caption exactly as before.
      if (!isMediaGridAttachment && content.Status === AttachmentStatus.REJECTED && error === undefined) {
        error = {
          message: "Attachment was rejected." // This will be removed once customize error message will come from connect.
        }
      }
      // Only a batch that has at least one REJECTED image/video switches the
      // bubble from the customer/outgoing colour to the agent/incoming one -
      // colour only (see Body's useIncomingBubbleColors). A batch that came
      // back fully APPROVED (or is still uploading, with no Status yet)
      // keeps the normal sent/brand bubble colour, exactly like any other
      // message the customer sends - checked across every item in the
      // group, not just this representative one, so a mixed batch (some
      // approved, some rejected) still flips.
      if (isMediaGridAttachment && this.props.groupedAttachmentItems.some(modelUtils.isRejectedAttachmentMessage)) {
        bodyStyleConfig.useIncomingBubbleColors = true;
      }
    } else {
      content = this.props.messageDetails.content.data;
      contentType = this.props.messageDetails.content.type;
      if (!shouldDisplayMessageForType(contentType)) {
        return null;
      }
    }

    // A latest-message QuickReply is rendered in two halves: the title bubble
    // stays inside the message body (so the avatar aligns to it, like every
    // other message), and the option/rating controls render just below in
    // QuickReplyActionsRow - same width and position they had in the bubble,
    // just no longer dragging the avatar down beside them.
    const interactiveParsed =
      this.props.isLatestMessage &&
      this.props.messageDetails.type !== ATTACHMENT_MESSAGE &&
      (contentType === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE ||
        isInteractiveMessagePayload(content))
        ? safeParseInteractiveMessageJSON(content)
        : null;
    const quickReplyContent =
      interactiveParsed &&
      interactiveParsed.templateType === InteractiveMessageType.QUICK_REPLY &&
      interactiveParsed.data
        ? interactiveParsed.data.content
        : null;

    const mainMessage = (
      <MessageContainer direction={direction} data-testid="main-message">
        {/* Incoming (Virtual Assistant / advisor) messages keep the sender
            name next to the timestamp. Outgoing (customer's own) messages
            show only the timestamp per Figma - the customer already knows
            who they are, so the "Customer"/own-name label is redundant. */}
        <Header data-testid="message-header">{this.renderHeader(direction === Direction.Outgoing)}</Header>
        <InView onChange={(inView) => this.setState({ inView })}>
          {({ ref }) => (
            <Body
              data-testid="message-body"
              direction={direction}
              messageStyle={messageStyle}
              {...bodyStyleConfig}
              ref={this.props.isLatestMessage ? ref : null}
            >
              {this.renderContent(content, contentType)}
            </Body>
          )}
        </InView>
        <Footer>
          {this.renderMessageReceipts()}
        </Footer>
        {error && this.renderTransportError(error)}
      </MessageContainer>
    );

    const hasAvatarColumn = !!avatarUrl || showAdvisorIcon || isConsecutiveContinuation || suppressOwnAvatar;

    const messageRow = !hasAvatarColumn ? (
      mainMessage
    ) : (
      <MessageRow data-testid="main-message-row">
        {avatarUrl ? (
          <AvatarImg src={avatarUrl} alt="" data-testid="virtual-assistant-avatar" />
        ) : showAdvisorIcon ? (
          <AdvisorAvatar aria-hidden="true" data-testid="advisor-avatar">
            <AdvisorIcon />
          </AdvisorAvatar>
        ) : (
          <AvatarSpacer aria-hidden="true" data-testid="avatar-spacer" />
        )}
        <MessageContent>{mainMessage}</MessageContent>
      </MessageRow>
    );

    if (!quickReplyContent) {
      return messageRow;
    }

    // QuickReply option/rating controls: full width below the avatar+bubble
    // row, inset to line up exactly where they sat inside the bubble.
    return (
      <React.Fragment>
        {messageRow}
        <QuickReplyActionsRow data-testid="quickreply-actions-row" data-indented={hasAvatarColumn}>
          <ErrorBoundary fallback={<ErrorFallback InteractiveMessageType={InteractiveMessageType.QUICK_REPLY} />}>
            <InteractiveMessage
              content={quickReplyContent}
              templateType={InteractiveMessageType.QUICK_REPLY}
              addMessage={this.props.mediaOperations.addMessage}
              textInputRef={this.props.textInputRef}
              renderPart="actions"
            />
          </ErrorBoundary>
        </QuickReplyActionsRow>
      </React.Fragment>
    );
  }

  triggerCountMetric(csmType) {
    if (this.csmService) {
      this.csmService.addCountMetric(csmType, CSM_CATEGORY.UI);
    }
  }

  renderContent(content, contentType) {
    if (this.props.messageDetails.type === ATTACHMENT_MESSAGE) {
      if (this.props.groupedAttachmentItems && this.props.groupedAttachmentItems.length > 0) {
        return (
          <MediaAttachmentGrid
            items={this.props.groupedAttachmentItems}
            downloadAttachment={this.props.mediaOperations.downloadAttachment}
          />
        );
      }
      return (
        <AttachmentMessage
          content={content}
          downloadAttachment={this.props.mediaOperations.downloadAttachment}
        />
      );
    }

    if (contentType === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE || isInteractiveMessagePayload(content)) {
      const { data, templateType, metadata } = safeParseInteractiveMessageJSON(content);
      if (this.props.isLatestMessage) {
        this.triggerCountMetric(templateType + CSM_CONSTANTS.RENDER_INTERACTIVE_MESSAGE)
        return (
          <ErrorBoundary fallback={<ErrorFallback InteractiveMessageType={templateType} />} >
            <InteractiveMessage
              content={data.content}
              templateType={templateType}
              fallbackCardData={metadata}
              addMessage={this.props.mediaOperations.addMessage}
              textInputRef={this.props.textInputRef}
              // QuickReply's controls render below the bubble (see render());
              // here inside the bubble we only want its title.
              renderPart={templateType === InteractiveMessageType.QUICK_REPLY ? "bubble" : undefined}
            />
          </ErrorBoundary>
        )
      }
      this.triggerCountMetric(CSM_CONSTANTS.RENDER_RICH_MESSAGE)
      return <RichMessageRenderer content={data.content.title} />
    }
    if (contentType === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE &&
      JSON.parse(content).templateType === InteractiveMessageType.VIEW_RESOURCE) {
      // this is a view response, render accordingly
      let { action, data } = JSON.parse(content);
      if (!action.trim() && data)
        action = data.content;
      return <PlainTextMessage content={action} />
    }
    if (contentType === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE &&
      JSON.parse(content).templateType === InteractiveMessageType.QUICK_REPLY) {
      // a submitted QuickReply answer - render just the chosen option's text
      const { action } = JSON.parse(content);
      return <PlainTextMessage content={action} />
    }

    // A text/plain bot message whose body is wrapped in <Markdown>...</Markdown>
    // is an explicit opt-in to rich rendering (the Play-prompt author's
    // marker - that block cannot set a text/markdown content type). Strip
    // the tag and render the inner markdown; genuine text/markdown messages
    // take the same path. Every other plain-text reply stays literal.
    const markdownWrapped =
      this.props.messageDetails.transportDetails.direction === Direction.Incoming &&
      typeof content === "string"
        ? content.match(MARKDOWN_WRAPPER_RE)
        : null;
    if (markdownWrapped || contentType === ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN) {
      this.triggerCountMetric(CSM_CONSTANTS.RENDER_RICH_MESSAGE)
      return (
        <RichText>
          <RichMessageRenderer content={markdownWrapped ? markdownWrapped[1] : content} />
        </RichText>
      )
    }
    this.triggerCountMetric(CSM_CONSTANTS.RENDER_PLAIN_MESSAGE)
    if (isCarouselSelectionMessage(content)) {
      const carouselAndNestedPickerTitle = formatCarouselInteractiveSelection(content);
      return <PlainTextMessage content={carouselAndNestedPickerTitle} />
    }

    return <PlainTextMessage content={content} />
  }

  renderTransportError(error) {
    if (!error || !error.message) {
      return null;
    }
    return (
      <TransportErrorMessage>
        <span>{error.message}</span>
        {error.retry && this.renderRetryButton(error.retry)}
      </TransportErrorMessage>
    );
  }

  renderRetryButton(callback) {
    const onRetry = (e) => {
      e.preventDefault();
      callback();
    };

    return (
      <TransportErrorMessage.RetryButton
        href={"Retry"}
        tabIndex={0}
        onClick={onRetry}
        onKeyPress={onRetry}
      >
        Retry
      </TransportErrorMessage.RetryButton>
    );
  }
}

class PlainTextMessage extends PureComponent {
  render() {
    return (
      <Linkify properties={{ target: "_blank" }}>{this.props.content}</Linkify>
    );
  }
}

// Typing indicator, per Figma "typing indicator message bubble":
//   width 66, height 30, max-width 200, padding sp-10 (theme.spacing.small),
//   dot gap 8, border-radius rd-16 (16px), opacity 1.
// Deliberately isolated from MessageBox/Body so real message bubbles are
// left untouched - the only thing shared with a real bubble is the
// brand-driven background, pulled from the same CSS vars / theme tokens
// Body uses (see Body above) so VA and consumer indicators stay in sync
// with their message bubbles for every brand.
const TypingRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.mini};
  margin-top: ${({ theme }) => theme.spacing.mini};
  /* Consumer (outgoing) indicator sits at the right edge with no avatar;
     VA/advisor (incoming) sits at the left next to the brand avatar. */
  ${(props) => (props.direction === Direction.Outgoing ? "flex-direction: row-reverse;" : "")};
`;

const TypingAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
`;

// Keeps the dots aligned with the assistant's message column when the brand
// avatar asset is missing (same 32px width as TypingAvatar).
const TypingAvatarSpacer = styled.div`
  width: 32px;
  flex-shrink: 0;
`;

const TypingBubble = styled.div`
  --incomingMsgBg-background-color: ${(props) => props.theme.chatTranscriptor.incomingMsgBg};
  --outgoingMsgBg-background-color: ${(props) => props.theme.chatTranscriptor.outgoingMsgBg};

  box-sizing: border-box;
  width: 66px;
  height: 30px;
  max-width: 200px;
  padding: ${({ theme }) => theme.spacing.small};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 1;
  border-radius: 16px;

  ${(props) =>
    props.direction === Direction.Outgoing
      ? `background-color: var(--ac-widget-transcript-customer-bubble-color, var(--outgoingMsgBg-background-color));`
      : `background-color: var(--ac-widget-transcript-agent-bubble-color, var(--incomingMsgBg-background-color));`};
`;

// Renders the "participant is composing" bubble (see ChatSession.js's
// _handleTypingEvent/_removeTypingParticipant for the real-time lifecycle:
// shown on an onTyping event, auto-expires after 12s if no follow-up
// signal arrives, and is cleared the instant a real message lands in the
// transcript so this bubble is replaced by the actual one).
// The dot color is a fixed neutral grey to match the Figma spec (grey dots
// on both the light-neutral VA bubble and the brand-color consumer bubble);
// a brand with a very dark consumer-bubble color would need this revisited.
export class ParticipantTyping extends PureComponent {
  render() {
    const isOutgoing = this.props.direction === Direction.Outgoing;
    const avatarUrl = getClientAvatarUrl();
    return (
      <TypingRow direction={this.props.direction} data-testid="participant-typing">
        {!isOutgoing &&
          (avatarUrl ? (
            <TypingAvatar src={avatarUrl} alt="" data-testid="virtual-assistant-typing-avatar" />
          ) : (
            <TypingAvatarSpacer aria-hidden="true" />
          ))}
        <TypingBubble direction={this.props.direction} aria-label="typing" role="status">
          {/* margin 4 => 8px between dots to match Figma gap: 8; size kept
              at 7 so all three dots + gaps fit the fixed 66x30 bubble
              (66 - 20 padding = 46 >= 3*7 + 2*8 + 2*4 outer margins). */}
          <TypingLoader size={7} margin={4} color="#767676" />
        </TypingBubble>
      </TypingRow>
    );
  }
}

class AttachmentMessage extends PureComponent {
  downloadAttachment = (e) => {
    e.preventDefault();
    if (!this.props.content.AttachmentId) {
      return;
    }
    this.props
      .downloadAttachment(this.props.content.AttachmentId)
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", this.props.content.AttachmentName);
        link.click();
      });
  };

  renderContent() {
    if (this.props.content.Status === AttachmentStatus.APPROVED) {
      return (
        <a
          href={this.props.content.AttachmentName}
          onClick={this.downloadAttachment}
          onKeyPress={this.downloadAttachment}
        >
          {this.props.content.AttachmentName}
        </a>
      );
    }
    return this.props.content.AttachmentName;
  }

  render() {
    if (!this.props.content) {
      return;
    }

    return <div>{this.renderContent()}</div>;
  }
}

// Placeholder glyph matching the composer's own staged-attachment chips
// (see ChatComposer's ImagePlaceholderIcon) - reused here so a sent
// attachment looks the same before and after sending.
//Because no figma UI is provided by Design team.
function ImagePlaceholderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 8v10H6V8h8Zm0-1H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1ZM9.83 12.9 7.83 15.4 6.5 13.83 4.5 16.33h9l-2.86-3.43-.81.99Z" fill="currentColor" />
    </svg>
  );
}

const MEDIA_ATTACHMENT_CHIP_SIZE_PX = 53;
const MEDIA_ATTACHMENT_GRID_GAP_PX = 8;
const MEDIA_ATTACHMENT_GRID_PADDING_PX = 10;
const MEDIA_ATTACHMENT_GRID_MAX_COLUMNS = 3;

// Width of a bubble that is exactly MEDIA_ATTACHMENT_GRID_MAX_COLUMNS chips
// wide (chips + inter-chip gaps + both paddings). Used as the grid's
// max-width so a 4th+ attachment wraps to a new row, while fewer than that
// lets the bubble shrink to hug only the chips actually sent.
const MEDIA_ATTACHMENT_GRID_MAX_WIDTH_PX =
  MEDIA_ATTACHMENT_GRID_MAX_COLUMNS * MEDIA_ATTACHMENT_CHIP_SIZE_PX +
  (MEDIA_ATTACHMENT_GRID_MAX_COLUMNS - 1) * MEDIA_ATTACHMENT_GRID_GAP_PX +
  2 * MEDIA_ATTACHMENT_GRID_PADDING_PX;

// Bubble spec for the media grid (replaces Body's own sizing - see
// bodyStyleConfig.removePadding above): padding 10, radius 16, gap 8, capped
// at MEDIA_ATTACHMENT_GRID_MAX_COLUMNS chips per row. The box hugs its
// content (width: fit-content) rather than reserving a fixed 3-wide/2-tall
// area, so an upload of fewer than the row/grid maximum shows just those
// chips with no empty placeholder space after submission. A 4th+ attachment
// still wraps to a further row (max-width cap) instead of clipping.
const MediaAttachmentGridContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: ${MEDIA_ATTACHMENT_GRID_GAP_PX}px;
  width: -webkit-fit-content;
  width: fit-content;
  max-width: ${MEDIA_ATTACHMENT_GRID_MAX_WIDTH_PX}px;
  padding: ${MEDIA_ATTACHMENT_GRID_PADDING_PX}px;
  border-radius: 16px;
`;

const MediaAttachmentChip = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex: 0 0 auto;
  overflow: hidden;
  width: ${MEDIA_ATTACHMENT_CHIP_SIZE_PX}px;
  height: ${MEDIA_ATTACHMENT_CHIP_SIZE_PX}px;
  border-radius: var(--ac-widget-transcript-media-chip-radius, 12px);
  cursor: pointer;

  /* A rejected upload shows no thumbnail at all - the chip becomes a
     tinted-red placeholder tile (pale fill, solid red border, red image
     glyph) so it reads as "blocked" at a glance. Every non-rejected chip
     keeps its existing white tile / thumbnail exactly as before. */
  background: ${(props) => (props.rejected
    ? `var(--ac-widget-transcript-media-chip-error-background, #FDE4E4)`
    : `var(--ac-widget-transcript-media-chip-background, ${props.theme.palette.white})`)};
  color: ${(props) => (props.rejected
    ? `var(--ac-widget-transcript-media-chip-error-border, ${props.theme.palette.red})`
    : `var(--ac-widget-transcript-media-chip-icon-color, ${props.theme.palette.silver})`)};
  border: ${(props) => (props.rejected
    ? `2px solid var(--ac-widget-transcript-media-chip-error-border, ${props.theme.palette.red})`
    : "1px solid transparent")};

  & > svg {
    width: 60%;
    height: 60%;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

// Shown in place of the thumbnail on a rejected chip - a red "image" glyph
// (rounded frame, sun, mountain) matching the design reference. The full
// guideline text and the re-enabled paperclip for re-uploading are handled
// by ParticipantMessage / Chat.js.
function RejectedImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="9" r="1.85" fill="currentColor" />
      <path d="M5 17.5l4-4.8 2.8 2.8 3.4-4.2L20 17.8v.7H5v-1Z" fill="currentColor" />
    </svg>
  );
}

// Resolves the actual thumbnail for one attachment: a just-attached (not yet
// sent) item still has its raw File on item.content, so its preview is free
// via URL.createObjectURL; an already-sent item only has the Attachments
// metadata (AttachmentId, no bytes), so its preview has to be fetched with
// downloadAttachment and cached as an object URL once it resolves. Falls
// back to the generic placeholder glyph while a fetched preview is still
// loading (videos are not in scope - if one ever appears it falls through
// to the same generic placeholder rather than a broken thumbnail).
function MediaAttachmentPreview({ item, content, contentType, downloadAttachment }) {
  const isVideo = !!contentType && contentType.startsWith("video/");
  const localFile = item.content instanceof File ? item.content : null;
  const localPreviewUrl = useMemo(
    () => (localFile && !isVideo ? URL.createObjectURL(localFile) : null),
    [localFile, isVideo]
  );
  const [downloadedPreviewUrl, setDownloadedPreviewUrl] = useState(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    if (localPreviewUrl || isVideo || !content.AttachmentId) {
      return undefined;
    }
    let objectUrl;
    let cancelled = false;
    downloadAttachment(content.AttachmentId).then((blob) => {
      if (cancelled) {
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setDownloadedPreviewUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.AttachmentId, localPreviewUrl, isVideo]);

  const previewUrl = localPreviewUrl || downloadedPreviewUrl;
  if (previewUrl) {
    return <img src={previewUrl} alt={content.AttachmentName} />;
  }
  return <ImagePlaceholderIcon />;
}

// Renders one or more images/videos sent together as a single 3-column
// wrapping grid of chips (see ChatTranscriptor's buildRenderGroups) instead
// of one filename-link bubble per attachment.
class MediaAttachmentGrid extends PureComponent {
  downloadItem = (item) => (e) => {
    e.preventDefault();
    const { content } = modelUtils.getAttachmentContentAndType(item);
    if (!content.AttachmentId) {
      return;
    }
    this.props.downloadAttachment(content.AttachmentId).then((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", content.AttachmentName);
      link.click();
    });
  };

  render() {
    return (
      <MediaAttachmentGridContainer data-testid="media-attachment-grid">
        {this.props.items.map((item) => {
          const { content, contentType } = modelUtils.getAttachmentContentAndType(item);
          const isRejected = content.Status === AttachmentStatus.REJECTED;
          const download = this.downloadItem(item);
          return (
            <MediaAttachmentChip
              key={item.id}
              href={content.AttachmentName}
              rejected={isRejected}
              aria-label={content.AttachmentName}
              onClick={download}
              onKeyPress={download}
            >
              {isRejected ? (
                <RejectedImageIcon />
              ) : (
                <MediaAttachmentPreview
                  item={item}
                  content={content}
                  contentType={contentType}
                  downloadAttachment={this.props.downloadAttachment}
                />
              )}
            </MediaAttachmentChip>
          );
        })}
      </MediaAttachmentGridContainer>
    );
  }
}