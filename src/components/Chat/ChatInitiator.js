import request from "../../utils/fetchRequest";
import {START_CHAT_CLIENT_TIMEOUT_MS} from "../../constants/http";

function safeParse(jsonString, defaultValue) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Initiate a chat session within Amazon Connect, proxying initial StartChatContact request
 * through your API Gateway.
 *
 * https://docs.aws.amazon.com/connect/latest/APIReference/API_StartChatContact.html
 *
 * InstanceId/ContactFlowId are deliberately NOT included in the request body
 * sent to apiGatewayEndpoint below - the Lambda behind it resolves those
 * itself from its own env vars, and doesn't need (or use) values from the
 * client. Confirmed end-to-end: the client can omit them entirely and
 * StartChatContact still succeeds.
 *
 * @param {Object} input - data to initate chat
 * @param {string} input.apiGatewayEndpoint
 * @param {string} input.name
 * @param {string} input.initialMessage - optional initial message to start chat
 * @param {string} input.region
 * @param {string} input.contactAttributes
 * @param {object} input.headers
 * @param {string} input.supportedMessagingContentTypes
 * @param {number} input.chatDurationInMinutes
 * @returns {Promise} Promise object that resolves to chatDetails objects
 */
export function initiateChat(input) {
  const initiateChatRequest = {
    ParticipantDetails: {
      DisplayName: input.name,
    },
    Username: input.username,
  };

  if (input.persistentChat) {
    if (input.persistentChat.sourceContactId && input.persistentChat.rehydrationType) {
      initiateChatRequest.PersistentChat = {
        SourceContactId: input.persistentChat.sourceContactId,
        RehydrationType: input.persistentChat.rehydrationType,
      };
    }
  }

  const attributes = safeParse(input.contactAttributes, null);
  if (attributes) {
    initiateChatRequest.Attributes = attributes;
  }

  if (input.initialMessage) {
    initiateChatRequest.InitialMessage = {
      ContentType: "text/plain",
      Content: input.initialMessage,
    };
  }

  if (input.supportedMessagingContentTypes) {
    initiateChatRequest.SupportedMessagingContentTypes = input.supportedMessagingContentTypes.split(",");
  }

  if (input.chatDurationInMinutes) {
    initiateChatRequest.ChatDurationInMinutes = Number(input.chatDurationInMinutes);
  }

  let headers = new Headers();

  if (input.headers) {
    headers = input.headers;
  }

  return request(
    input.apiGatewayEndpoint,
    {
      headers,
      method: "post",
      body: JSON.stringify(initiateChatRequest),
    },
    START_CHAT_CLIENT_TIMEOUT_MS
  ).then((res) => res.json.data);
}
