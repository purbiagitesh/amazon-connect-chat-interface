
import React, {PureComponent} from "react";
import PT from "prop-types";
import styled from "styled-components";
import {modelUtils} from "../datamodel/Utils";
import {
  Direction,
  PARTICIPANT_MESSAGE,
  ATTACHMENT_MESSAGE,
  ContentType,
  Status,
  ATTACHMENT_REJECTED_MESSAGE,
} from "../datamodel/Model";
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

// Two consecutive outgoing image/video attachments only share one grid
// bubble (see buildRenderGroups) when their send times are within this many
// seconds of each other - i.e. they came from the same multi-file composer
// send. A later upload (e.g. the customer re-uploading after an
// approved/rejected response and its error message) is well past this gap,
// so it starts its own fresh bubble instead of being absorbed into the
// earlier batch's bubble. sentTime is in seconds.
const MEDIA_ATTACHMENT_GROUP_MAX_GAP_SECONDS = 10;
// Two consecutive outgoing image/video attachments only share one grid
// bubble (see buildRenderGroups) when their send times are within this many
// seconds of each other - i.e. they came from the same multi-file composer
// send. A later upload (e.g. the customer re-uploading after an
// approved/rejected response and its error message) is well past this gap,
// so it starts its own fresh bubble instead of being absorbed into the
// earlier batch's bubble. sentTime is in seconds.
//const MEDIA_ATTACHMENT_GROUP_MAX_GAP_SECONDS = 10;

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
    
    // Same per-message treatment for ChatSession's inactivity notices
    // ("Sorry, I didn't get your response.", the re-prompted message, and
    // "Thank you for connecting with us today.") - each one should draw its
    // own avatar bubble as a visual cue that the assistant is speaking again
    // after a pause, rather than silently folding into whatever group came
    // right before it (see modelUtils.cloneIncomingItemForReprompt /
    // createLocalIncomingNotice, which set this flag).
    if (itemDetails.isLocalNotice) {
      return `local-notice-${itemDetails.id}`;
    }
    return isAdvisorSender(itemDetails) ? "advisor" : "assistant";
  };

  renderMessage = (itemsInGroup, previousItemDetails, isLatestMessage) => {
    // The representative item for the group is always the last one - its
    // timestamp/receipt/error state stands in for the whole batch (see
    // buildRenderGroups below).
    const itemDetails = itemsInGroup[itemsInGroup.length - 1];
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
        // Multiple images/videos sent together render as one grid bubble
        // instead of one bubble per attachment (see buildRenderGroups).
        groupedAttachmentItems: modelUtils.isMediaAttachmentItem(itemDetails) ? itemsInGroup : null,
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

  // Consecutive outgoing image/video attachment messages (e.g. a multi-file
  // composer selection - see ChatComposer's sendAttachments) are collapsed
  // into a single render group so they share one message bubble/grid instead
  // of each attachment getting its own bubble. Every other item (text
  // messages, non-media attachments, single media attachments) is its own
  // one-item group, so this is a no-op for the common case.
  //
  // A run is also broken where two adjacent media items are more than
  // MEDIA_ATTACHMENT_GROUP_MAX_GAP_SECONDS apart: that means they belong to
  // different sends (e.g. the customer re-uploading after the previous
  // batch's approved/rejected response + error message), so the later upload
  // gets its own new bubble rather than being merged into the earlier one.
  buildRenderGroups = () => {
    const transcript = this.props.transcript; //need to handle undefined
    const groups = [];
    let i = 0;
    while (i < transcript.length) {
      const item = transcript[i];
      if (modelUtils.isMediaAttachmentItem(item)) {
        const group = [item];
        let j = i + 1;
        while (
          j < transcript.length &&
          modelUtils.isMediaAttachmentItem(transcript[j]) &&
          transcript[j].transportDetails.direction === item.transportDetails.direction &&
          transcript[j].participantId === item.participantId &&
          this.isSameAttachmentSend(group[group.length - 1], transcript[j])
        ) {
          group.push(transcript[j]);
          j++;
        }
        groups.push(group);
        // A rejected upload's guideline explanation renders as its own
        // incoming "Virtual Assistant" message right after this bubble,
        // instead of a caption attached to the customer's own bubble - see
        // buildRejectionNoticeItem. This is purely a render-time construct:
        // it is built fresh from `group` on every render, is never added to
        // this.props.transcript, and is never sent to/received from Connect
        // - it only *looks* like a genuine incoming message.
        if (group.some(modelUtils.isRejectedAttachmentMessage)) {
          groups.push([this.buildRejectionNoticeItem(group[group.length - 1])]);
        }
        i = j;
      } else {
        groups.push([item]);
        i++;
      }
    }
    return groups;
  };

  // A local-only stand-in for a genuine incoming transcript item - same
  // shape (type/content/participantRole/transportDetails) a real CUSTOM_BOT
  // message would have, so it renders through the exact same
  // ParticipantMessage path (avatar, "Virtual Assistant" sender name,
  // incoming bubble) as any other bot reply - see ChatMessage's
  // isAdvisorSender/getVirtualAssistantName, which key off participantRole/
  // displayName exactly like this. Its id is derived from the rejected
  // group's own representative item, so it stays stable across re-renders
  // without ever being persisted anywhere.
  buildRejectionNoticeItem = (rejectedGroupRepresentative) => {
    const sentTime =
      (rejectedGroupRepresentative.transportDetails && rejectedGroupRepresentative.transportDetails.sentTime) || 0;
    return {
      id: `${rejectedGroupRepresentative.id}-rejection-notice`,
      type: PARTICIPANT_MESSAGE,
      content: {
        data: ATTACHMENT_REJECTED_MESSAGE,
        type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
      },
      displayName: "BOT",
      participantId: `${rejectedGroupRepresentative.participantId || "virtual-assistant"}-rejection-notice`,
      participantRole: "CUSTOM_BOT",
      version: 0,
      transportDetails: {
        direction: Direction.Incoming,
        status: Status.SendSuccess,
        // Sort/display right after the rejected attachment bubble itself.
        sentTime: sentTime + 0.001,
      },
    };
  };

  // Whether two adjacent outgoing media items came from the same send, judged
  // by how far apart their send times are. If either lacks a usable sentTime
  // the check is skipped (returns true) so grouping falls back to the
  // previous purely-consecutive behavior.
  isSameAttachmentSend = (earlierItem, laterItem) => {
    const earlier = earlierItem.transportDetails && earlierItem.transportDetails.sentTime;
    const later = laterItem.transportDetails && laterItem.transportDetails.sentTime;
    if (typeof earlier !== "number" || typeof later !== "number" || isNaN(earlier) || isNaN(later)) {
      return true;
    }
    return Math.abs(later - earlier) <= MEDIA_ATTACHMENT_GROUP_MAX_GAP_SECONDS;
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

    const renderGroups = this.buildRenderGroups();
    const lastGroupIndex = renderGroups.length - 1;

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
              {renderGroups.map((itemsInGroup, idx) => this.renderMessage(
                itemsInGroup,
                idx > 0 ? renderGroups[idx - 1][renderGroups[idx - 1].length - 1] : null,
                idx === lastGroupIndex
              ))}
              {this.props.typingParticipants.map(typing =>
                this.renderTyping(typing)
              )}
            </TranscriptBody>
          )}
      </TranscriptWrapper>
    );
  }
}