import React, { PureComponent } from "react";
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
} from "../../datamodel/Model";
import { ErrorBoundary } from 'react-error-boundary';
import { Icon, TypingLoader } from "connect-core";
import { InteractiveMessage } from "./InteractiveMessage";
import { CSM_CONSTANTS, CSM_CATEGORY } from "../../../../constants/global";
import { InView } from "react-intersection-observer";
import { shouldDisplayMessageForType } from "../../../../utils/helper";
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

export const MessageBox = styled.div`
  padding: ${({ theme }) => theme.globals.basePadding} ${({ theme }) => theme.spacing.base};
  word-break: break-word;
  white-space: pre-line;
  overflow: auto;
  text-align: ${(props) => props.textAlign};
`;
const Header = styled.div`
  overflow: auto;
`;
Header.Sender = styled.div`
  float: left;
  max-width: 75%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: ${({ theme }) => theme.palette.mediumGray};
`;
Header.Status = styled.div`
  ${({ theme }) => theme.typography.supportingText};
  font-size: 13px;
  float: right;
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

  ${(props) => props.childWillAddBackground ? "background: none" : ""}

  ${({ theme }) => theme.typography.body};

  padding: ${(props) => (props.removePadding ? 0 : props.theme.spacing.medium)};
  margin-top: ${(props) => props.theme.spacing.mini};
  border-radius: 18px;
  position: relative;
`;

// Wraps Header/Body/Footer as one unit so the bubble hugs its content
// instead of stretching across the full transcript width. Both customer
// (outgoing) and VA/agent (incoming) bubbles now share the same uncapped
// behavior - width just follows content up to the transcript's full width.
const MessageContainer = styled.div`
  display: inline-block;
  max-width: 100%;
`;

const ErrorText = styled.div`
  ${({ theme }) => theme.typography.supportingText};
  color: ${({ theme }) => theme.palette.red};
  display: flex;
  > img {
    margin-right: ${({ theme }) => theme.spacing.mini};
  }
`;

// Only rendered when a client has an avatar asset configured (see
// window.__CHAT_BRAND_INFO__.assets.avatar, populated by
// scripts/prepare-client.js). Clients without one keep the original
// single-column message layout untouched.
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
const MessageContent = styled.div`
  flex: 1;
  min-width: 0;
`;
const StatusText = styled.span`
  ${({ theme }) => theme.typography.supportingText};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
  padding-right: ${({ theme }) => theme.spacing.mini};
`;

const TransportErrorMessage = styled.div`
  ${({ theme }) => theme.typography.supportingText};
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

export class ParticipantMessage extends PureComponent {
  static propTypes = {
    messageDetails: PT.object.isRequired,
    incomingMsgStyle: PT.object,
    outgoingMsgStyle: PT.object,
    mediaOperations: PT.object,
    isLatestMessage: PT.bool,
    shouldShowMessageReceipts: PT.bool,
    sendReadReceipt: PT.func.isRequired,
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
    const avatarUrl = direction === Direction.Incoming && getClientAvatarUrl();

    //Hack to simulate ChatJS response with attachment content types
    const bodyStyleConfig = {};
    if (
      this.props.isLatestMessage &&
      this.props.messageDetails.content &&
      this.props.messageDetails.content.type ===
      ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE
    ) {
      bodyStyleConfig.hideDirectionArrow = true;
      bodyStyleConfig.removePadding = true;

      const { templateType } = JSON.parse(this.props.messageDetails.content.data);
      if (templateType === InteractiveMessageType.VIEW_RESOURCE || templateType === InteractiveMessageType.QUICK_REPLY || templateType === InteractiveMessageType.CAROUSEL) {
        bodyStyleConfig.childWillAddBackground = true;
      }
    }
    let content, contentType;
    if (this.props.messageDetails.type === ATTACHMENT_MESSAGE) {
      //Use Attachments data as content if available
      //If an attachment message does not have this data, it means the upload was rejected
      if (
        this.props.messageDetails.Attachments &&
        this.props.messageDetails.Attachments.length > 0
      ) {
        content = this.props.messageDetails.Attachments[0];
        contentType = content.ContentType;
        if (content.Status === AttachmentStatus.REJECTED && error === undefined) {
          error = {
            message: "Attachment was rejected."
          }
        }
      } else {
        content = {
          AttachmentName: this.props.messageDetails.content.name,
        };
        contentType = this.props.messageDetails.content.type;
      }
    } else {
      content = this.props.messageDetails.content.data;
      contentType = this.props.messageDetails.content.type;
      if (!shouldDisplayMessageForType(contentType)) {
        return null;
      }
    }

    const mainMessage = (
      <MessageContainer direction={direction} data-testid="main-message">
        <Header data-testid="message-header">{this.renderHeader(!!avatarUrl)}</Header>
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

    if (!avatarUrl) {
      return mainMessage;
    }

    return (
      <MessageRow data-testid="main-message-row">
        <AvatarImg src={avatarUrl} alt="" data-testid="customer-chat-avatar" />
        <MessageContent>{mainMessage}</MessageContent>
      </MessageRow>
    );
  }

  triggerCountMetric(csmType) {
    if (this.csmService) {
      this.csmService.addCountMetric(csmType, CSM_CATEGORY.UI);
    }
  }

  renderContent(content, contentType) {
    if (this.props.messageDetails.type === ATTACHMENT_MESSAGE) {
      return (
        <AttachmentMessage
          content={content}
          downloadAttachment={this.props.mediaOperations.downloadAttachment}
        />
      );
    }

    if (contentType === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE) {
      const { data, templateType } = JSON.parse(content);
      if (this.props.isLatestMessage) {
        this.triggerCountMetric(templateType + CSM_CONSTANTS.RENDER_INTERACTIVE_MESSAGE)
        return (
          <ErrorBoundary fallback={<ErrorFallback InteractiveMessageType={templateType} />} >
            <InteractiveMessage
              content={data.content}
              templateType={templateType}
              addMessage={this.props.mediaOperations.addMessage}
              textInputRef={this.props.textInputRef}
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

    if (contentType === ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN) {
      this.triggerCountMetric(CSM_CONSTANTS.RENDER_RICH_MESSAGE)
      return <RichMessageRenderer content={content} />
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

const ParticipantTypingBox = styled(MessageBox)`
  > ${Body}{
    display: inline-block;
    float: ${props =>
    props.direction === Direction.Outgoing ? "right" : "left"}
`;

// Renders the "participant is composing" bubble (see ChatSession.js's
// _handleTypingEvent/_removeTypingParticipant for the real-time lifecycle:
// shown on an onTyping event, auto-expires after 12s if no follow-up
// signal arrives, and is cleared the instant a real message lands in the
// transcript so this bubble is replaced by the actual one).
// Reuses the same Body styled-component as a real message, so the bubble
// background is already brand-driven for free via
// theme.chatTranscriptor.outgoingMsgBg/incomingMsgBg - no extra theming
// needed here. The dot color below is NOT brand-driven though (hardcoded
// white/black) - it happens to contrast against every brand's bubble
// today only because outgoing text/agent text defaults are white/near-black;
// a brand with a light customer-bubble color would need this revisited.
export class ParticipantTyping extends PureComponent {
  render() {
    return (
      <ParticipantTypingBox direction={this.props.direction}>
        <Body direction={this.props.direction}>
          <TypingLoader
            color={
              this.props.direction === Direction.Outgoing ? "#fff" : "#000"
            }
          />
        </Body>
      </ParticipantTypingBox>
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
