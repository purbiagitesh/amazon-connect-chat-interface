import "amazon-connect-chatjs";
import {CONTACT_STATUS} from "../../constants/global";
import {modelUtils} from "./datamodel/Utils";
import {ContentType, PARTICIPANT_MESSAGE, Direction, Status, ATTACHMENT_MESSAGE, AttachmentErrorType, PARTICIPANT_TYPES, InteractiveMessageType} from "./datamodel/Model";
import {getTimeFromTimeStamp, flattenFeedbackQuickReplyResponse} from "../../utils/helper";
import Eventbus from './eventbus';
import isJson from "is-json";
import {updateContactAttributes} from "./AuthAttributesSync";

const SYSTEM_EVENTS = Object.values(ContentType.EVENT_CONTENT_TYPE);
const DEFAULT_PREFIX = "Amazon-Connect-ChatInterface-ChatSession";

// ─── Guest -> authenticated mid-chat: contact-attribute sync ───
// The contact flow/bot decides WHEN it's worth checking whether the guest
// has since logged in - never this widget's own timing/config. It signals
// that by appending this exact marker to an otherwise-normal text message,
// e.g. "Once you're logged in, we can pick up where we left off.
// _start_auth_polling". Seeing it is what starts polling
// window.ElcAmazonConnect.getCustomerContext() (see _checkForAuthPollingTrigger/
// _startAuthPolling below) - never on widget-open, never via a brand config
// flag. The marker itself is stripped from the message before it ever
// reaches the transcript (see _checkForAuthPollingTrigger) - it's purely an
// internal signal between the contact flow and this widget, the customer
// must never see it.
const AUTH_POLLING_TRIGGER_KEY = "_start_auth_polling";
const AUTH_POLLING_INTERVAL_MS = 30 * 1000;
// Hard cap on how long polling runs before giving up - see
// AUTH_POLLING_TIMEOUT_SILENT_MESSAGE below. Checked on a poll tick (not a
// separate timer), so the actual give-up point is up to one
// AUTH_POLLING_INTERVAL_MS late - acceptable given the 10-minute scale.
const AUTH_POLLING_MAX_DURATION_MS = 10 * 60 * 1000;
// Sent to the bot once login is detected (see _sendSilentMessageToBot) -
// never shown in the customer's own transcript, purely so the bot/VA knows
// to continue the flow as an authenticated customer.
const AUTH_POLLING_SILENT_MESSAGE = "Customer has logged in";
// Sent to the bot if AUTH_POLLING_MAX_DURATION_MS elapses with the customer
// still not authenticated - lets the flow move on (e.g. stop waiting, show
// a fallback) instead of leaving the customer in limbo indefinitely.
const AUTH_POLLING_TIMEOUT_SILENT_MESSAGE = "Customer has not logged in";

// ─── Login-prompt nudge: "are you still there?" before the login ask ───
// Before actually asking the customer to log in, the flow shows a guest/
// login choice message and appends this marker to signal: give the
// customer AUTH_PROMPT_TIMER_MS to respond on their own (type, click a
// quick reply, send an attachment - see addOutgoingMessage/
// addOutgoingAttachment's _clearAuthPromptTimer() calls) before nudging
// them. If nothing arrives in time, AUTH_PROMPT_TIMEOUT_SILENT_MESSAGE is
// sent silently so the flow can respond with its own next message (which
// is expected to carry AUTH_POLLING_TRIGGER_KEY, handing off into the
// polling flow above - no extra glue needed for that step).
const AUTH_PROMPT_TIMER_TRIGGER_KEY = "start_15s_timer";
const AUTH_PROMPT_TIMER_MS = 15 * 1000;
const AUTH_PROMPT_TIMEOUT_SILENT_MESSAGE = "15s_timeout";

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

  // See AUTH_POLLING_TRIGGER_KEY above - null whenever no polling is
  // currently running (before the trigger message arrives, and again once
  // authentication is detected/the chat ends).
  _authPollingTimer = null;
  // Timestamp _startAuthPolling() began running - null whenever
  // _authPollingTimer is, used to measure AUTH_POLLING_MAX_DURATION_MS.
  _authPollingStartedAt = null;
  // See AUTH_PROMPT_TIMER_TRIGGER_KEY above - null whenever no prompt
  // nudge is currently pending.
  _authPromptTimer = null;

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
    this._stopAuthPolling();
    this._clearAuthPromptTimer();
    await this.client.disconnect();
    this._updateContactStatus(CONTACT_STATUS.DISCONNECTED);
    this._triggerEvent("chat-disconnected");
    this._triggerEvent("chat-closed");
  }

  closeChat() {
    this._triggerEvent("chat-closed");
  }

  // Guards the three SendEvent-based calls below: ChatMessage.js's InView
  // tracking fires sendReadReceipt() as messages scroll in/out of view
  // (independent of any user action beyond scrolling), and once the contact
  // has actually ended (endChat() - contactStatus becomes DISCONNECTED) the
  // underlying ChatJS session has nothing valid left to send these
  // against. Rather than reject cleanly, ChatJS's own
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
    // The customer sent something on their own - no need for the "are you
    // still there?" nudge (see AUTH_PROMPT_TIMER_TRIGGER_KEY above).
    this._clearAuthPromptTimer();
    const message = this.alterOutgoingMessageForViewsIfRequired(data);

    this.logger && this.logger.info(`Adding outgoing message. ContactId: ${this.contactId}`);

    this._shouldAddToTranscript(message) && this._addItemsToTranscript([message]);

    this.isOutgoingMessageInFlight = true;

    // Latency testing: time for a user-typed outgoing message to reach Connect (SendMessage API round trip)
    const outgoingMessageSendStartTime = performance.now();
    this._lastOutgoingSendTime = outgoingMessageSendStartTime;

    this.client
      .sendMessage(message.content)
      .then((response) => {
         this.logger && this.logger.info("send success");
         this.logger && this.logger.info(response);
         this.logger && this.logger.info("[sendMessage] outgoing message UI -> Connect time (ms):", Math.round(performance.now() - outgoingMessageSendStartTime));
        this._shouldAddToTranscript(message) && this._replaceItemInTranscript(message, modelUtils.createTranscriptItemFromSuccessResponse(message, response));

        this.isOutgoingMessageInFlight = false;
        return response;
      })
      .catch((error) => {
       this.logger && this.logger.info("[sendMessage] outgoing message failed after (ms):", Math.round(performance.now() - outgoingMessageSendStartTime));
        this.isOutgoingMessageInFlight = false;

        this._failMessage(message);
      });
  }

  addOutgoingAttachment(attachment) {
    // See addOutgoingMessage above - sending an attachment counts as the
    // customer responding on their own too.
    this._clearAuthPromptTimer();
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
        this.logger && this.logger.info("RESPONSE", response);
        this.logger && this.logger.info("sendAttachment response:", response);
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
   this.logger && this.logger.info("loadPreviousTranscript in single");
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
    this.logger && this.logger.info("loadPreviousTranscript in single");
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

    // Connect echoes a CUSTOMER participant's own sent message back over
    // this same websocket - _sendSilentMessageToBot relies on catching
    // that echo HERE and dropping it entirely, before it reaches any other
    // processing (typing updates, delivered receipts, the transcript),
    // since there's no optimistic transcript entry to begin with for it to
    // de-duplicate against like a normal typed message has.
    if (this._shouldSuppressSilentMessageEcho(data, item)) {
      return;
    }

    // Strips AUTH_POLLING_TRIGGER_KEY out of the message (if present) and
    // starts polling - deliberately before anything else touches `item`,
    // so the stripped text is what ends up in the transcript further down,
    // never the raw marker.
    this._checkForAuthPollingTrigger(item);
    // Same idea for AUTH_PROMPT_TIMER_TRIGGER_KEY - strips it and starts
    // the 15s "are you still there?" nudge timer.
    this._checkForAuthPromptTimerTrigger(item);

   this.logger && this.logger.info("_handleIncomingData item created");
    console.log(item);

    // Latency testing: log the ms difference between the last Incoming and last Outgoing message (sentTime is in seconds)
    if (
      this._lastOutgoingSendTime &&
      item && item.transportDetails &&
      item.transportDetails.direction === Direction.Incoming &&
      modelUtils.isTypeMessageOrAttachment(item.type)
    ) {
      // ANSI codes render green in Chrome/Edge DevTools; the ChatJS logger flattens args, so %c styling isn't possible.
      this.logger && this.logger.info(`\x1b[32m[responseTime] outgoing message sent -> incoming message received (ms): ${Math.round(performance.now() - this._lastOutgoingSendTime)}\x1b[0m`);
      // Only the first reply after each sent message is measured.
      this._lastOutgoingSendTime = null;
    }

    if (item) {
      if (!this._isRoundtripMessage(data) && (item.messageCompleted === undefined || item.messageCompleted === true)) {
        this._updateTypingParticipantsUsingIncoming(item);
      }
      this.logger && this.logger.info("_handleIncomingData item created");

      const {transportDetails, type, participantRole} = item;
      if (transportDetails.direction === Direction.Incoming) {
        this._triggerEvent("incoming-message", data);
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
      this.logger && this.logger.info("_handleIncomingData NOT NOT item created");
    }
  }

  // ─── Guest -> authenticated mid-chat: contact-attribute sync ───
  // See AUTH_POLLING_TRIGGER_KEY above.
  _checkForAuthPollingTrigger(item) {
    if (!item || !item.content || typeof item.content.data !== "string") {
      return;
    }
    if (
      item.content.type !== ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN &&
      item.content.type !== ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN
    ) {
      return;
    }
    if (item.content.data.indexOf(AUTH_POLLING_TRIGGER_KEY) === -1) {
      return;
    }
    // Strip every occurrence and any whitespace left behind, so whatever
    // text the flow wrote around the marker (e.g. a trailing space before
    // it) never shows up either.
    item.content.data = item.content.data.split(AUTH_POLLING_TRIGGER_KEY).join("").trim();
    this._startAuthPolling();
  }

  _startAuthPolling() {
    if (this._authPollingTimer) {
      return; // already polling - the trigger message arriving again shouldn't start a second interval
    }
    this.logger && this.logger.info("Auth polling trigger received - polling for customer authentication.");
    this._authPollingStartedAt = Date.now();
    this._authPollingTimer = setInterval(() => {
      this._pollCustomerAuthentication();
    }, AUTH_POLLING_INTERVAL_MS);
    if (typeof this._authPollingTimer.unref === "function") {
      this._authPollingTimer.unref();
    }
    // Deliberately no immediate check here - AUTH_POLLING_MAX_DURATION_MS /
    // AUTH_POLLING_INTERVAL_MS must equal exactly 20 checks (the spec:
    // "every 30 seconds for 10 minutes, total of 20 checks, fail
    // authentication after check 20"). An extra immediate check would make
    // it 21.
  }

  _stopAuthPolling() {
    if (this._authPollingTimer) {
      clearInterval(this._authPollingTimer);
      this._authPollingTimer = null;
    }
    this._authPollingStartedAt = null;
  }

  async _pollCustomerAuthentication() {
    let context;
    try {
      if (!window.ElcAmazonConnect || typeof window.ElcAmazonConnect.getCustomerContext !== "function") {
        return;
      }
      context = await window.ElcAmazonConnect.getCustomerContext();
    } catch (e) {
      this.logger && this.logger.error("getCustomerContext() failed during auth polling.", e);
      return;
    }
    if (!context || context.authenticated !== true) {
      // Still a guest - give up once AUTH_POLLING_MAX_DURATION_MS has
      // passed since polling started, rather than polling forever.
      if (this._authPollingStartedAt && Date.now() - this._authPollingStartedAt >= AUTH_POLLING_MAX_DURATION_MS) {
        this._stopAuthPolling();
        this._sendSilentMessageToBot(AUTH_POLLING_TIMEOUT_SILENT_MESSAGE);
      }
      return;
    }
    this._stopAuthPolling();
    await this._handleCustomerAuthenticated(context);
  }

  // See AUTH_PROMPT_TIMER_TRIGGER_KEY above.
  _checkForAuthPromptTimerTrigger(item) {
    if (!item || !item.content || typeof item.content.data !== "string") {
      return;
    }
    if (
      item.content.type !== ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN &&
      item.content.type !== ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN
    ) {
      return;
    }
    if (item.content.data.indexOf(AUTH_PROMPT_TIMER_TRIGGER_KEY) === -1) {
      return;
    }
    item.content.data = item.content.data.split(AUTH_PROMPT_TIMER_TRIGGER_KEY).join("").trim();
    this._startAuthPromptTimer();
  }

  _startAuthPromptTimer() {
    // Re-arm on every occurrence (unlike auth polling's one-shot guard) -
    // each one represents a fresh guest/login prompt being shown, so each
    // should get its own full nudge window.
    this._clearAuthPromptTimer();
    this._authPromptTimer = setTimeout(() => {
      this._authPromptTimer = null;
      this._sendSilentMessageToBot(AUTH_PROMPT_TIMEOUT_SILENT_MESSAGE);
    }, AUTH_PROMPT_TIMER_MS);
    if (typeof this._authPromptTimer.unref === "function") {
      this._authPromptTimer.unref();
    }
  }

  _clearAuthPromptTimer() {
    if (this._authPromptTimer) {
      clearTimeout(this._authPromptTimer);
      this._authPromptTimer = null;
    }
  }

  // Pushes the newly-known customer attributes onto the live contact, then
  // lets the bot/VA know login happened (see _sendSilentMessageToBot) so it
  // can continue the flow as an authenticated customer.
  async _handleCustomerAuthenticated(context) {
    const attributes = {};
    if (context.firstName) attributes.firstName = context.firstName;
    if (context.lastName) attributes.lastName = context.lastName;
    if (context.email) attributes.email = context.email;
    if (context.customerId) attributes.customerId = String(context.customerId);
    // Match the same attribute keys buildContactAttributes() (launcher.js)
    // already sends at chat-start time, so this mid-chat update is just as
    // complete as the initial set. customerLoggedIn is hardcoded "Yes"
    // unconditionally - this method only ever runs once the caller has
    // already confirmed context.authenticated === true, so it's always
    // correct here.
    attributes.customerLoggedIn = "Yes";
    if (context.firstName) attributes.customerName = context.firstName;

    const apiGatewayEndpoint = this.customizationParams.apiGatewayEndpoint;
    if (apiGatewayEndpoint && Object.keys(attributes).length > 0) {
      try {
        await updateContactAttributes({apiGatewayEndpoint, contactId: this.contactId, attributes});
      } catch (e) {
        this.logger && this.logger.error("Failed to sync authenticated customer attributes.", e);
      }
    }

    this._sendSilentMessageToBot(AUTH_POLLING_SILENT_MESSAGE);
  }

  // Sent straight through the client, deliberately bypassing
  // addOutgoingMessage()'s normal transcript-adding path entirely - the
  // customer must never see this in their own transcript, it exists purely
  // to tell the bot/VA the login just happened.
  //
  // Records this exact text as "pending" BEFORE sending, so
  // _shouldSuppressSilentMessageEcho (in _handleIncomingData) can catch and
  // drop its echo whenever it actually arrives - not tied to the
  // sendMessage() promise's own timing. addOutgoingMessage()'s
  // isOutgoingMessageInFlight flag is the wrong tool to reuse here: it gets
  // reset as soon as the SendMessage HTTP response comes back, but the
  // websocket echo can legitimately arrive after that (there's no
  // optimistic transcript entry here for the flag to be de-duplicating
  // against, unlike a normal typed message) - this content-matched
  // approach stays correct regardless of which arrives first.
  _sendSilentMessageToBot(text) {
    this._pendingSilentMessages = this._pendingSilentMessages || {};
    this._pendingSilentMessages[text] = (this._pendingSilentMessages[text] || 0) + 1;
    this.client.sendMessage({data: text, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN})
      .catch((e) => {
        // The send itself failed - no echo will ever arrive for this
        // attempt, so release its pending slot rather than leaving it
        // stuck (which would wrongly suppress some LATER, unrelated
        // message that happens to have the exact same text).
        this._pendingSilentMessages[text] = Math.max(0, (this._pendingSilentMessages[text] || 1) - 1);
        this.logger && this.logger.error("Failed to send silent login notice to bot.", e);
      });
  }

  // See _sendSilentMessageToBot above. Only ever suppresses a message that
  // is BOTH a genuine roundtrip of this exact participant's own send (so a
  // real agent/bot message that happens to contain the same text is never
  // affected) AND currently pending from a silent send.
  _shouldSuppressSilentMessageEcho(rawData, item) {
    if (!this._isRoundtripMessage(rawData)) {
      return false;
    }
    if (!item || !item.content || typeof item.content.data !== "string") {
      return false;
    }
    const pending = this._pendingSilentMessages;
    const text = item.content.data;
    if (!pending || !pending[text]) {
      return false;
    }
    pending[text] -= 1;
    if (pending[text] <= 0) {
      delete pending[text];
    }
    return true;
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
  // Deliberately triggers ONLY "chat-disconnected", never "chat-closed" -
  // this is what this ChatJS onEnded callback reaches, i.e. the chat ending
  // for any reason OTHER than the customer's own "End chat" button
  // (agent-side end, contact expiry, etc.). launcher.js's
  // wireChatEndCleanup only calls closePanel() from its onChatClose
  // handler ("chat-closed"), never from onChatDisconnected
  // ("chat-disconnected") - so per the product requirement that the panel
  // must stay exactly as it was (open/minimized) on any agent/server-side
  // disconnect, do NOT add a "chat-closed" trigger here. Only endChat()
  // (the customer's own explicit end-chat action) should ever trigger
  // both together.
  _handleEndedEvent() {
    this._stopAuthPolling();
    this._clearAuthPromptTimer();
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
