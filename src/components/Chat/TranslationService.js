import request from "../../utils/fetchRequest";
import {TRANSLATE_CLIENT_TIMEOUT_MS} from "../../constants/http";

/**
 * Calls the CCaaS-provided real-time chat translation API.
 *
 * https://jgnx26szub.execute-api.eu-west-2.amazonaws.com/dev/translate (dev)
 *
 * POST {apiEndpoint}
 * body: {contactId, direction, message, agentLanguage?}
 * response: {contactId, direction, translatedMessage, sourceLanguage, targetLanguage, translationApplied}
 *
 * `request()` (utils/fetchRequest.js) has no timeout support of its own -
 * unlike ChatInitiator.js's initiateChat(), which passes a timeout value
 * that silently does nothing, this wraps the call in its own race so a
 * hung translate request can never leave an outgoing chat message stuck
 * in-flight indefinitely.
 *
 * Rejects on any non-2xx status, network error, or timeout - this module
 * has no fallback opinion of its own, callers decide what to do (see
 * ChatSession.js's _sendOutgoingMessageContent / _translateIncomingMessageContent).
 *
 * @param {Object} input
 * @param {string} input.apiEndpoint
 * @param {string} input.contactId - the Amazon Connect ContactId, unchanged for the life of the chat session
 * @param {string} input.direction - TRANSLATION_DIRECTION.CUSTOMER_TO_AGENT | AGENT_TO_CUSTOMER
 * @param {string} input.message - the original, untranslated text as typed by the sender
 * @param {string} [input.agentLanguage] - required for CUSTOMER_TO_AGENT (see the API's field contract)
 * @returns {Promise<{translatedMessage: string, sourceLanguage: string, targetLanguage: string, translationApplied: boolean}>}
 */
export function translateMessage(input) {
  const body = {
    contactId: input.contactId,
    direction: input.direction,
    message: input.message,
  };
  if (input.agentLanguage) {
    body.agentLanguage = input.agentLanguage;
  }

  const headers = new Headers({"Content-Type": "application/json"});

  const requestPromise = request(input.apiEndpoint, {
    method: "post",
    headers,
    body: JSON.stringify(body),
  }).then((response) => response.json);

  const timeoutPromise = new Promise((_resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Translation request timed out after ${TRANSLATE_CLIENT_TIMEOUT_MS}ms`));
    }, TRANSLATE_CLIENT_TIMEOUT_MS);
    // Node-only guard (mirrors the same pattern already used for the
    // inactivity timers in ChatSession.js) - never a real concern in a
    // browser, only keeps a stray Jest test process from hanging on this.
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  });

  return Promise.race([requestPromise, timeoutPromise]);
}
