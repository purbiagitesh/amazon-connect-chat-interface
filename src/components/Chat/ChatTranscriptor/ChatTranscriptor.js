
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
    // Loading more history from the Participant Service only makes sense
    // while the contact is still actually connected - once it's ended
    // (DISCONNECTED, via endChat()/_endChatKeepingPanelOpen in
    // ChatSession.js) the underlying ChatJS session has nothing valid left
    // to reach, and calling getTranscript() against it can hang rather than
    // reject. That's what was freezing ChatTranscriptScroller.js when a
    // customer scrolled up after the inactivity flow ended their chat but
    // (deliberately) left the panel open: `loading` never got reset to
    // false because loadPreviousTranscript()'s promise never settled.
    // Resolving immediately here instead of calling through keeps that
    // promise chain intact/well-behaved with nothing to actually load.
    if (this.props.contactStatus !== CONTACT_STATUS.CONNECTED) {
      return Promise.resolve();
    }
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
    // The SYSTEM_MESSAGE disclaimer is a standalone notice, not part of the
    // assistant's conversational flow - give it a per-message key so it
    // neither shares an avatar with, nor suppresses the avatar of, the BOT
    // welcome message that immediately follows it (otherwise that welcome
    // message renders an AvatarSpacer instead of the brand avatar).
    if (itemDetails.displayName === "SYSTEM_MESSAGE") {
      return `system-notice-${itemDetails.id}`;
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
          this.props.contactStatus === CONTACT_STATUS.ENDED ||
          // DISCONNECTED is the status endChat()/_endChatKeepingPanelOpen()
          // (ChatSession.js) transition to once the contact is actually
          // ended - the transcript/history must stay visible here too, or
          // the panel goes blank the moment a chat ends (previously masked
          // by the panel closing at the same time; no longer true now that
          // the inactivity auto-disconnect flow keeps it open).
          this.props.contactStatus === CONTACT_STATUS.DISCONNECTED) && (
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