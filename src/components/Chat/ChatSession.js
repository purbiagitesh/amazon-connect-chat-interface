import "amazon-connect-chatjs";
import {CONTACT_STATUS} from "../../constants/global";
import {modelUtils} from "./datamodel/Utils";
import {ContentType, PARTICIPANT_MESSAGE, Direction, Status, ATTACHMENT_MESSAGE, AttachmentErrorType, PARTICIPANT_TYPES, InteractiveMessageType} from "./datamodel/Model";
import {getTimeFromTimeStamp, flattenFeedbackQuickReplyResponse} from "../../utils/helper";
import Eventbus from './eventbus';
import isJson from "is-json";

const SYSTEM_EVENTS = Object.values(ContentType.EVENT_CONTENT_TYPE);
const DEFAULT_PREFIX = "Amazon-Connect-ChatInterface-ChatSession";

// ─── Customer inactivity handling ───
// Entirely client-side, no Connect/Lex/contact-flow coordination: if the
// customer hasn't replied within INACTIVITY_REPROMPT_DELAY_MS of the last
// incoming message, the widget shows a local "didn't get your response"
// notice and re-displays that same message (a nudge, not a real re-send -
// see modelUtils.cloneIncomingItemForReprompt/createLocalIncomingNotice,
// this widget only has a CUSTOMER participant connection and has no way to
// make the bot/agent actually speak again). If that still gets no reply
// within another INACTIVITY_DISCONNECT_DELAY_MS, a closing notice is shown
// and the underlying Connect contact is ended automatically - but the
// widget panel itself is deliberately left open (see
// _endChatKeepingPanelOpen) so the customer can still see the closing
// message and the rest of the transcript, rather than the widget vanishing.
const INACTIVITY_REPROMPT_DELAY_MS = 90 * 1000;
const INACTIVITY_DISCONNECT_DELAY_MS = 30 * 1000;
// No i18n hook available in this file (it's a plain class, not a React
// component) - hardcoded same as everything else here. Move to a
// react-intl message if these ever need to be localized.
const INACTIVITY_NO_RESPONSE_MESSAGE = "Sorry, I didn't get your response.";
const INACTIVITY_CLOSING_MESSAGE = "Thank you for connecting with us today.";
var CurrentChatSessionInstance = {};
export function getCurrentChatSessionInstance () {
  return CurrentChatSessionInstance;
}

export function setCurrentChatSessionInstance (chatSession) {
  CurrentChatSessionInstance = chatSession;
}
// Low-level abstraction on top of Chat.JS
class ChatJSClient {
  session = null;

  constructor(chatDetails, region, stage) {
    // Creating a chatSession object with Chat.JS
    // Other operations (connecting, sending message, ...) are then done by interacting
    // with the chatSession object (this.session)
    this.session = connect.ChatSession.create({
      chatDetails: chatDetails.startChatResult,
      type: "CUSTOMER",
      options: {region: region},
    });
  }

  connect() {
    // Intiate the websocket connection. After the connection is established, the customer's chat request
    // will be routed to an agent who can then accept the request.
    return this.session.connect();
  }

  disconnect() {
    return this.session.disconnectParticipant();
  }

  onParticipantReturned(handler) {
    return this.session.onParticipantReturned(handler);
  }

  onAutoDisconnection(handler) {
    return this.session.onAutoDisconnection(handler);
  }

  onParticipantIdle(handler) {
    return this.session.onParticipantIdle(handler);
  }
  
  onChatRehydrated(handler) {
    return this.session.onChatRehydrated(handler);
  }

  onAuthenticationInitiated(handler) {
    return this.session.onAuthenticationInitiated(handler);
  }

  onAuthenticationTimeout(handler) {
    return this.session.onAuthenticationTimeout(handler);
  }

  onAuthenticationFailed(handler) {
    return this.session.onAuthenticationFailed(handler);
  }

  onAuthenticationSuccessful(handler) {
    return this.session.onAuthenticationSuccessful(handler);
  }

  onAuthenticationCanceled(handler) {
    return this.session.onAuthenticationCanceled(handler);
  }

  onParticipantDisplayNameUpdated(handler) {
    return this.session.onParticipantDisplayNameUpdated(handler);
  }

  onTyping(handler) {
    return this.session.onTyping(handler);
  }

  onReadReceipt(handler) {
    return this.session.onReadReceipt(handler);
  }

  onDeliveredReceipt(handler) {
    return this.session.onDeliveredReceipt(handler);
  }

  onEnded(handler) {
    return this.session.onEnded(handler);
  }

  onMessage(handler) {
    return this.session.onMessage(handler);
  }

  onConnectionEstablished(handler) {
    return this.session.onConnectionEstablished(handler);
  }

  onConnectionBroken(handler) {
    return this.session.onConnectionBroken(handler);
  }

  getContactId() {
    return this.session.controller.contactId;
  }

  getParticipantId() {
    return this.session.getChatDetails().participantId;
  }

  getTranscript(args) {
    return this.session.getTranscript(args);
  }

  sendTypingEvent() {
    return this.session.sendEvent({
      contentType: ContentType.EVENT_CONTENT_TYPE.TYPING,
    });
  }

  sendReadReceipt(messageId, options = {}) {
    return this.session.sendEvent({
      contentType: ContentType.EVENT_CONTENT_TYPE.READ_RECEIPT,
      content: JSON.stringify({
        messageId: messageId,
        ...options,
      }),
    });
  }

  sendDeliveredReceipt(messageId, options = {}) {
    return this.session.sendEvent({
      contentType: ContentType.EVENT_CONTENT_TYPE.DELIVERED_RECEIPT,
      content: JSON.stringify({
        messageId: messageId,
        ...options,
      }),
    });
  }

  sendMessage(content) {
    // Right now we are assuming only text messages,
    // later we will have to add functionality for other types.
    return this.session.sendMessage({
      message: content.data,
      contentType: content.type,
    });
  }

  sendAttachment(attachment) {
    return this.session.sendAttachment({attachment});
  }

  downloadAttachment(attachmentId) {
    return this.session.downloadAttachment({attachmentId});
  }

  describeView(viewTokenObj) {
    return this.session.describeView(viewTokenObj);
  }

  getAuthenticationUrl(authenticationConfiguration) {
    return this.session.getAuthenticationUrl(authenticationConfiguration);
  }

  cancelParticipantAuthentication(sessionId) {
    return this.session.cancelParticipantAuthentication(sessionId);
  }
}

class ChatSession {
  transcript = [];
  typingParticipants = [];
  thisParticipant = null;
  client = null;
  contactId = null;
  contactStatus = CONTACT_STATUS.DISCONNECTED;
  nextToken = null;

  /**
   * Flag set when an outgoing message from the Customer is in flight.
   * Until the request completes, we will not render a Customer message over the websocket.
   *
   * @type {boolean}
   */
  isOutgoingMessageInFlight = false;

  // Inactivity handling state (see INACTIVITY_REPROMPT_DELAY_MS above) -
  // null whenever no countdown is currently pending.
  _inactivityReminderTimer = null;
  _inactivityDisconnectTimer = null;
  _lastIncomingMessageItem = null;

  _eventHandlers = {
    "transcript-changed": [],
    "typing-participants-changed": [],
    "contact-status-changed": [],
    "incoming-message": [],
    "outgoing-message": [],
    "chat-disconnected": [],
    "chat-closed": [],
  };

  constructor(chatDetails, displayName, region, stage, customizationParams) {
    this.client = new ChatJSClient(chatDetails, region, stage);
    this.customizationParams = customizationParams || {};
    this.contactId = this.client.getContactId();
    this.thisParticipant = {
      participantId: this.client.getParticipantId(),
      displayName: displayName,
    };
    if (window.connect) {
      if (window.connect.LogManager) {
        this.logger = window.connect.LogManager.getLogger({
          prefix: DEFAULT_PREFIX,
        });
      }
      if (window.connect.csmService) {
        this.csmService = window.connect.csmService;
      }
    }
    if (window.connect && window.connect.LogManager) {
      this.logger = window.connect.LogManager.getLogger({
        prefix: DEFAULT_PREFIX,
      });
    }
  }

  // Callbacks
  onChatDisconnected(callback) {
    this.on("chat-disconnected", function (...rest) {
      callback(...rest);
    });
  }

  onChatClose(callback) {
    this.on("chat-closed", function (...rest) {
      callback(...rest);
    });
  }

  onIncoming(callback) {
    this.on("incoming-message", function (...rest) {
      callback(...rest);
    });
  }

  onOutgoing(callback) {
    this.on("outgoing-message", function (...rest) {
      callback(...rest);
    });
  }

  // Decoratorers
  incomingItemDecorator(item) {
    return item;
  }

  outgoingItemDecorator(item) {
    return item;
  }

  // CHAT API
  openChatSession() {
    // Defensive: guards against a stray timer from a previous connect
    // attempt on this same instance (there shouldn't be one in practice,
    // but this is cheap insurance against ever double-scheduling).
    this._clearInactivityTimers();
    this._addEventListeners();
    this._updateContactStatus(CONTACT_STATUS.CONNECTING);
    return this.client.connect().then(
      (response) => {
        this._updateContactStatus(CONTACT_STATUS.CONNECTED);
        return response;
      },
      (error) => {
        this._updateContactStatus(CONTACT_STATUS.DISCONNECTED);
        return Promise.reject(error);
      }
    );
  }

  async endChat() {
    this._clearInactivityTimers();
    await this.client.disconnect();
    this._updateContactStatus(CONTACT_STATUS.DISCONNECTED);
    this._triggerEvent("chat-disconnected");
    this._triggerEvent("chat-closed");
  }

  // Same real work as endChat() (actually disconnects the Connect contact),
  // but deliberately does NOT trigger "chat-closed" - only "chat-disconnected".
  // launcher.js's wireChatEndCleanup maps "chat-closed" to closePanel(), so
  // skipping it here is what keeps the panel open. Used by the inactivity
  // auto-disconnect flow (_handleInactivityDisconnect) specifically, per an
  // explicit product decision: the customer should still see the closing
  // message/transcript rather than have the widget vanish out from under
  // them. "chat-disconnected" is still triggered, so clearPersistedChat()
  // (wired to both events in launcher.js) still runs - this session won't
  // be offered for resume again.
  async _endChatKeepingPanelOpen() {
    this._clearInactivityTimers();
    await this.client.disconnect();
    this._updateContactStatus(CONTACT_STATUS.DISCONNECTED);
    this._triggerEvent("chat-disconnected");
  }

  closeChat() {
    this._triggerEvent("chat-closed");
  }

  // Guards the three SendEvent-based calls below: ChatMessage.js's InView
  // tracking fires sendReadReceipt() as messages scroll in/out of view
  // (independent of any user action beyond scrolling), and once the contact
  // has actually ended (endChat()/_endChatKeepingPanelOpen - contactStatus
  // becomes DISCONNECTED) the underlying ChatJS session has nothing valid
  // left to send these against. Rather than reject cleanly, ChatJS's own
  // internal response handling throws trying to attach metadata to an
  // undefined response - repeated scrolling repeatedly re-triggers this and
  // is what was freezing the transcript after a chat ended but (per the
  // keep-the-panel-open change) stayed visible and scrollable. Resolving a
  // no-op here instead of calling through avoids all of that.
  // Deliberately checks for DISCONNECTED specifically rather than requiring
  // exactly CONNECTED - CONNECTING/ENDED/ACW are all states where the
  // session is still legitimately reachable, only a fully ended contact
  // isn't.
  _isSendEventSafe() {
    return this.contactStatus !== CONTACT_STATUS.DISCONNECTED;
  }

  sendTypingEvent() {
    this.logger && this.logger.info("Calling SendEvent API for Typing");
    if (!this._isSendEventSafe()) {
      return Promise.resolve();
    }
    return this.client.sendTypingEvent();
  }

  sendReadReceipt(messageId, options) {
    this.logger && this.logger.info("Calling SendEvent API for ReadReceipt", messageId, options);
    if (!this._isSendEventSafe()) {
      return Promise.resolve();
    }
    return this.client.sendReadReceipt(messageId, options);
  }

  sendDeliveredReceipt(messageId, options) {
    this.logger && this.logger.info("Calling SendEvent API for DeliveredReceipt", messageId, options);
    if (!this._isSendEventSafe()) {
      return Promise.resolve();
    }
    return this.client.sendDeliveredReceipt(messageId, options);
  }

  alterOutgoingMessageForViewsIfRequired(data) {
    /**
     * if using guides, expect the response to be of type INTERACTIVE_RESPONSE
     * else take the no match found branch of the view
     */
    const lastIncomingMessageIdx = this._findLastMessageInTranscript(Direction.Incoming, this.transcript);
    if (lastIncomingMessageIdx >= 0) {
      const lastIncomingMessage = this.transcript[lastIncomingMessageIdx];
      try {
        const lastIncomingMessageData = JSON.parse(lastIncomingMessage.content.data);

        if (lastIncomingMessageData.templateType === InteractiveMessageType.VIEW_RESOURCE &&
          data.type !== ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE) {
          let temp_message = {
            action: " ", // empty string is not allowed
            data: {content: `${data.text}` },
            templateType: InteractiveMessageType.VIEW_RESOURCE,
            version: '1.0'
          };
          temp_message = JSON.stringify(temp_message);
          data = {text: temp_message, type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE};
        }

        // Feedback-flow QuickReply answers go out as plain text (so the
        // contact flow / Lex can intent-match them) instead of the
        // interactive.response envelope. Keyed off the incoming prompt's
        // `metadata` marker (or displayStyle "rating"), never off which
        // component rendered it - see flattenFeedbackQuickReplyResponse.
        data = flattenFeedbackQuickReplyResponse(data, lastIncomingMessageData);
      } catch (e) {
        console.debug(`Unable to parse message.content.data. Skipping check for previous view message`);
      }
    }

    return modelUtils.createOutgoingTranscriptItem(
      PARTICIPANT_MESSAGE,
      {data: data.text, type: data.type || ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN},
      this.thisParticipant
    );
  }

  addOutgoingMessage(data) {
    // The customer replied - the inactivity re-prompt/auto-disconnect
    // countdown no longer applies to the message it was waiting on. The
    // next incoming message (e.g. the bot's reply to this) starts a fresh
    // countdown on its own - see _handleIncomingData.
    this._clearInactivityTimers();
    const message = this.alterOutgoingMessageForViewsIfRequired(data);

    this.logger && this.logger.info(`Adding outgoing message. ContactId: ${this.contactId}`);

    this._shouldAddToTranscript(message) && this._addItemsToTranscript([message]);

    this.isOutgoingMessageInFlight = true;

    this.client
      .sendMessage(message.content)
      .then((response) => {
        console.log("send success");
        console.log(response);
        this._shouldAddToTranscript(message) && this._replaceItemInTranscript(message, modelUtils.createTranscriptItemFromSuccessResponse(message, response));

        this.isOutgoingMessageInFlight = false;
        return response;
      })
      .catch((error) => {
        this.isOutgoingMessageInFlight = false;

        this._failMessage(message);
      });
  }

  addOutgoingAttachment(attachment) {
    // Same reasoning as addOutgoingMessage - sending a file is a reply too.
    this._clearInactivityTimers();
    const transcriptItem = modelUtils.createOutgoingTranscriptItem(ATTACHMENT_MESSAGE, attachment, this.thisParticipant);
    this._addItemsToTranscript([transcriptItem]);
    this.logger && this.logger.info(`Sending File. ContactId: ${this.contactId}.`);
    return this.sendAttachment(transcriptItem);
  }

  sendAttachment(transcriptItem) {
    const {participantId, displayName} = this.thisParticipant;
    return this.client
      .sendAttachment(transcriptItem.content)
      .then((response) => {
        console.log("RESPONSE", response);
        console.log("sendAttachment response:", response);
        this.transcript.splice(this.transcript.indexOf(transcriptItem), 1);
        return response;
      })
      .catch((error) => {
        transcriptItem.transportDetails.error = {
          type: error.type,
          message: error.message,
        };

        if (error.type !== AttachmentErrorType.ValidationException) {
          if (error.type === AttachmentErrorType.ServiceQuotaExceededException) {
            transcriptItem.transportDetails.error.message = "Attachment failed to send. The maximum number of attachments allowed, has been reached";
          } else {
            transcriptItem.transportDetails.error.message = "Attachment failed to send";
            transcriptItem.transportDetails.error.retry = () => {
              const newTranscriptItem = modelUtils.createOutgoingTranscriptItem(ATTACHMENT_MESSAGE, transcriptItem.content, {displayName, participantId});
              newTranscriptItem.id = transcriptItem.id;
              this._replaceItemInTranscript(transcriptItem, newTranscriptItem);
              this.sendAttachment(newTranscriptItem);
            };
          }
        }

        this._failMessage(transcriptItem);
      });
  }

  downloadAttachment(attachmentId) {
    return this.client.downloadAttachment(attachmentId);
  }

  describeView(viewTokenObj) {
    return this.client.describeView(viewTokenObj);
  }

  getAuthenticationUrl(sessionId) {
    return this.client.getAuthenticationUrl({
      redirectUri: this.customizationParams.authenticationRedirectUri,
      sessionId: sessionId
    });
  }

  cancelParticipantAuthentication(sessionId) {
    return this.client.cancelParticipantAuthentication({
      sessionId: sessionId
    });
  }

  loadPreviousTranscript() {
    console.log("loadPreviousTranscript in single");
    var args = {};
    args.scanDirection = "BACKWARD";
    args.sortOrder = "ASCENDING";
    args.maxResults = 15;
    return this._loadTranscript(args);
  }

  // EVENT HANDLING

  on(eventType, handler) {
    this.logger && this.logger.info(`Event [${eventType}] is on!`);
    if (this._eventHandlers[eventType].indexOf(handler) === -1) {
      this._eventHandlers[eventType].push(handler);
    }
  }

  off(eventType, handler) {
    this.logger && this.logger.info(`Event [${eventType}] is off!`);
    const idx = this._eventHandlers[eventType].indexOf(handler);
    if (idx > -1) {
      this._eventHandlers[eventType].splice(idx, 1);
    }
  }

  _triggerEvent(eventType, payload) {
    this.logger && this.logger.info(`Event [${eventType}] is triggered!`);
    this._eventHandlers[eventType].forEach((handler) => {
      handler(payload);
    });
  }

  _updateTranscript(transcript) {
    this.transcript = transcript;
    this._triggerEvent("transcript-changed", transcript);
  }

  _updateTypingParticipants(typingParticipants) {
    this.typingParticipants = typingParticipants;
    this._triggerEvent("typing-participants-changed", typingParticipants);
  }

  _updateContactStatus(contactStatus) {
    this.contactStatus = contactStatus;
    this._triggerEvent("contact-status-changed", contactStatus);
  }

  _addEventListeners() {
    this.client.onMessage((data) => {
      this._handleIncomingData(data);
    });
    this.client.onTyping((data) => {
      this._handleTypingEvent(data);
    });
    this.client.onAutoDisconnection(data => {
      this._handleIdleEvent(data);
    });
    this.client.onParticipantReturned(data => {
      this._handleIdleEvent(data);
    });
    this.client.onParticipantIdle(data => {
      this._handleIdleEvent(data);
    });
    this.client.onChatRehydrated( async data => {
      await this._handleChatRehydrated(data);
    });
    this.client.onReadReceipt((data) => {
      this._handleMessageReceipt("read", data);
    });
    this.client.onDeliveredReceipt((data) => {
      this._handleMessageReceipt("delivered", data);
    });

    this.client.onEnded((data) => {
      this._handleEndedEvent(data);
    });
    this.client.onAuthenticationInitiated(async data => {
      await this._handleAuthenticationInitiated(data);
    });
    this.client.onAuthenticationTimeout(async data => {
      await this._handleAuthenticationLifecycleEvent(data);
    });
    this.client.onAuthenticationFailed(async data => {
      await this._handleAuthenticationLifecycleEvent(data);
    });
    this.client.onAuthenticationSuccessful(async data => {
      await this._handleAuthenticationLifecycleEvent(data);
    });
    this.client.onAuthenticationCanceled(async data => {
      await this._handleAuthenticationLifecycleEvent(data);
    });
    this.client.onParticipantDisplayNameUpdated(async data => {
      this.authenticatedParticipantDisplayName = data.data.DisplayName;
    });
    this.client.onConnectionEstablished(async () => {
      await this._loadLatestTranscript();
      // Restores the inactivity countdown from whatever the last incoming
      // message already was - matters most on a resumed session (page
      // reload/new tab mid-conversation), where otherwise no timer would
      // run at all until/unless a brand new message happened to arrive.
      this._seedInactivityCheckFromTranscript();
    });
  }

  _handleIdleEvent(data) {
    var eventDetails = data.data;
    var item = modelUtils.createItemFromIncoming(eventDetails);
    if (item) {
      this._shouldAddToTranscript(item) && this._addItemsToTranscript([item]);
    }
  }
  
  async _handleChatRehydrated(data) {
    // Setting up 1 sec delay so it does not load transcript immediately when customer joins the chat
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      // Call to load previous transcript
      await this.loadPreviousTranscript({maxResults:30});
      // Call again if needed with nextToken
      if(this.nextToken){
        await this.loadPreviousTranscript({maxResults:30});
      }
    } catch (err) {
      console.log("Error while loading previous transcript in _handleChatRehydrated", err);
    }
  }

  // TRANSCRIPT
  _loadLatestTranscript() {
    console.log("loadPreviousTranscript in single");
    return this._loadTranscript({
      scanDirection: "BACKWARD",
      sortOrder: "ASCENDING",
      maxResults: 15,
    });
  }

  _loadTranscript(args) {
    if (this.nextToken) {
      args["nextToken"] = this.nextToken;
    }
    return this.client
      .getTranscript(args)
      .then(async response => {
        var incomingDataList = response.data.Transcript;
        this.nextToken = response.data.NextToken;
        const transcriptItems = incomingDataList.map((data) => {
          var transcriptItem = modelUtils.createItemFromIncoming(data, this.thisParticipant);
          return transcriptItem;
        });
        // call describeview to get the view if the newest message is a view message
        let lastItem = transcriptItems.pop();
        if (modelUtils.isViewMessage(lastItem) && lastItem.content.type === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE)
          await this._describeAndProcessView(lastItem);
        transcriptItems.push(lastItem);

        this._addItemsToTranscript(transcriptItems);
      })
      .catch((err) => {
        console.log("CustomerUI", "ChatSession", "transcript fetch error: ", err);
      });
  }

  _handleIncomingData(dataInput) {
    var data = dataInput.data;
    var item = modelUtils.createItemFromIncoming(data, this.thisParticipant);

    console.log("_handleIncomingData item created");
    console.log(item);

    if (item) {
      if (!this._isRoundtripMessage(data) && (item.messageCompleted === undefined || item.messageCompleted === true)) {
        this._updateTypingParticipantsUsingIncoming(item);
      }
      console.log("_handleIncomingData item created");

      const {transportDetails, type, participantRole} = item;
      if (transportDetails.direction === Direction.Incoming) {
        this._triggerEvent("incoming-message", data);
        // Any real message/attachment from the other side (bot, agent, or
        // system) restarts the 90s inactivity countdown - deliberately not
        // restricted to Agent/Customer roles like the delivered-receipt
        // check below, since a bot/Lex message waiting on a reply is
        // exactly the case this is for.
        if (modelUtils.isTypeMessageOrAttachment(type)) {
          this._scheduleInactivityCheck(item);
        }
        if (modelUtils.isTypeMessageOrAttachment(type) && modelUtils.isParticipantAgentOrCustomer(participantRole)) {
          this.sendDeliveredReceipt(
            item.id,
            type === ATTACHMENT_MESSAGE
              ? {
                  disableThrottle: true,
                }
              : {}
          );
        }
        // check if this is a guides message
        if (modelUtils.isViewMessage(item)) {
          return this._describeAndProcessView(item).then(() => {
            this._addItemsToTranscript([item]);
          });
        }
      }
      else {
        this._triggerEvent("outgoing-message", data);
      }

      const shouldBypassAddItemToTranscript = this.isOutgoingMessageInFlight === true && item.participantRole === PARTICIPANT_TYPES.CUSTOMER;

      if (!shouldBypassAddItemToTranscript) {
        this._shouldAddToTranscript(item) && this._addItemsToTranscript([item]);
      }
    } else {
      console.log("_handleIncomingData NOT NOT item created");
    }
  }

  async _describeAndProcessView(item) {
    const viewDetails = JSON.parse(item.content.data);
    if (viewDetails.templateType !== InteractiveMessageType.VIEW_RESOURCE) {
      return;
    }
    let newParsedView = {};
    const ViewResourceInputData = modelUtils.createViewMessageData(viewDetails.data);
    try {
      const describeViewResponse = await this.describeView({viewToken: ViewResourceInputData.viewToken});
      const newView = describeViewResponse ? describeViewResponse.data.View : {};
      const Template = JSON.parse(newView.Content.Template);
      const InputSchema = JSON.parse(newView.Content.InputSchema);
      newParsedView = {
        ...newView,
        Content: {
          Actions: newView.Content.Actions,
          Template,
          InputSchema,
        },
        InputData: ViewResourceInputData.viewInputData
      };
    } catch (err) {
      newParsedView = {
        Content: {InputSchema: {}, Template: {} },
        ErrorType: 'INVALID_VIEW_ID',
        InputData: ViewResourceInputData.viewInputData
      };
      this.logger && this.logger.warn("ERROR", err, ViewResourceInputData.viewId, ViewResourceInputData.viewInputData);
    }
    viewDetails.data.content = newParsedView;
    item.content.data = JSON.stringify(viewDetails);
  }


  _handleMessageReceipt(messageReceiptType, dataInput) {
    var messageReceiptData = dataInput.data;
    var messageId = messageReceiptData.MessageMetadata.MessageId;
    var oldItemInTranscript = this._findItemInTranscriptUsingMessageId(messageId);

    if (oldItemInTranscript === -1) {
      this.logger && this.logger.debug(`Message with messageId:${messageId} not found in transcript`);
      return;
    }
    const {sentTime} = oldItemInTranscript.transportDetails;
    this._handleMessageReceiptLatencyMetric(messageReceiptType, dataInput, sentTime);
    var newItem = modelUtils.createIncomingTranscriptReceiptItem(this.thisParticipant, oldItemInTranscript, messageReceiptData, messageReceiptType);
    this._replaceItemInTranscript(oldItemInTranscript, newItem, messageReceiptType);
  }

  _handleMessageReceiptLatencyMetric(messageReceiptType, dataInput, sentTime) {
    const {
      chatDetails: {participantId},
      data: {
        MessageMetadata: {Receipts},
      },
    } = dataInput;
    if (Receipts.length > 0) {
      const receipt = this._findReceipt(Receipts, participantId);
      if (receipt) {
        const {DeliveredTimestamp, ReadTimestamp} = receipt;
        const timeDifference = messageReceiptType === "read" ? getTimeFromTimeStamp(ReadTimestamp) - sentTime * 1000 : getTimeFromTimeStamp(DeliveredTimestamp) - sentTime * 1000;
        this.logger && this.logger.info(messageReceiptType, timeDifference);
      }
    }
  }

  _findReceipt(receipts, participantId) {
    return receipts.find((receipt) => receipt.RecipientParticipantId !== participantId);
  }

  _failMessage(message) {
    // Failed messages are going to be inserted into the transcript with a fake timestamp
    // that is 1ms higher than the timestamp of the last existing message or 0 if no such
    // message exists.
    const sentTime = this.transcript.length > 0 ? this.transcript[this.transcript.length - 1].transportDetails.sentTime + 0.001 : 0;
    this._replaceItemInTranscript(message, modelUtils.createFailedItem(message, sentTime));
  }

  _isRoundTripSystemEvent(item) {
    return SYSTEM_EVENTS.indexOf(item.contentType) !== -1 && this.thisParticipant.participantId === item.participantId;
  }

  _addItemsToTranscript(items) {
    let self = this;

    if (items.length === 0) {
      return;
    }

    items = items.filter((item) => !this._isRoundTripSystemEvent(item));

    const newItemMap = items.reduce((acc, item) => ({...acc, [item.id]: item}), {});

    let newTranscript = this.transcript.filter((item) => newItemMap[item.id] === undefined);
    self._removePreviousInteractiveMessage(newTranscript, items);
    newTranscript.push(...items);
    newTranscript.sort((a, b) => {
      const isASending = a.transportDetails.status === Status.Sending;
      const isBSending = b.transportDetails.status === Status.Sending;
      if ((isASending && !isBSending) || (!isASending && isBSending)) {
        return isASending ? 1 : -1;
      }
      return a.transportDetails.sentTime - b.transportDetails.sentTime;
    });

    newTranscript.forEach(function (item) {
      if (item.transportDetails.direction === Direction.Incoming) {
        item = self.incomingItemDecorator(item);
      } else {
        item = self.outgoingItemDecorator(item);
      }
      item.lastReadReceipt = false;
      item.lastDeliveredReceipt = false;
    });

    //add Read/Delivered only to the last messageId
    const lastReadMessageIdx = this._findLastMessageReceiptInTranscript("read", newTranscript);
    const lastDeliveredMessageIdx = this._findLastMessageReceiptInTranscript("delivered", newTranscript);

    const lastIncomingMessageIdx = this._findLastMessageInTranscript(Direction.Incoming, newTranscript);
    const lastOutgoingMessageIdx = this._findLastMessageInTranscript(Direction.Outgoing, newTranscript);

    //Corner case: lastMessage is not read and Customer typed a new message
    //so we need to explicitly fire readReceipt for the last received/incoming message.
    //Note: ChatJS has a mapper and prevents duplicate event if its already fired!
    if (lastIncomingMessageIdx !== -1 && lastOutgoingMessageIdx > lastIncomingMessageIdx) {
      const {type, id} = newTranscript[lastIncomingMessageIdx];
      this.sendReadReceipt(id, type === ATTACHMENT_MESSAGE ? {disableThrottle: true} : {});
    }

    if (lastReadMessageIdx !== -1) {
      newTranscript[lastReadMessageIdx].lastReadReceipt = true;
    }
    //Read has higher priority - only show Read message
    if (lastDeliveredMessageIdx !== -1 && lastReadMessageIdx < lastDeliveredMessageIdx) {
      newTranscript[lastDeliveredMessageIdx].lastDeliveredReceipt = true;
    }

    // remove any view messages that are not the latest message
    newTranscript = newTranscript.filter((item, idx) => {
      return (idx === lastIncomingMessageIdx && lastOutgoingMessageIdx <= lastIncomingMessageIdx) || !(modelUtils.isViewMessage(item) &&
        item.content.type === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE)
    });

    this._updateTranscript(newTranscript);
  }

  _removePreviousInteractiveMessage(oldTranscript, newTranscript) {
    try {
      const newInteractiveMessage = newTranscript.find((message) => {
        const contentType = message.content.type;
        return contentType === ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE && !modelUtils.isViewMessage(message);
      })
      if(newInteractiveMessage) {
        const content = JSON.parse(newInteractiveMessage.content.data);
        const referenceId = content.data.content.referenceId;
        const previousInteractiveMsgIndex = oldTranscript.findIndex((oldMessage) => {
          if(oldMessage.participantRole === 'SYSTEM' && isJson(oldMessage.content.data)) {
            const newMessageContent = JSON.parse(oldMessage.content.data);
            if(referenceId === newMessageContent.data.content.referenceId) {
              return true;
            }
          }
          return false;
        })
        if(previousInteractiveMsgIndex !== -1) {
          oldTranscript.splice(previousInteractiveMsgIndex, 1);
        }
      }
    } catch (error) {
      this.logger && this.logger.error("Remove previous interactive message error: ", error);
    }
    
  }

  _replaceItemInTranscript(oldItem, newItem) {
    const idx = this.transcript.indexOf(oldItem);
    if (idx > -1) {
      this.transcript.splice(idx, 1);
    }
    this._addItemsToTranscript([newItem]);
  }

  _findItemInTranscriptUsingMessageId(messageId) {
    const index = this.transcript.findIndex((transcript) => transcript.id === messageId);
    if (index !== -1) {
      return this.transcript[index];
    }
    return -1;
  }

  _findLastMessageReceiptInTranscript(messageReceiptType, transcript) {
    const size = transcript.length - 1;
    let lastReceiptIdx = -1;
    for (let index = size; index >= 0; index--) {
      const transportDetails = transcript[index].transportDetails;
      if (transportDetails && transportDetails.direction === Direction.Outgoing && transportDetails.messageReceiptType === messageReceiptType) {
        lastReceiptIdx = index;
        break;
      }
    }
    return lastReceiptIdx;
  }

  _findLastMessageInTranscript(direction, transcript) {
    const size = transcript.length - 1;
    let lastReceiptIdx = -1;
    for (let index = size; index >= 0; index--) {
      const transportDetails = transcript[index].transportDetails;

      if (transportDetails && transportDetails.direction === direction) {
        lastReceiptIdx = index;
        break;
      }
    }
    return lastReceiptIdx;
  }

  _isRoundtripMessage(item) {
    return this.thisParticipant.participantId === item.ParticipantId;
  }

  /** called when transcript has chat ended message */
  _handleEndedEvent() {
    this._clearInactivityTimers();
    this._updateContactStatus(CONTACT_STATUS.ENDED);
    this._triggerEvent("chat-disconnected");
    Eventbus.trigger('agentEndChat', {});
  }

  async _handleAuthenticationInitiated(data) {
    var eventDetails = data.data,
        identityProvider = this.customizationParams.authenticationIdentityProvider,
        content = {}, 
        authenticationUrl = '', 
        sessionId = '',
        item,
        getAuthenticationUrlResponse;
    try {
      content = JSON.parse(eventDetails.Content || '{}');
    } catch (error) {
        console.error("Invalid JSON content", error);
    }
    sessionId = content.SessionId;
    item = modelUtils.createItemFromIncoming(eventDetails);
    if (item) {
      try {
        getAuthenticationUrlResponse = await this.getAuthenticationUrl(sessionId);
        authenticationUrl = getAuthenticationUrlResponse.data.AuthenticationUrl
      }
      catch (error) {
        console.error("Unable to get sign in URL", error)
      }
      item.authenticationUrl = authenticationUrl;
      if(identityProvider){
        item.authenticationUrl += `&identity_provider=${identityProvider}`;
      }
      this._shouldAddToTranscript(item) && this._addItemsToTranscript([item]);
    }
  }

  async _handleAuthenticationLifecycleEvent(data) {
    var eventDetails = data.data;
    var item = modelUtils.createItemFromIncoming(eventDetails);
    if (item) {
      Eventbus.trigger('authenticationComplete', {});
      this._shouldAddToTranscript(item) && this._addItemsToTranscript([item]);
    }
  }

  // TYPING PARTICIPANTS
  //
  // Real-time lifecycle of the "participant is composing" bubble
  // (rendered by ChatMessage.js's ParticipantTyping):
  //  1. Each onTyping event received from the other side re-arms a fresh
  //     12s timer for that participant (below) - the SDK doesn't send an
  //     explicit "stopped typing" event, so this timer is the only thing
  //     that clears a stale indicator if the other participant goes idle,
  //     closes their tab, or drops connection mid-type.
  //  2. If another onTyping event for the same participant arrives before
  //     the timer fires, the old timer is cleared and replaced - so the
  //     bubble stays visible continuously while they keep typing, instead
  //     of flickering off every 12s.
  //  3. The instant a real PARTICIPANT_MESSAGE lands in the transcript
  //     (_updateTypingParticipantsUsingIncoming, called from
  //     _handleIncomingData), the typing bubble is removed - this is what
  //     makes the indicator get replaced by the actual message bubble.

  _handleTypingEvent(dataInput) {
    var data = dataInput.data;
    if (this._isRoundtripMessage(data)) {
      return;
    }
    var incomingTypingParticipant = modelUtils.createTypingParticipant(data, this.thisParticipant.participantId);
    incomingTypingParticipant.callback = setTimeout(() => {
      this._removeTypingParticipant(incomingTypingParticipant.participantId);
    }, 12 * 1000);
    var newTypingParticipants = [];
    for (var i = 0; i < this.typingParticipants.length; i++) {
      var existingParticipantTyping = this.typingParticipants[i];
      if (existingParticipantTyping.participantId === incomingTypingParticipant.participantId) {
        clearTimeout(existingParticipantTyping.callback);
      } else {
        newTypingParticipants.push(existingParticipantTyping);
      }
    }
    newTypingParticipants.push(incomingTypingParticipant);
    this._updateTypingParticipants(newTypingParticipants);
    console.log("this.typingParticipants");
    console.log(this.typingParticipants);
  }

  _updateTypingParticipantsUsingIncoming(item) {
    if (item.type === PARTICIPANT_MESSAGE) {
      this._removeTypingParticipant(item.participantId);
    }
  }

  // NOTE: despite taking a participantId, this clears the ENTIRE typing
  // list (not just that participant) - in today's 1:1 chat model there's
  // only ever one other typing participant at a time, so this has been
  // equivalent in practice to a per-participant removal. Revisit if this
  // widget ever supports multi-party chat.
  _removeTypingParticipant(participantId) {
    //this.typingParticipants = this.typingParticipants.filter(
    //  tp => tp.participantDetails.participantId !== participantId
    //);
    this._updateTypingParticipants([]);
  }

  // ─── Customer inactivity handling ───
  // See INACTIVITY_REPROMPT_DELAY_MS/INACTIVITY_DISCONNECT_DELAY_MS above.

  _clearInactivityTimers() {
    if (this._inactivityReminderTimer) {
      clearTimeout(this._inactivityReminderTimer);
      this._inactivityReminderTimer = null;
    }
    if (this._inactivityDisconnectTimer) {
      clearTimeout(this._inactivityDisconnectTimer);
      this._inactivityDisconnectTimer = null;
    }
  }

  // (Re)starts the 90s "has the customer gone quiet" countdown. Called every
  // time a genuine incoming message/attachment arrives - see
  // _handleIncomingData - and once on connect/resume to seed it from
  // whatever the last incoming transcript item already was (see
  // _seedInactivityCheckFromTranscript), so reloading mid-conversation
  // doesn't leave the customer with no timer running at all.
  _scheduleInactivityCheck(lastIncomingItem) {
    this._clearInactivityTimers();
    this._lastIncomingMessageItem = lastIncomingItem;

    // unref() (Node/jsdom only, a no-op elsewhere) so a long-lived timer
    // like this never keeps a test process/CLI alive on its own.
    this._inactivityReminderTimer = setTimeout(() => {
      this._handleInactivityReprompt();
    }, INACTIVITY_REPROMPT_DELAY_MS);
    if (typeof this._inactivityReminderTimer.unref === "function") {
      this._inactivityReminderTimer.unref();
    }
  }

  // Restores the inactivity countdown after connect/resume (fresh chat OR
  // reconnecting to a still-active one, e.g. after a page reload) using
  // whatever the last incoming message already was, so a customer who left
  // mid-conversation doesn't come back to a timer that only starts counting
  // again once/if a brand new message arrives.
  _seedInactivityCheckFromTranscript() {
    const lastIncomingIdx = this._findLastMessageInTranscript(Direction.Incoming, this.transcript);
    if (lastIncomingIdx !== -1) {
      this._scheduleInactivityCheck(this.transcript[lastIncomingIdx]);
    }
  }

  // 90s elapsed with no reply - show the local "didn't get your response"
  // notice, then re-display the last incoming message (see
  // modelUtils.cloneIncomingItemForReprompt), then start the final 30s
  // countdown to an automatic disconnect.
  _handleInactivityReprompt() {
    this._inactivityReminderTimer = null;
    if (this.contactStatus !== CONTACT_STATUS.CONNECTED) {
      return;
    }
    if (this._lastIncomingMessageItem) {
      const noticeItem = modelUtils.createLocalIncomingNotice(this._lastIncomingMessageItem, INACTIVITY_NO_RESPONSE_MESSAGE);
      this._shouldAddToTranscript(noticeItem) && this._addItemsToTranscript([noticeItem]);

      const repromptItem = modelUtils.cloneIncomingItemForReprompt(this._lastIncomingMessageItem);
      // Nudges the reprompt a hair later than the notice above so it
      // always sorts after it, even if both resolve to the same
      // millisecond (_addItemsToTranscript orders by sentTime).
      repromptItem.transportDetails.sentTime = noticeItem.transportDetails.sentTime + 0.001;
      this._shouldAddToTranscript(repromptItem) && this._addItemsToTranscript([repromptItem]);

      this.logger && this.logger.info("Customer inactive for 90s - showing notice and re-displaying last message locally.");
    }
    this._inactivityDisconnectTimer = setTimeout(() => {
      this._handleInactivityDisconnect();
    }, INACTIVITY_DISCONNECT_DELAY_MS);
    if (typeof this._inactivityDisconnectTimer.unref === "function") {
      this._inactivityDisconnectTimer.unref();
    }
  }

  // A further 30s elapsed (120s total) with still no reply - show the local
  // closing notice, then immediately end the underlying Connect contact
  // WITHOUT closing the widget panel (see _endChatKeepingPanelOpen). No
  // artificial delay between the two: the panel stays open and the notice
  // stays visible in the transcript regardless, so there's nothing to wait
  // for - and ending immediately also clears the persisted-chat localStorage
  // key (via clearPersistedChat, wired to chat-disconnected in launcher.js)
  // sooner, so this ended session can't get offered for auto-resume.
  _handleInactivityDisconnect() {
    this._inactivityDisconnectTimer = null;
    if (this.contactStatus !== CONTACT_STATUS.CONNECTED) {
      return;
    }
    this.logger && this.logger.info("Customer still inactive after re-prompt - ending chat automatically.");
    if (this._lastIncomingMessageItem) {
      const noticeItem = modelUtils.createLocalIncomingNotice(this._lastIncomingMessageItem, INACTIVITY_CLOSING_MESSAGE);
      this._shouldAddToTranscript(noticeItem) && this._addItemsToTranscript([noticeItem]);
    }
    this._endChatKeepingPanelOpen();
  }

  // The message of clicking "Show more" or "Previous options" in interactive message should not add to transcript
  _shouldAddToTranscript(message) {
    try {
      if (message.content && message.content.data && !modelUtils.isViewMessage(message)) {
        const str = message.content.data;
        if(isJson(str)) {
          const {data} = JSON.parse(str);
          if(data.actionName) {
            return false;
          }
        }
      }
      return true;
    } catch (err) {
      console.warn("error while evaluating ChatSession:_shouldAddToTranscript", err);
      return true;
    }
    
  }
}

export default ChatSession;
