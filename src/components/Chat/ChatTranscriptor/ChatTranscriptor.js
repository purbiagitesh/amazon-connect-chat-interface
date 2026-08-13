
import React, {PureComponent} from "react";
import PT from "prop-types";
import styled from "styled-components";
import {modelUtils} from "../datamodel/Utils";
import {Direction, PARTICIPANT_MESSAGE, ATTACHMENT_MESSAGE} from "../datamodel/Model";
import renderHTML from 'react-render-html';
import {
  MessageBox,
  ParticipantMessage,
  ParticipantTyping,
  isAdvisorSender,
} from "./ChatMessages/ChatMessage";
import {SystemMessage} from "./ChatMessages/SystemMessage";
import ChatTranscriptScroller from "./ChatTranscriptScroller";
import {CONTACT_STATUS} from "connect-constants";


const TranscriptBody = styled.div`
  margin: 0 auto;
`;

const TranscriptWrapper = styled(ChatTranscriptScroller)`
  background: var(--ac-widget-transcript-backgroundcolor, ${props => props.theme.chatTranscriptor.background || props.theme.palette.white});
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  flex: 12 1 auto;
  min-height: 0;
`;

const defaultTranscriptConfig = {

  participantMessageConfig: {
    render: ({...props}) => {
      return <ParticipantMessage {...props} />;
    }
  },

  attachmentMessageConfig: {
    render: ({...props}) => {
      return <ParticipantMessage {...props} />;
    }
  },

  systemMessageConfig: {
    render: ({...props}) => {
      return <SystemMessage {...props} />;
    }
  }
};


export default class ChatTranscriptor extends PureComponent {
  static propTypes = {
    contactId: PT.string.isRequired,
    transcript: PT.array,
    typingParticipants: PT.array.isRequired,
    contactStatus: PT.string.isRequired,
    loadPreviousTranscript: PT.func.isRequired,
    sendReadReceipt: PT.func.isRequired,
  };

  loadTranscript = () => {
    console.log("CCP", "ChatTranscriptor - transcriptLoading true");
    return this.props.loadPreviousTranscript().then((data) => {
      console.log("CCP", "ChatTranscriptor - transcript Loading complete");
      return data;
    });
  };

  // Which "avatar category" a transcript item belongs to, so consecutive
  // messages in the same category can share one avatar instead of each
  // drawing its own. Keyed by category (assistant/advisor), not exact
  // participantId/displayName - SYSTEM_MESSAGE and BOT are different
  // senders technically, but both are the Virtual Assistant to the customer
  // and use the same brand avatar (isAdvisorSender only flags a real AGENT
  // as "advisor"). Returns null for anything that never shows an avatar
  // (outgoing customer messages, system/event dividers).
  avatarGroupKey = (itemDetails) => {
    if (itemDetails.type !== PARTICIPANT_MESSAGE && itemDetails.type !== ATTACHMENT_MESSAGE) {
      return null;
    }
    if (!itemDetails.transportDetails || itemDetails.transportDetails.direction !== Direction.Incoming) {
      return null;
    }
    return isAdvisorSender(itemDetails) ? "advisor" : "assistant";
  };

  renderMessage = (itemDetails, isLatestMessage) => {
    // Found via indexOf (identity match on the same array this.props.transcript
    // already is) rather than threading an extra arg through the .map() call
    // below - keeps that call untouched and this method self-contained.
    const ownIndex = this.props.transcript.indexOf(itemDetails);
    const previousItemDetails = ownIndex > 0 ? this.props.transcript[ownIndex - 1] : null;
    const itemId = itemDetails.id;
    const version = itemDetails.version;
    const messageReceiptType = itemDetails.transportDetails && itemDetails.transportDetails.messageReceiptType ? 
                                itemDetails.transportDetails.messageReceiptType : "";
    const key = `${itemId}.${version}.${messageReceiptType}`;

    const transcriptConfig = Object.assign({}, defaultTranscriptConfig, this.props.transcriptConfig);
    let config = {
      render: transcriptConfig.render,
      isHTML: transcriptConfig.isHTML,
    };

    let content = null;
    let additionalProps = {};

    if (config.render) {
      content = config.render({
        key: key,
        messageDetails: itemDetails
      });
    }

    let textAlign = "left";
    const isOutgoing = itemDetails.transportDetails && itemDetails.transportDetails.direction === Direction.Outgoing;

    const currentGroupKey = this.avatarGroupKey(itemDetails);
    const previousGroupKey = previousItemDetails ? this.avatarGroupKey(previousItemDetails) : null;
    const showAvatar = currentGroupKey === null || currentGroupKey !== previousGroupKey;

    if (itemDetails.type === PARTICIPANT_MESSAGE) {
      config = Object.assign({}, config, transcriptConfig.participantMessageConfig);
      textAlign = isOutgoing ? "right" : "left";
      additionalProps = {
        mediaOperations: {
          addMessage: this.props.addMessage,
          downloadAttachment: this.props.downloadAttachment
        },
        textInputRef: this.props.textInputRef,
        isLatestMessage,
        sendReadReceipt: this.props.sendReadReceipt,
        showAvatar,
      }
    } else if (itemDetails.type === ATTACHMENT_MESSAGE) {
      config = Object.assign({}, config, transcriptConfig.attachmentMessageConfig);
      textAlign = isOutgoing ? "right" : "left";
      additionalProps = {
        mediaOperations: {
          downloadAttachment: this.props.downloadAttachment
        },
        isLatestMessage,
        sendReadReceipt: this.props.sendReadReceipt,
        showAvatar,
      }
    } else if (modelUtils.isRecognizedEvent(itemDetails.content.type)) {
      config = Object.assign({}, config, transcriptConfig.systemMessageConfig);
      textAlign = "center";
    } else {
      return <React.Fragment />;
    }
    if (!content && config && config.render) {
      content = config.render({
        key: key,
        messageDetails: itemDetails,
        ...additionalProps
      });
    }

    return (
      <MessageBox key={key} textAlign={textAlign}>
        {config.isHTML ? renderHTML(content) : content}
      </MessageBox>
    );
  };

  renderTyping = participantTypingDetails => {
    var participantId =
      participantTypingDetails.participantId;
    var displayName = participantTypingDetails.displayName;
    var direction = participantTypingDetails.direction;
    return (
      <ParticipantTyping
        key={participantId}
        displayName={displayName}
        direction={direction}
      />
    );
  };

  render() {
    const lastSentMessage = this.props.transcript
      .filter(({type, transportDetails}) => (
        (type === PARTICIPANT_MESSAGE || type === ATTACHMENT_MESSAGE) &&
        transportDetails.direction === Direction.Outgoing
      )).pop();

    const lastMessageIndex = this.props.transcript.length - 1;

    return (
      <TranscriptWrapper
        className="transcript"
        contactId={this.props.contactId}
        type={this.props.contactStatus}
        loadPreviousTranscript={this.loadTranscript}
        lastSentMessageId={lastSentMessage ? lastSentMessage.id : null}
      >
        {(this.props.contactStatus === CONTACT_STATUS.CONNECTED ||
          this.props.contactStatus === CONTACT_STATUS.ACW ||
          this.props.contactStatus === CONTACT_STATUS.ENDED) && (
            <TranscriptBody>
              {this.props.transcript.map((item, idx) => this.renderMessage(item, idx === lastMessageIndex))}
              {this.props.typingParticipants.map(typing =>
                this.renderTyping(typing)
              )}
            </TranscriptBody>
          )}
      </TranscriptWrapper>
    );
  }
}