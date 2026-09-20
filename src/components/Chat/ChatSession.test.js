jest.mock("./TranslationService", () => ({
  translateMessage: jest.fn(),
}));

import ChatSession, {getCurrentChatSessionInstance, setCurrentChatSessionInstance} from "./ChatSession";
import {AttachmentErrorType, ContentType, InteractiveMessageType, TRANSLATION_DIRECTION} from "./datamodel/Model";
import {translateMessage} from "./TranslationService";

const ParticipantId = "123";
const chatDetails = {
  startChatResult: {
    ContactId: "aaa",
    ParticipantId: ParticipantId,
    ParticipantToken: "bbb",
  },
};
const region = "us-west-2";
const stage = "dev";
const AbsoluteTime = new Date(Date.now()).getTime() / 1000;
const transcriptResponse = {
  data: {
    Transcript: [
      {
        Id: "italics",
        Type: "message",
        ParticipantId: "123",
        AbsoluteTime: AbsoluteTime,
        ParticipantRole: 'CUSTOMER',
        transportDetails: {
          direction: "Outgoing",
          status: "SendSuccess",
        },
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
        Content: "*italic*",
      },
      {
        Id: "bold",
        Type: "message",
        ParticipantId: "456",
        AbsoluteTime: AbsoluteTime + 1000,
        ParticipantRole: 'AGENT',
        transportDetails: {
          direction: "Incoming",
          messageReceiptType: "delivered",
          status: "SendSuccess",
        },
        MessageMetadata: {
          MessageId: "bold",
          Receipts: [
            {
              RecipientParticipantId: "RecipientParticipantId",
              DeliveredTimestamp: new Date().toISOString(),
              ReadTimestamp: new Date().toISOString(),
            },
          ],
        },
        lastDeliveredReceipt: true,
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
        Content: "**bold**",
      },
      {
        Id: "numberedList",
        Type: "message",
        ParticipantId: "456",
        AbsoluteTime: AbsoluteTime + 2000,
        ParticipantRole: 'AGENT',
        transportDetails: {
          direction: "Incoming",
          status: "SendSuccess",
        },
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
        Content: "1. item1 \n 1. item2",
      },
      {
        Id: "bulletedList",
        Type: "message",
        ParticipantId: "123",
        AbsoluteTime: AbsoluteTime + 3000,
        ParticipantRole: 'CUSTOMER',
        transportDetails: {
          direction: "Outgoing",
          status: "SendSuccess",
        },
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
        Content: "* item3 \n * item4",
      },
      {
        AbsoluteTime: AbsoluteTime + 4000,
        MessageMetadata: {
          MessageId: "31bf18c9-d80b-4f75-8145-c47946a26e03",
          Receipts: [],
        },
        Content:
          "Amazon Connect will now simulate rolling dice by using the Distribute randomly block,,,now rolling,,,,,,,",
        ContentType: "text/plain",
        DisplayName: "SYSTEM_MESSAGE",
        Id: "31bf18c9-d80b-4f75-8145-c47946a26e03",
        ParticipantId: "bcd32342-dd03-42ce-9288-9c44ebf81c4e",
        ParticipantRole: "SYSTEM",
        Type: "MESSAGE",
      },
      {
        Id: "view_message_1",
        Type: "message",
        ParticipantId: "789",
        AbsoluteTime: AbsoluteTime + 5000,
        ParticipantRole: 'SYSTEM',
        transportDetails: {
          direction: "Incoming",
          status: "SendSuccess",
        },
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE,
        Content: JSON.stringify({templateType: InteractiveMessageType.VIEW_RESOURCE}),
      },
      {
        Id: "view_response_1",
        Type: "message",
        ParticipantId: "789",
        AbsoluteTime: AbsoluteTime + 6000,
        ParticipantRole: 'CUSTOMER',
        transportDetails: {
          direction: "Outgoing",
          status: "SendSuccess",
        },
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE,
        Content: JSON.stringify({templateType: InteractiveMessageType.VIEW_RESOURCE}),
      },
      {
        Id: "bulletedList2",
        Type: "message",
        ParticipantId: "123",
        AbsoluteTime: AbsoluteTime + 7000,
        ParticipantRole: 'CUSTOMER',
        transportDetails: {
          direction: "Outgoing",
          status: "SendSuccess",
        },
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
        Content: "* item3 \n * item4",
      },
      {
        Id: "view_message_2",
        Type: "message",
        ParticipantId: "789",
        AbsoluteTime: AbsoluteTime + 8000,
        ParticipantRole: 'SYSTEM',
        transportDetails: {
          direction: "Incoming",
          status: "SendSuccess",
        },
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE,
        Content: '{"version":"1.0","templateType":"ViewResource", "data": {"content":{"viewId":"detail","viewData":{"key":"viewData"},"viewToken":"viewToken"}}}',
      },
    ],
  },
};

beforeAll(() => {
  window.connect = {
    ChatSession: {
      create: function (obj) {
        return {
          controller: {contactId: "aaa"},
          getChatDetails: jest.fn(() => {
            return {participantId: ParticipantId};
          }),
          sendMessage: jest.fn().mockResolvedValue("aaa"),
          sendEvent: jest.fn().mockResolvedValue("bb"),
          sendReadReceipt: jest.fn().mockResolvedValue("bb"),
          sendDeliveredReceipt: jest.fn().mockResolvedValue("bb"),
          sendAttachment: jest.fn().mockImplementation(
            (...input) =>
              new Promise((resolve, reject) => {
                if (input[0].attachment.status === "resolve") {
                  resolve(input[0].attachment);
                } else {
                  reject(input[0].attachment);
                }
              })
          ),
          describeView: jest.fn().mockResolvedValue("view"),
          getAuthenticationUrl: jest.fn().mockResolvedValue("auth"),
          cancelParticipantAuthentication: jest.fn().mockResolvedValue("auth")
        };
      },
    },
  };
});
afterAll(() => {
  delete window.connect;
});

describe("ChatSession", () => {
  describe("About logger", () => {
    describe("LogManager is defined", () => {
      let session;
      beforeEach(() => {
        window.connect.LogManager = {
          getLogger: function (obj) {
            return {
              debug: jest.fn(),
              info: jest.fn(),
              error: jest.fn(),
            };
          },
        };
        session = new ChatSession(chatDetails, region, stage);
        setCurrentChatSessionInstance(session);
      });
      test("logger should be defined when LogManager is available", () => {
        expect(session.logger).toBeDefined();
      });

      test("getCurrentChatSession returns the current chat session", () => {
        expect(getCurrentChatSessionInstance()).toBe(session);
      });

      test("logger should be called when addOutgoingMessage is triggered", () => {
        session.addOutgoingMessage({});
        expect(session.logger.info).toBeCalled();
      });
      test("logger should be called when sendTypingEvent is triggered", () => {
        session.sendTypingEvent();
        expect(session.logger.info).toBeCalled();
      });
      test("logger should be called when addOutgoingAttachment is triggered", () => {
        session.addOutgoingAttachment({});
        expect(session.logger.info).toBeCalled();
      });
      test("logger should be called when 'on' is triggered", () => {
        session.on(
          "incoming-message",
          jest.fn(() => {})
        );
        expect(session.logger.info).toBeCalled();
      });
      test("logger should be called when 'off' is triggered", () => {
        session.off(
          "incoming-message",
          jest.fn(() => {})
        );
        expect(session.logger.info).toBeCalled();
      });
      test("logger should be called when closeChat is triggered", () => {
        session.closeChat();
        expect(session.logger.info).toBeCalled();
      });
      test("Authentication: should get auth url from chatJs", () => {
        const returnVal = session.getAuthenticationUrl({sessionId: 'test', redirectUri: 'test'});
        expect(session.client.session.getAuthenticationUrl).toBeCalled();
      });
    
      test("Authentication: should cancel authentication from chatJs", () => {
        const returnVal = session.cancelParticipantAuthentication({sessionId: 'test'});
        expect(session.client.session.cancelParticipantAuthentication).toBeCalled();
      });
      test("sendAttachment: should display correct message if ServiceQuotaExceeded", () => {
        const DEFAULT_MESSAGE = "DEFAULT_MESSAGE";
        Object.values(AttachmentErrorType).forEach((exceptionType) => {
          let transcriptItem = {
            content: {
              status: "error",
              type: exceptionType,
              message: DEFAULT_MESSAGE,
            },
            transportDetails: {},
            id: "",
          };
          const returnVal = session.sendAttachment(transcriptItem);
          returnVal
            .then(() => {
              if (
                transcriptItem.transportDetails.error.type ===
                AttachmentErrorType.ServiceQuotaExceededException
              ) {
                expect(transcriptItem.transportDetails.error.message).toEqual(
                  "Attachment failed to send. The maximum number of attachments allowed, has been reached"
                );
              } else if (
                transcriptItem.transportDetails.error.type ===
                AttachmentErrorType.ValidationException
              ) {
                expect(transcriptItem.transportDetails.error.message).toEqual(
                  DEFAULT_MESSAGE
                );
              } else {
                expect(transcriptItem.transportDetails.error.message).toEqual(
                  "Attachment failed to send"
                );
              }
            })
            .catch((e) => {
              console.log("REJECTED", e);
            });
        });
      });
    });

    describe("LogManager is undefined", () => {
      test("logger should be undefined when LogManager is not available", () => {
        delete window.connect.LogManager;
        const session = new ChatSession(chatDetails, region, stage);
        expect(session.logger).toBeUndefined();
      });
    });
  });

  describe("ChatSession callbacks", () => {
    beforeAll(() => {
      window.connect = {
        LogManager: {
          getLogger: function (obj) {
            return console;
          },
        },
        ChatSession: {
          create: function (obj) {
            return {
              controller: {contactId: "aaa"},
              getChatDetails: jest.fn(() => {
                return {participantId: ParticipantId};
              }),
              onMessage: jest.fn().mockResolvedValue("aaa"),
              onTyping: jest.fn().mockResolvedValue("aaa"),
              onReadReceipt: jest.fn().mockResolvedValue("aaa"),
              onParticipantReturned: jest.fn().mockResolvedValue("aaa"),
              onAutoDisconnection: jest.fn().mockResolvedValue("aaa"),
              onParticipantIdle: jest.fn().mockResolvedValue("aaa"),
              onDeliveredReceipt: jest.fn().mockResolvedValue("aaa"),
              onEnded: jest.fn().mockResolvedValue("aaa"),
              onConnectionEstablished: jest.fn().mockResolvedValue("aaa"),
              onAuthenticationInitiated: jest.fn().mockResolvedValue("aaa"),
              onAuthenticationTimeout: jest.fn().mockResolvedValue("aaa"),
              onAuthenticationSuccessful: jest.fn().mockResolvedValue("aaa"),
              onAuthenticationCanceled: jest.fn().mockResolvedValue("aaa"),
              onParticipantDisplayNameUpdated: jest.fn().mockResolvedValue("aaa"),
              onAuthenticationFailed: jest.fn().mockResolvedValue("aaa"),
              connect: jest.fn().mockResolvedValue("aaa"),
              sendMessage: jest.fn().mockResolvedValue("aaa"),
              sendEvent: jest.fn().mockResolvedValue("bb"),
              sendReadReceipt: jest.fn().mockResolvedValue("bb"),
              sendDeliveredReceipt: jest.fn().mockResolvedValue("bb"),
              onChatRehydrated: jest.fn().mockResolvedValue("aaa"),
              sendAttachment: jest.fn().mockImplementation(
                (...input) =>
                  new Promise((resolve, reject) => {
                    if (input[0].attachment.status === "resolve") {
                      resolve(input[0].attachment);
                    } else {
                      reject(input[0].attachment);
                    }
                  })
              ),
              getTranscript: () => Promise.resolve(transcriptResponse),
              describeView: jest.fn().mockResolvedValue("view"),
              getAuthenticationUrl: jest.fn().mockResolvedValue("view"),
            };
          },
        },
        csmService: {
          addCountMetric: jest.fn().mockImplementation(() => {}),
          addLatencyMetric: jest.fn().mockImplementation(() => {}),
        },
      };
    });
    afterAll(() => {
      delete window.connect;
    });

    test("should call idle event handler to update the transcript", async () => {
      const session = new ChatSession(chatDetails, region, stage);
      const addItemsToTranscriptSpy = jest.spyOn(session, '_addItemsToTranscript');
      session.openChatSession(true);
      const eventCallback =
        session.client.session.onParticipantIdle.mock.calls[0][0];
      const connectionEstablishedCallback =
        session.client.session.onConnectionEstablished.mock.calls[0][0];
      await connectionEstablishedCallback();
      const idleMessage = {
        data: {
          Type: "MESSAGEMETADATA",
          MessageMetadata: {
            MessageId: "italics",
            Receipts: [
              {
                DeliveredTimestamp: new Date().toISOString(),
                ReadTimestamp: new Date().toISOString(),
                RecipientParticipantId: "123",
              },
            ],
          },
          InitialContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
          ContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
        },
        chatDetails: {
          participantId: "participantId"
        }
      };
      eventCallback(idleMessage);
      expect(addItemsToTranscriptSpy).toHaveBeenCalledTimes(2);
    });
    test("should call authentication init event handler to update the transcript", async () => {
      const session = new ChatSession(chatDetails, region, stage, {authenticationRedirectUri:'test', authenticationIdentityProvider: 'test'});
      session.customizationParams = {authenticationRedirectUri:'test', authenticationIdentityProvider: 'test'}
      const addItemsToTranscriptSpy = jest.spyOn(session, '_handleAuthenticationInitiated');
      const getAuthURL = jest.spyOn(session, 'getAuthenticationUrl');
      session.openChatSession(true);
      const eventCallback =
        session.client.session.onAuthenticationInitiated.mock.calls[0][0];
      const connectionEstablishedCallback =
        session.client.session.onConnectionEstablished.mock.calls[0][0];
      await connectionEstablishedCallback();
      const authMessage = {
        data: {
          Content: JSON.stringify({
            sessionId: 'dd'
          }),
          MessageMetadata: {
            MessageId: "italics",
            Receipts: [
              {
                DeliveredTimestamp: new Date().toISOString(),
                ReadTimestamp: new Date().toISOString(),
                RecipientParticipantId: "123",
              },
            ],
          },
          InitialContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
          ContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
        },
        chatDetails: {
          participantId: "participantId"
        }
      };
      eventCallback(authMessage);
      expect(addItemsToTranscriptSpy).toHaveBeenCalledTimes(1);
      expect(getAuthURL).toHaveBeenCalledTimes(1);
    });

    
    test("should call authentication lifecycle event handler to update the transcript", async () => {
      const session = new ChatSession(chatDetails, region, stage);
      const addItemsToTranscriptSpy = jest.spyOn(session, '_handleAuthenticationLifecycleEvent');
      session.openChatSession(true);
      const eventCallbackCancelled =
        session.client.session.onAuthenticationCanceled.mock.calls[0][0];
      const eventCallbackFailed =
        session.client.session.onAuthenticationFailed.mock.calls[0][0];
      const eventCallbackSuccess =
        session.client.session.onAuthenticationSuccessful.mock.calls[0][0];
      const eventCallbackTimeout =
        session.client.session.onAuthenticationTimeout.mock.calls[0][0];
      const connectionEstablishedCallback =
        session.client.session.onConnectionEstablished.mock.calls[0][0];
      await connectionEstablishedCallback();
      const authMessage = {
        data: {
          Content: JSON.stringify({
            sessionId: 'dd'
          }),
          MessageMetadata: {
            MessageId: "italics",
            Receipts: [
              {
                DeliveredTimestamp: new Date().toISOString(),
                ReadTimestamp: new Date().toISOString(),
                RecipientParticipantId: "123",
              },
            ],
          },
          InitialContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
          ContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
        },
        chatDetails: {
          participantId: "participantId"
        }
      };
      eventCallbackCancelled(authMessage);
      eventCallbackFailed(authMessage);
      eventCallbackSuccess(authMessage);
      eventCallbackTimeout(authMessage);
      expect(addItemsToTranscriptSpy).toHaveBeenCalledTimes(4);
    });

    test("should register Read and Delivered and idle events", () => {
      const session = new ChatSession(chatDetails, region, stage);
      session.openChatSession(true);
      expect(session.client.session.onReadReceipt).toBeCalled();
      expect(session.client.session.onParticipantIdle).toBeCalled();
      expect(session.client.session.onParticipantReturned).toBeCalled();
      expect(session.client.session.onAutoDisconnection).toBeCalled();
      expect(session.client.session.onDeliveredReceipt).toBeCalled();
      expect(session.client.session.onChatRehydrated).toBeCalled();
      expect(session.client.session.onAuthenticationInitiated).toBeCalled();
      expect(session.client.session.onAuthenticationCanceled).toBeCalled();
      expect(session.client.session.onAuthenticationFailed).toBeCalled();
      expect(session.client.session.onAuthenticationSuccessful).toBeCalled();
      expect(session.client.session.onParticipantDisplayNameUpdated).toBeCalled();
    });
    test("should not update transcript if messageId not found", async () => {
      const session = new ChatSession(chatDetails, region, stage);
      session.openChatSession(true);
      const readCallback =
        session.client.session.onReadReceipt.mock.calls[0][0];
      const connectionEstablishedCallback =
        session.client.session.onConnectionEstablished.mock.calls[0][0];
      await connectionEstablishedCallback();
      const readReceiptMessage = {
        data: {
          Type: "MESSAGEMETADATA",
          MessageMetadata: {
            MessageId: "unknown_messageId",
            Receipts: [
              {
                DeliveredTimestamp: new Date().toISOString(),
                ReadTimestamp: new Date().toISOString(),
                RecipientParticipantId: "participantDEF",
              },
            ],
          },
          InitialContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
          ContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
        },
      };
      expect(session.transcript[0].lastReadReceipt).toEqual(false);
      readCallback(readReceiptMessage);
      expect(session.transcript[0].lastReadReceipt).toEqual(false);
    });
    test("should call handleMessageReceipt to update the transcript", async () => {
      const session = new ChatSession(chatDetails, region, stage);
      session.openChatSession(true);
      const readCallback =
        session.client.session.onReadReceipt.mock.calls[0][0];
      const deliveredCallback =
        session.client.session.onDeliveredReceipt.mock.calls[0][0];
      const connectionEstablishedCallback =
        session.client.session.onConnectionEstablished.mock.calls[0][0];
      await connectionEstablishedCallback();
      const readReceiptMessage = {
        data: {
          Type: "MESSAGEMETADATA",
          MessageMetadata: {
            MessageId: "italics",
            Receipts: [
              {
                DeliveredTimestamp: new Date().toISOString(),
                ReadTimestamp: new Date().toISOString(),
                RecipientParticipantId: "123",
              },
            ],
          },
          InitialContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
          ContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
        },
        chatDetails: {
          participantId: "participantId",
        },
      };
      expect(session.transcript[0].lastReadReceipt).toEqual(false);
      readCallback(readReceiptMessage);
      expect(session.transcript[0].lastReadReceipt).toEqual(true);

      const deliverReceiptMessage = {
        data: {
          Type: "MESSAGEMETADATA",
          MessageMetadata: {
            MessageId: "bulletedList",
            Receipts: [
              {
                DeliveredTimestamp: new Date().toISOString(),
                RecipientParticipantId: "123",
              },
            ],
          },
          InitialContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
          ContactId: "eb628fa4-9667-464f-905b-36de2f86f202",
        },
        chatDetails: {
          participantId: "participantId",
        },
      };
      expect(session.transcript[3].lastDeliveredReceipt).toEqual(false);
      deliveredCallback(deliverReceiptMessage);
      expect(session.transcript[3].lastDeliveredReceipt).toEqual(true);
    });

    test("should call sendEvent with correct params when sendReadReceipt is called", () => {
      const session = new ChatSession(chatDetails, region, stage);
      session.openChatSession(true);
      session.client.session.sendEvent.mockClear();
      session.sendReadReceipt();
      expect(session.client.session.sendEvent).toBeCalled();
      expect(session.client.session.sendEvent.mock.calls[0][0]).toEqual({
        content: "{}",
        contentType: "application/vnd.amazonaws.connect.event.message.read",
      });
    });
    test("should call sendEvent with correct params when sendDeliveredReceipt is called", () => {
      const session = new ChatSession(chatDetails, region, stage);
      session.openChatSession(true);
      session.client.session.sendEvent.mockClear();
      session.sendDeliveredReceipt();
      expect(session.client.session.sendEvent).toBeCalled();
      expect(session.client.session.sendEvent.mock.calls[0][0]).toEqual({
        content: "{}",
        contentType:
          "application/vnd.amazonaws.connect.event.message.delivered",
      });
    });
    test("should call sendDeliveredReceipt when an new incoming message is received", () => {
      const session = new ChatSession(chatDetails, "", region, stage, true);
      session.client.onMessage = jest.fn();
      session.client.session.onMessage.mockClear();
      session.client.session.sendEvent.mockClear();
      session.openChatSession(true);
      const callbackFn = session.client.onMessage.mock.calls[0][0];
      const dataInput = JSON.parse(
        '{"data":{"AbsoluteTime":"2022-08-30T03:25:11.004Z","Content":"hi","ContentType":"text/plain","Id":"ID","Type":"MESSAGE","ParticipantId":"ParticipantId","DisplayName":"Agent","ParticipantRole":"AGENT","InitialContactId":"contactId","ContactId":"contactId"},"chatDetails":{"initialContactId":"initialContactId","contactId":"contactId","participantId":"participantId","participantToken":"Token="}}'
      );
      callbackFn(dataInput);
      expect(session.client.session.sendEvent).toBeCalled();
      expect(session.client.session.sendEvent.mock.calls[0][0]).toEqual({
        content: '{"messageId":"ID"}',
        contentType:
          "application/vnd.amazonaws.connect.event.message.delivered",
      });
    });

    test("should not call sendDeliveredReceipt when an participantRole is not Customer or Agent", () => {
      const session = new ChatSession(chatDetails, "", region, stage, true);
      session.client.onMessage = jest.fn();
      session.client.session.onMessage.mockClear();
      session.client.session.sendEvent.mockClear();
      session.openChatSession(true);
      const callbackFn = session.client.onMessage.mock.calls[0][0];
      const dataInput = JSON.parse(
        '{"data":{"AbsoluteTime":"2022-08-30T03:25:11.004Z","Content":"hi","ContentType":"text/plain","Id":"ID","Type":"MESSAGE","ParticipantId":"ParticipantId","DisplayName":"Agent","ParticipantRole":"SYSTEM","InitialContactId":"contactId","ContactId":"contactId"},"chatDetails":{"initialContactId":"initialContactId","contactId":"contactId","participantId":"participantId","participantToken":"Token="}}'
      );
      callbackFn(dataInput);
      expect(session.client.session.sendEvent).not.toBeCalled();
    });

    test('Interactive message test. The message of clicking "Show more" button should not be added to transcript, and transcript should only contain the latest interactive message with the same referenceId', () => {
      const session = new ChatSession(chatDetails, "", region, stage);
      session.client.onMessage = jest.fn();
      session.openChatSession(true);
      const callbackFn = session.client.onMessage.mock.calls[0][0];
      const baseMessageObj = {
        data: {
          AbsoluteTime: "2023-03-17T08:25:45.992Z",
          Type: "MESSAGE",
          ParticipantId: "ParticipantId",
          DisplayName: "BOT",
          ParticipantRole: "SYSTEM",
          InitialContactId: "InitialContactId",
          ContactId: "InitialContactId",
          ContentType: "application/vnd.amazonaws.connect.message.interactive",
        },
        chatDetails: {
          initialContactId: "InitialContactId",
          contactId: "InitialContactId",
          participantId: "ParticipantId",
          participantToken: "participantToken",
        },
      };

      // This object is sent and then receive from web socket when user click "Show more" button
      // This message is not added to transcript
      const interactiveMessageRes1 = {
        ...baseMessageObj,
        data: {
          ...baseMessageObj.data,
          Content:
            '{"version":"1.0","data":{"actionName":"Show more","preIndex":-1,"nextIndex":5,"listId":"serviceList","templateType":"ListPicker","referenceId":"0c210016-60d9-47f8-9342-551158f09110"},"action":"Show more"}',
          Id: "id1",
        },
      };

      // interactiveMessageRes2 and interactiveMessageRes3 contain the same referenceId, means they are from the same interactive message session
      // interactiveMessageRes3 is added after interactiveMessageRes2, so transcript should only contain interactiveMessageRes3, interactiveMessageRes2 should be removed.
      const interactiveMessageRes2 = {
        ...baseMessageObj,
        data: {
          ...baseMessageObj.data,
          Content:
            '{"templateType":"ListPicker","version":"1.0","data":{"content":{"listId":"serviceList","title":"What produce would you like to buy?","subtitle":"Tap to select option","referenceId":"referenceId","elements":[{"title":"Acupuncture","subtitle":"$1.00"},{"title":"Chiropractor","subtitle":"$1.00"},{"title":"Naturopath","subtitle":"$1.00"},{"title":"Show more"}],"preIndex":-1,"nextIndex":5}}}',
          Id: "id2",
        },
      };
      const interactiveMessageRes3 = {
        ...baseMessageObj,
        data: {
          ...baseMessageObj.data,
          Content:
            '{"templateType":"ListPicker","version":"1.0","data":{"content":{"listId":"serviceList","title":"What produce would you like to buy?","subtitle":"Tap to select option","referenceId":"referenceId","elements":[{"title":"Acupuncture","subtitle":"$1.00"},{"title":"Chiropractor","subtitle":"$1.00"},{"title":"Show more"}],"preIndex":-1,"nextIndex":5}}}',
          Id: "id3",
        },
      };

      // interactiveMessageRes4 is added after interactiveMessageRes3
      // their referenceIds are different, that means they are from different interactive message session
      // so interactiveMessageRes4 should be added to transcript.
      const interactiveMessageRes4 = {
        ...baseMessageObj,
        data: {
          ...baseMessageObj.data,
          Content:
            '{"templateType":"ListPicker","version":"1.0","data":{"content":{"listId":"serviceList","title":"What produce would you like to buy?","subtitle":"Tap to select option","referenceId":"newReferenceId","elements":[{"title":"Chiropractor","subtitle":"$1.00"},{"title":"Show more"}],"preIndex":-1,"nextIndex":5}}}',
          Id: "id4",
        },
      };
      callbackFn(interactiveMessageRes1);
      callbackFn(interactiveMessageRes2);
      callbackFn(interactiveMessageRes3);
      callbackFn(interactiveMessageRes4);
      // interactiveMessageRes1: The message of clicking "Show more" button is not added to transcript
      // interactiveMessageRes2 and interactiveMessageRes3 are from the same interavtive message session, so only the latest one(interactiveMessageRes3) is added to transcript
      // interactiveMessageRes4 is from a new session, so it can be added to transcript
      // so there are totally 2 messages in transcript
      expect(session.transcript.length).toEqual(2);
    });

    test("should handle chat rehydration correctly", async () => {
      jest.useFakeTimers();
      const session = new ChatSession(chatDetails, "", region, stage, true);
      session.openChatSession(true);
      const chatRehydrationEventCallBack = session.client.session.onChatRehydrated.mock.calls[0][0]
      const rehydratedData = {
        data: {
          AbsoluteTime: "2023-03-17T08:25:45.992Z",
          Type: 'EVENT',
          Id: "test0",
          InitialContactId: 'InitialContactId',
          ContentType: "application/vnd.amazonaws.connect.event.chat.rehydrated",
        },
        chatDetails: {
          initialContactId: 'InitialContactId',
          contactId: 'InitialContactId',
          participantId: 'ParticipantId',
          participantToken:
              'participantToken',
        },
      };
      const modifiedTranscriptResponse = {
        ...transcriptResponse,
        data: {
          ...transcriptResponse.data,
          NextToken: "nextToken123"
        }
      };
      session.client.getTranscript = jest.fn().mockResolvedValueOnce(modifiedTranscriptResponse);
      // Call the chat rehydration callback
      const rehydrationPromise = chatRehydrationEventCallBack(rehydratedData);
 
      // Fast-forward until all timers have been executed
      jest.advanceTimersByTime(1000);
 
      // Wait for the rehydration promise to resolve
      await rehydrationPromise;
 
      expect(session.client.getTranscript).toHaveBeenCalled();
      expect(session.client.getTranscript).toHaveBeenCalledWith(expect.objectContaining({maxResults: 15}));
      if (session.nextToken) {
        expect(session.client.getTranscript).toHaveBeenCalledTimes(2);
      } else {
        expect(session.client.getTranscript).toHaveBeenCalledTimes(1);
      }
    });

    test("should call describeView when interactive view message is received", () => {
      const session = new ChatSession(
        chatDetails,
        "",
        region,
        stage,
        true
      );
      session.client.onMessage = jest.fn();
      session.client.session.onMessage.mockClear();
      session.client.session.sendEvent.mockClear();
      session.openChatSession(true);
      const callbackFn = session.client.onMessage.mock.calls[0][0];
      let dataInput = JSON.parse(
        '{"data":{"AbsoluteTime":"2022-08-30T03:25:11.004Z","ContentType":"application/vnd.amazonaws.connect.message.interactive","Id":"ID","Type":"MESSAGE","ParticipantId":"ParticipantId","DisplayName":"Agent","ParticipantRole":"AGENT","InitialContactId":"contactId","ContactId":"contactId"},"chatDetails":{"initialContactId":"initialContactId","contactId":"contactId","participantId":"participantId","participantToken":"Token="}}'
      );
      dataInput.data.Content = '{"version":"1.0","templateType":"ViewResource", "data": {"content":{"viewId":"detail","viewData":{"key":"viewData"},"viewToken":"viewToken"}}}';
      callbackFn(dataInput);
      expect(session.client.session.describeView).toBeCalled();
      expect(session.client.session.describeView.mock.calls[0][0]).toEqual({
        viewToken: "viewToken"
      });
    });

    test("should alter message if trying to send a non interactive response for a previous view resource interactive message", () => {
      const session = new ChatSession(
        chatDetails,
        "",
        region,
        stage,
        true
      );
      session.openChatSession(true);
      session.transcript = [
        {
          Id: "test",
          Type: "message",
          ParticipantId: "456",
          AbsoluteTime: AbsoluteTime + 1000,
          ParticipantRole: 'AGENT',
          transportDetails: {
            direction: "Incoming",
            messageReceiptType: "delivered",
            status: "SendSuccess",
          },
          MessageMetadata: {
            MessageId: "test",
            Receipts: [
              {
                RecipientParticipantId: "RecipientParticipantId",
                DeliveredTimestamp: new Date().toISOString(),
                ReadTimestamp: new Date().toISOString(),
              },
            ],
          },
          lastDeliveredReceipt: true,
          content: {
            type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE,
            data: JSON.stringify({templateType: InteractiveMessageType.VIEW_RESOURCE})
          },
        },
      ]

      // create outgoing plain text
      const dataInput = {
        text: "hi hello"
      }

      // send outgoing plaintext
      session.addOutgoingMessage(dataInput);

      //expect client to send interactive response
      expect(session.client.session.sendMessage).toBeCalled();
      expect(session.client.session.sendMessage.mock.calls[0][0].contentType).toEqual(ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE);

      const message = session.client.session.sendMessage.mock.calls[0][0].message;
      expect(JSON.parse(message).action).toEqual(" ");
      expect(JSON.parse(message).data).toEqual({content: "hi hello"});
    });

    test("clear view message after customer interacts with it", () => {
      const session = new ChatSession(
        chatDetails,
        "",
        region,
        stage,
        true
      );
      session.openChatSession(true);
      const interactiveMessageInTranscript =
      {
        Id: "test_1",
        Type: "message",
        ParticipantId: "456",
        AbsoluteTime: AbsoluteTime + 1000,
        ParticipantRole: 'SYSTEM',
        transportDetails: {
          direction: "Incoming",
          messageReceiptType: "delivered",
          status: "SendSuccess",
        },
        MessageMetadata: {
          MessageId: "test1",
          Receipts: [
            {
              RecipientParticipantId: "RecipientParticipantId",
              DeliveredTimestamp: new Date().toISOString(),
              ReadTimestamp: new Date().toISOString(),
            },
          ],
        },
        lastDeliveredReceipt: true,
        content: {
          type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE,
          data: JSON.stringify({templateType: InteractiveMessageType.VIEW_RESOURCE})
        },
      };

      session.transcript = [
        {
          Id: "test_0",
          Type: "message",
          ParticipantId: "123",
          AbsoluteTime: AbsoluteTime,
          ParticipantRole: 'CUSTOMER',
          transportDetails: {
            direction: "Outgoing",
            messageReceiptType: "delivered",
            status: "SendSuccess",
          },
          MessageMetadata: {
            MessageId: "test0",
            Receipts: [
              {
                RecipientParticipantId: "RecipientParticipantId",
                DeliveredTimestamp: new Date().toISOString(),
                ReadTimestamp: new Date().toISOString(),
              },
            ],
          },
          lastDeliveredReceipt: true,
          content: {
            type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE,
            data: JSON.stringify({templateType: InteractiveMessageType.VIEW_RESOURCE})
          },
        },
        interactiveMessageInTranscript
      ]
      // create response
      const dataInput = {
        text: JSON.stringify({templateType: 'ViewResource', data: {} }),
        type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE
      }

      expect(session.transcript.includes(interactiveMessageInTranscript)).toBeTruthy();

      // send outgoing plaintext
      session.addOutgoingMessage(dataInput);

      // expect client to send interactive response
      expect(session.client.session.sendMessage).toBeCalled();

      expect(session.transcript.length).toEqual(2);

      // interactive message is removed
      expect(session.transcript.includes(interactiveMessageInTranscript)).not.toBeTruthy();
    });

    test("should not alter message if trying to send a non interactive response for a previous non view resource message", () => {
      const session = new ChatSession(
        chatDetails,
        "",
        region,
        stage,
        true
      );
      session.openChatSession(true);
      session.transcript = [
        {
          Id: "test",
          Type: "message",
          ParticipantId: "456",
          AbsoluteTime: AbsoluteTime + 1000,
          ParticipantRole: 'AGENT',
          transportDetails: {
            direction: "Incoming",
            messageReceiptType: "delivered",
            status: "SendSuccess",
          },
          MessageMetadata: {
            MessageId: "test",
            Receipts: [
              {
                RecipientParticipantId: "RecipientParticipantId",
                DeliveredTimestamp: new Date().toISOString(),
                ReadTimestamp: new Date().toISOString(),
              },
            ],
          },
          lastDeliveredReceipt: true,
          content: {
            type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
            data: "hello"
          },
        },
      ]

      // create outgoing plain text
      const dataInput = {
        text: "hi hello"
      }

      // send outgoing plaintext
      session.addOutgoingMessage(dataInput);

      //expect client to send interactive response
      expect(session.client.session.sendMessage).toBeCalled();
      expect(session.client.session.sendMessage.mock.calls[0][0].contentType).toEqual(ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN);
    });

    test("should remove old views and retain new one when loading transcript", async () => {
      const session = new ChatSession(chatDetails, region, stage);
      session.openChatSession(true);
      const transcriptLength = transcriptResponse.data.Transcript.length;
      const connectionEstablishedCallback =
        session.client.session.onConnectionEstablished.mock.calls[0][0];

      await connectionEstablishedCallback();
      // there is only 1 view message that needs to be removed when loading transcript
      expect(session.transcript.length).toEqual(transcriptLength - 1);
      // should be called for the latest message
      expect(session.client.session.describeView).toBeCalledTimes(1);
    });
  });

  describe("Customer -> Agent live translation", () => {
    const TRANSLATE_ENDPOINT = "https://jgnx26szub.execute-api.eu-west-2.amazonaws.com/dev/translate";
    const AGENT_HELPER_MESSAGE_TEXT = "Hello, this is Agent Smith.";

    beforeEach(() => {
      window.connect = {
        LogManager: {
          getLogger: function () {
            return console;
          },
        },
        ChatSession: {
          create: function () {
            return {
              controller: {contactId: "aaa"},
              getChatDetails: jest.fn(() => ({participantId: ParticipantId})),
              onMessage: jest.fn(),
              onTyping: jest.fn(),
              onReadReceipt: jest.fn(),
              onParticipantReturned: jest.fn(),
              onAutoDisconnection: jest.fn(),
              onParticipantIdle: jest.fn(),
              onDeliveredReceipt: jest.fn(),
              onEnded: jest.fn(),
              onConnectionEstablished: jest.fn(),
              onAuthenticationInitiated: jest.fn(),
              onAuthenticationTimeout: jest.fn(),
              onAuthenticationSuccessful: jest.fn(),
              onAuthenticationCanceled: jest.fn(),
              onParticipantDisplayNameUpdated: jest.fn(),
              onAuthenticationFailed: jest.fn(),
              onChatRehydrated: jest.fn(),
              connect: jest.fn().mockResolvedValue("aaa"),
              sendMessage: jest.fn().mockResolvedValue({data: {}}),
              sendEvent: jest.fn().mockResolvedValue("bb"),
              getTranscript: jest.fn().mockResolvedValue({data: {Transcript: [], NextToken: null}}),
              describeView: jest.fn().mockResolvedValue("view"),
            };
          },
        },
      };
      translateMessage.mockReset();
      // simulateAgentMessage's own text (AGENT_HELPER_MESSAGE_TEXT) is
      // itself a real AGENT-role plain-text message, so now that Agent ->
      // Customer translation exists it gets translated too whenever a test
      // enables translation - give it a harmless default response so tests
      // that don't otherwise care about that (most of these) don't have to
      // set one up themselves. Any test that does care (translateMessage
      // call assertions, fail-open behavior) still overrides this
      // afterward with its own mockResolvedValue/mockRejectedValue.
      translateMessage.mockResolvedValue({
        translatedMessage: AGENT_HELPER_MESSAGE_TEXT,
        sourceLanguage: "en",
        targetLanguage: "fr",
        translationApplied: true,
      });
      window.localStorage.clear();
    });

    afterEach(() => {
      delete window.connect;
      window.localStorage.clear();
    });

    function createSessionWithTranslation(translationOverrides = {}) {
      const session = new ChatSession(chatDetails, "Customer", region, stage, {
        translation: {
          enabled: true,
          apiEndpoint: TRANSLATE_ENDPOINT,
          agentLanguage: "en",
          ...translationOverrides,
        },
      });
      session.openChatSession(true);
      return session;
    }

    // Simplest, most realistic signal that a live agent has joined - an
    // actual chat message arriving from an AGENT-role participant. Matches
    // _updateLiveAgentState's modelUtils.isTypeMessageOrAttachment(item.type)
    // fallback path.
    function simulateAgentMessage(session, overrides = {}) {
      const onMessageCallback = session.client.session.onMessage.mock.calls[0][0];
      onMessageCallback({
        data: {
          AbsoluteTime: new Date().toISOString(),
          Content: "Hello, this is Agent Smith.",
          ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
          Id: "agent-msg-1",
          Type: "MESSAGE",
          ParticipantId: "agent-1",
          DisplayName: "Agent Smith",
          ParticipantRole: "AGENT",
          ...overrides,
        },
      });
    }

    // The real signal Connect actually sends when a participant joins/
    // leaves - a Type: "EVENT" item, distinct from the Type: "MESSAGE"
    // fallback above. Exercises _updateLiveAgentState's other branch.
    function simulateAgentParticipantEvent(session, eventContentType, overrides = {}) {
      const onMessageCallback = session.client.session.onMessage.mock.calls[0][0];
      onMessageCallback({
        data: {
          AbsoluteTime: new Date().toISOString(),
          Type: "EVENT",
          ContentType: eventContentType,
          Id: "agent-event-1",
          ParticipantId: "agent-1",
          DisplayName: "Agent Smith",
          ParticipantRole: "AGENT",
          ...overrides,
        },
      });
    }

    test("does not call the translation API when translation is disabled for the brand", async () => {
      const session = createSessionWithTranslation({enabled: false});
      simulateAgentMessage(session);

      session.addOutgoingMessage({text: "Bonjour, j'ai besoin d'aide."});
      await Promise.resolve();

      expect(translateMessage).not.toBeCalled();
      expect(session.client.session.sendMessage).toBeCalledWith({
        message: "Bonjour, j'ai besoin d'aide.",
        contentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
      });
    });

    test("does not call the translation API before any live agent has joined (bot/Lex-only conversation)", async () => {
      const session = createSessionWithTranslation();
      // No agent message/join event simulated.

      session.addOutgoingMessage({text: "Bonjour, j'ai besoin d'aide."});
      await Promise.resolve();

      expect(translateMessage).not.toBeCalled();
      expect(session.client.session.sendMessage).toBeCalledWith({
        message: "Bonjour, j'ai besoin d'aide.",
        contentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
      });
    });

    test("translates the outgoing message to the agent once a live agent has joined, while the customer keeps seeing their own original text", async () => {
      translateMessage.mockResolvedValue({
        translatedMessage: "Hello, I need help regarding my order.",
        sourceLanguage: "fr",
        targetLanguage: "en",
        translationApplied: true,
      });
      const session = createSessionWithTranslation();
      simulateAgentMessage(session);

      const originalText = "Bonjour, j'ai besoin d'aide concernant ma commande.";
      session.addOutgoingMessage({text: originalText});
      // Several microtask hops: the translateMessage() promise, then its
      // .then(...).catch(...).then(...) chain (see _sendOutgoingMessageContent)
      // before client.sendMessage is finally reached.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(translateMessage).toBeCalledWith({
        apiEndpoint: TRANSLATE_ENDPOINT,
        contactId: session.contactId,
        direction: TRANSLATION_DIRECTION.CUSTOMER_TO_AGENT,
        message: originalText,
        agentLanguage: "en",
      });
      expect(session.client.session.sendMessage).toBeCalledWith({
        message: "Hello, I need help regarding my order.",
        contentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
      });

      // The customer's own transcript keeps the original French text - only
      // what's sent over the wire (asserted above) is translated.
      const customerItem = session.transcript.find((item) => item.content.data === originalText);
      expect(customerItem).toBeDefined();
    });

    test("keeps showing the customer's original text even after Connect echoes back the translated message it actually received", async () => {
      // Connect only ever sees what was actually sent (the translated
      // English text) - so its own roundtrip echo of this message, and any
      // later transcript reload, legitimately carries English, not French.
      // The customer's own display must never be overwritten by that.
      translateMessage.mockResolvedValue({
        translatedMessage: "Hi, I need help with my order.",
        sourceLanguage: "fr",
        targetLanguage: "en",
        translationApplied: true,
      });
      const REAL_CONNECT_ID = "connect-real-id-1";
      const session2 = createSessionWithTranslation();
      simulateAgentMessage(session2);
      session2.client.session.sendMessage.mockResolvedValueOnce({
        data: {Id: REAL_CONNECT_ID, AbsoluteTime: new Date().toISOString()},
      });

      const originalText = "Bonjour, j'ai besoin d'aide concernant ma commande.";
      session2.addOutgoingMessage({text: originalText});
      // Flush the full chain: translateMessage -> .then -> .catch(passthrough)
      // -> .then(sendMessage) -> sendMessage's own promise -> the success
      // handler that calls _replaceItemInTranscript.
      for (let i = 0; i < 6; i++) {
        await Promise.resolve();
      }

      expect(session2.transcript.find((item) => item.id === REAL_CONNECT_ID).content.data).toEqual(originalText);

      // Now Connect's own roundtrip echo of that same message arrives,
      // carrying what it actually received (the translated English text).
      const onMessageCallback = session2.client.session.onMessage.mock.calls[0][0];
      onMessageCallback({
        data: {
          AbsoluteTime: new Date().toISOString(),
          Content: "Hi, I need help with my order.",
          ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
          Id: REAL_CONNECT_ID,
          Type: "MESSAGE",
          ParticipantId: ParticipantId,
          DisplayName: "Customer",
          ParticipantRole: "CUSTOMER",
        },
      });

      const itemAfterEcho = session2.transcript.find((item) => item.id === REAL_CONNECT_ID);
      expect(itemAfterEcho.content.data).toEqual(originalText);
    });

    test("restores the customer's original text after a page reload/resume reloads the transcript from Connect", async () => {
      translateMessage.mockResolvedValue({
        translatedMessage: "Hi, I need help with my order.",
        sourceLanguage: "fr",
        targetLanguage: "en",
        translationApplied: true,
      });
      const REAL_CONNECT_ID = "connect-real-id-reload-1";
      const originalText = "Bonjour, j'ai besoin d'aide concernant ma commande.";

      // "Before reload": send the translated message, same as any other test.
      const sessionBeforeReload = createSessionWithTranslation();
      simulateAgentMessage(sessionBeforeReload);
      sessionBeforeReload.client.session.sendMessage.mockResolvedValueOnce({
        data: {Id: REAL_CONNECT_ID, AbsoluteTime: new Date().toISOString()},
      });
      sessionBeforeReload.addOutgoingMessage({text: originalText});
      for (let i = 0; i < 6; i++) {
        await Promise.resolve();
      }
      expect(sessionBeforeReload.transcript.find((item) => item.id === REAL_CONNECT_ID).content.data).toEqual(originalText);

      // "After reload": a brand new ChatSession instance (same contactId -
      // chatDetails.startChatResult.ContactId is the same "aaa" fixture
      // throughout this file) reloads the transcript straight from Connect,
      // which genuinely only has the translated English text stored.
      const sessionAfterReload = createSessionWithTranslation();
      sessionAfterReload.client.getTranscript = jest.fn().mockResolvedValue({
        data: {
          Transcript: [
            {
              Id: REAL_CONNECT_ID,
              Type: "MESSAGE",
              ParticipantId: ParticipantId,
              AbsoluteTime: AbsoluteTime,
              ParticipantRole: "CUSTOMER",
              ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
              Content: "Hi, I need help with my order.",
            },
          ],
          NextToken: null,
        },
      });
      const connectionEstablishedCallback = sessionAfterReload.client.session.onConnectionEstablished.mock.calls[0][0];
      await connectionEstablishedCallback();

      const reloadedItem = sessionAfterReload.transcript.find((item) => item.id === REAL_CONNECT_ID);
      expect(reloadedItem).toBeDefined();
      expect(reloadedItem.content.data).toEqual(originalText);
    });

    test("recognizes a live agent from a real PARTICIPANT_JOINED event, and stops again after PARTICIPANT_LEFT", async () => {
      translateMessage.mockResolvedValue({
        translatedMessage: "translated",
        sourceLanguage: "fr",
        targetLanguage: "en",
        translationApplied: true,
      });
      const session = createSessionWithTranslation();
      expect(session._hasLiveAgentConnected()).toBe(false);

      simulateAgentParticipantEvent(session, ContentType.EVENT_CONTENT_TYPE.PARTICIPANT_JOINED);
      expect(session._hasLiveAgentConnected()).toBe(true);

      session.addOutgoingMessage({text: "Bonjour"});
      await Promise.resolve();
      await Promise.resolve();
      expect(translateMessage).toBeCalled();

      simulateAgentParticipantEvent(session, ContentType.EVENT_CONTENT_TYPE.PARTICIPANT_LEFT, {Id: "agent-event-2"});
      expect(session._hasLiveAgentConnected()).toBe(false);

      translateMessage.mockClear();
      session.client.session.sendMessage.mockClear();
      session.addOutgoingMessage({text: "Bonjour again"});
      await Promise.resolve();

      expect(translateMessage).not.toBeCalled();
      expect(session.client.session.sendMessage).toBeCalledWith({
        message: "Bonjour again",
        contentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
      });
    });

    test("does not translate QuickReply/interactive responses even with a live agent connected", async () => {
      const session = createSessionWithTranslation();
      simulateAgentMessage(session);
      // simulateAgentMessage's own plain-text message legitimately triggers
      // one AGENT -> Customer translation call (see the "Agent -> Customer
      // live translation" describe block below) - only the CUSTOMER's own
      // outgoing QuickReply/interactive response is what this test is
      // actually about, so only that specific call is asserted against.
      translateMessage.mockClear();

      session.addOutgoingMessage({
        text: JSON.stringify({templateType: "QuickReply"}),
        type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE,
      });
      await Promise.resolve();

      expect(translateMessage).not.toBeCalled();
      expect(session.client.session.sendMessage.mock.calls[0][0].contentType).toEqual(
        ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE
      );
    });

    test("translates markdown-typed outgoing messages too, not just plain text", async () => {
      // Regression guard: launcher.js declares "text/markdown" as a
      // supported messaging content type for this contact, so a rich-text
      // customer composer (if one is ever enabled) could send markdown -
      // gating on TEXT_PLAIN alone would silently skip translating it.
      translateMessage.mockResolvedValue({
        translatedMessage: "Hello, I need help regarding my order.",
        sourceLanguage: "fr",
        targetLanguage: "en",
        translationApplied: true,
      });
      const session = createSessionWithTranslation();
      simulateAgentMessage(session);

      session.addOutgoingMessage({
        text: "Bonjour, j'ai besoin d'aide.",
        type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(translateMessage).toBeCalledWith(
        expect.objectContaining({
          direction: TRANSLATION_DIRECTION.CUSTOMER_TO_AGENT,
          message: "Bonjour, j'ai besoin d'aide.",
        })
      );
      expect(session.client.session.sendMessage).toBeCalledWith({
        message: "Hello, I need help regarding my order.",
        contentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
      });
    });

    test("fails open and sends the original message when the translation request errors", async () => {
      translateMessage.mockRejectedValue(new Error("network error"));
      const session = createSessionWithTranslation();
      simulateAgentMessage(session);

      const originalText = "Bonjour";
      session.addOutgoingMessage({text: originalText});
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(session.client.session.sendMessage).toBeCalledWith({
        message: originalText,
        contentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
      });
    });
  });

  describe("Agent -> Customer live translation", () => {
    const TRANSLATE_ENDPOINT = "https://jgnx26szub.execute-api.eu-west-2.amazonaws.com/dev/translate";

    beforeEach(() => {
      window.connect = {
        LogManager: {
          getLogger: function () {
            return console;
          },
        },
        ChatSession: {
          create: function () {
            return {
              controller: {contactId: "aaa"},
              getChatDetails: jest.fn(() => ({participantId: ParticipantId})),
              onMessage: jest.fn(),
              onTyping: jest.fn(),
              onReadReceipt: jest.fn(),
              onParticipantReturned: jest.fn(),
              onAutoDisconnection: jest.fn(),
              onParticipantIdle: jest.fn(),
              onDeliveredReceipt: jest.fn(),
              onEnded: jest.fn(),
              onConnectionEstablished: jest.fn(),
              onAuthenticationInitiated: jest.fn(),
              onAuthenticationTimeout: jest.fn(),
              onAuthenticationSuccessful: jest.fn(),
              onAuthenticationCanceled: jest.fn(),
              onParticipantDisplayNameUpdated: jest.fn(),
              onAuthenticationFailed: jest.fn(),
              onChatRehydrated: jest.fn(),
              connect: jest.fn().mockResolvedValue("aaa"),
              sendMessage: jest.fn().mockResolvedValue({data: {}}),
              sendEvent: jest.fn().mockResolvedValue("bb"),
              getTranscript: jest.fn().mockResolvedValue({data: {Transcript: [], NextToken: null}}),
              describeView: jest.fn().mockResolvedValue("view"),
            };
          },
        },
      };
      translateMessage.mockReset();
      window.localStorage.clear();
    });

    afterEach(() => {
      delete window.connect;
      window.localStorage.clear();
    });

    function createSessionWithTranslation(translationOverrides = {}) {
      const session = new ChatSession(chatDetails, "Customer", region, stage, {
        translation: {
          enabled: true,
          apiEndpoint: TRANSLATE_ENDPOINT,
          agentLanguage: "en",
          ...translationOverrides,
        },
      });
      session.openChatSession(true);
      return session;
    }

    // The onMessage callback registered in _addEventListeners is a plain
    // arrow function that doesn't propagate _handleIncomingData's return
    // value ((data) => { this._handleIncomingData(data); }), so there's no
    // promise to await from the callback itself even though the underlying
    // translate-then-render chain is async. Flush enough microtask ticks
    // instead - translateMessage() -> .then(...) -> .catch(passthrough) ->
    // the outer .then(...) in _handleIncomingData that actually renders -
    // same convention already used for the outgoing side's tests.
    async function simulateIncomingMessage(session, overrides = {}) {
      const onMessageCallback = session.client.session.onMessage.mock.calls[0][0];
      onMessageCallback({
        data: {
          AbsoluteTime: new Date().toISOString(),
          Content: "I will check your order status.",
          ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
          Id: "agent-msg-1",
          Type: "MESSAGE",
          ParticipantId: "agent-1",
          DisplayName: "Agent Smith",
          ParticipantRole: "AGENT",
          ...overrides,
        },
      });
      for (let i = 0; i < 6; i++) {
        await Promise.resolve();
      }
    }

    test("translates an incoming agent message before it reaches the customer's transcript", async () => {
      translateMessage.mockResolvedValue({
        translatedMessage: "Je vais vérifier le statut de votre commande.",
        sourceLanguage: "en",
        targetLanguage: "fr",
        translationApplied: true,
      });
      const session = createSessionWithTranslation();

      await simulateIncomingMessage(session);

      expect(translateMessage).toBeCalledWith({
        apiEndpoint: TRANSLATE_ENDPOINT,
        contactId: session.contactId,
        direction: TRANSLATION_DIRECTION.AGENT_TO_CUSTOMER,
        message: "I will check your order status.",
        agentLanguage: "en",
      });
      const item = session.transcript.find((i) => i.id === "agent-msg-1");
      expect(item).toBeDefined();
      expect(item.content.data).toEqual("Je vais vérifier le statut de votre commande.");
    });

    test("does not translate when translation is disabled for the brand", async () => {
      const session = createSessionWithTranslation({enabled: false});

      await simulateIncomingMessage(session);

      expect(translateMessage).not.toBeCalled();
      const item = session.transcript.find((i) => i.id === "agent-msg-1");
      expect(item.content.data).toEqual("I will check your order status.");
    });

    test("does not translate messages from a bot/system participant, only a real AGENT", async () => {
      const session = createSessionWithTranslation();

      await simulateIncomingMessage(session, {ParticipantId: "bot-1", ParticipantRole: "SYSTEM", DisplayName: "BOT"});

      expect(translateMessage).not.toBeCalled();
      const item = session.transcript.find((i) => i.id === "agent-msg-1");
      expect(item.content.data).toEqual("I will check your order status.");
    });

    test("does not translate non-text agent content (e.g. interactive messages)", async () => {
      const session = createSessionWithTranslation();

      await simulateIncomingMessage(session, {
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_MESSAGE,
        Content: JSON.stringify({templateType: "QuickReply"}),
      });

      expect(translateMessage).not.toBeCalled();
    });

    test("translates markdown-typed agent messages too, not just plain text", async () => {
      // Regression guard: Amazon Connect's out-of-box Agent Workspace
      // composer is rich-text and sends its messages as text/markdown by
      // default (launcher.js declares "text/markdown" as a supported
      // messaging content type for this contact) - gating on TEXT_PLAIN
      // alone silently skipped translating every real agent reply.
      translateMessage.mockResolvedValue({
        translatedMessage: "Bonjour, comment puis-je vous aider ?",
        sourceLanguage: "en",
        targetLanguage: "fr",
        translationApplied: true,
      });
      const session = createSessionWithTranslation();

      await simulateIncomingMessage(session, {
        ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
        Content: "Hi, how can I help you?",
      });

      expect(translateMessage).toBeCalledWith(
        expect.objectContaining({
          direction: TRANSLATION_DIRECTION.AGENT_TO_CUSTOMER,
          message: "Hi, how can I help you?",
        })
      );
      const item = session.transcript.find((i) => i.id === "agent-msg-1");
      expect(item.content.data).toEqual("Bonjour, comment puis-je vous aider ?");
    });

    test("fails open and displays the agent's original message when translation errors", async () => {
      translateMessage.mockRejectedValue(new Error("network error"));
      const session = createSessionWithTranslation();

      await simulateIncomingMessage(session);

      const item = session.transcript.find((i) => i.id === "agent-msg-1");
      expect(item.content.data).toEqual("I will check your order status.");
    });

    test("translates historical agent messages when the transcript loads (initial load, pagination, or a page reload/resume)", async () => {
      translateMessage.mockResolvedValue({
        translatedMessage: "Je vais vérifier le statut de votre commande.",
        sourceLanguage: "en",
        targetLanguage: "fr",
        translationApplied: true,
      });
      const session = createSessionWithTranslation();
      session.client.getTranscript = jest.fn().mockResolvedValue({
        data: {
          Transcript: [
            {
              Id: "agent-historical-1",
              Type: "MESSAGE",
              ParticipantId: "agent-1",
              AbsoluteTime: AbsoluteTime,
              ParticipantRole: "AGENT",
              ContentType: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
              Content: "I will check your order status.",
            },
          ],
          NextToken: null,
        },
      });

      const connectionEstablishedCallback = session.client.session.onConnectionEstablished.mock.calls[0][0];
      await connectionEstablishedCallback();

      expect(translateMessage).toBeCalledWith({
        apiEndpoint: TRANSLATE_ENDPOINT,
        contactId: session.contactId,
        direction: TRANSLATION_DIRECTION.AGENT_TO_CUSTOMER,
        message: "I will check your order status.",
        agentLanguage: "en",
      });
      const item = session.transcript.find((i) => i.id === "agent-historical-1");
      expect(item).toBeDefined();
      expect(item.content.data).toEqual("Je vais vérifier le statut de votre commande.");
    });
  });
});
