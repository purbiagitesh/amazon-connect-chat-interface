import React from "react";
import {IntlProvider} from 'react-intl';
import ChatComposer from "./ChatComposer";
import {ThemeProvider} from "../../../theme";
import {render, fireEvent, screen, prettyDOM} from "@testing-library/react";
import {act} from "react-dom/test-utils";
import userEvent from "@testing-library/user-event";
import {ContentType} from "../datamodel/Model";
import {KEYBOARD_KEY_CONSTANTS} from "connect-constants";
import "@testing-library/jest-dom";

const mockAttachmentsFile = {
  name: "testUpload.pdf",
  type: ContentType.ATTACHMENT_CONTENT_TYPE.PDF,
  size: 1,
};

let mockComposer;
let mockProps;

function renderElement(props) {
  mockComposer = render(
    <ThemeProvider>
      <IntlProvider
          locale="en"
          key="en"
          messages={{}}>
        <ChatComposer {...props}/>
      </IntlProvider>
    </ThemeProvider>
  );
}

jest.useFakeTimers();
jest.spyOn(global, "setTimeout");
describe("when window.connect is not defined", () => {
  beforeEach(() => {
    const onTyping = jest.fn().mockResolvedValue(undefined);
    const addMessage = jest.fn().mockResolvedValue(undefined);
    const addAttachment = jest.fn().mockResolvedValue(undefined);
    mockProps = {
      onTyping: onTyping,
      addAttachment: addAttachment,
      addMessage: addMessage,
      contactId: "12344",
      contactStatus: "connected",
      typedMessage: "",
      composerConfig: {attachmentsEnabled: true},
      // The attach icon only shows once the bot's current step asks for a
      // file (see modelUtils.isAttachmentExpectedMessage) - most of these
      // tests exercise the attach mechanics themselves, so default it on
      // here; "Should not be able to see the paperclip icon..." below covers
      // the gated-off cases explicitly.
      attachmentStepActive: true,
    };
    navigator.__defineGetter__("userAgent", function () {
      return "Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X)";
    });
  });

  test("Style should match the snapshot", () => {
    renderElement(mockProps);
    expect(mockComposer).toMatchSnapshot();
  });

  test("Should not be able to see the paperclip icon without permission", () => {
    mockProps.composerConfig.attachmentsEnabled = false;
    renderElement(mockProps);
    expect(mockComposer.queryByTestId("customer-chat-file-select")).toBeNull();
  });

  test("Should not be able to see the paperclip icon when the current step doesn't need an attachment", () => {
    mockProps.attachmentStepActive = false;
    renderElement(mockProps);
    expect(mockComposer.queryByTestId("customer-chat-file-select")).toBeNull();
  });

  test("Should be able to send an attachment", () => {
    renderElement(mockProps);
    const fileInput = mockComposer.getByTestId("customer-chat-file-select");
    fireEvent.change(fileInput, {target: { files: [mockAttachmentsFile]} });
    const textInput = mockComposer.getByTestId("customer-chat-text-input");
    fireEvent.keyDown(textInput, {key: KEYBOARD_KEY_CONSTANTS.ENTER});
    expect(mockProps.addAttachment).toHaveBeenCalledTimes(1);
    expect(mockProps.addAttachment).toHaveBeenCalledWith(mockProps.contactId, {
      ...mockAttachmentsFile,
    });
  });

  test("Should be able to send an attachment via the send message button", () => {
    renderElement(mockProps);

    const fileInput = mockComposer.getByTestId("customer-chat-file-select");
    fireEvent.change(fileInput, {target: { files: [mockAttachmentsFile]} });

    const sendMessageButton = mockComposer.getByTestId("customer-chat-send-message-button");
    fireEvent.click(sendMessageButton);

    expect(mockProps.addAttachment).toHaveBeenCalledTimes(1);
    expect(mockProps.addAttachment).toHaveBeenCalledWith(mockProps.contactId, {
      ...mockAttachmentsFile,
    });
  });

  test("Should disable the text input and the attach icon while an attachment is being sent, then re-enable both once sent", async () => {
    renderElement(mockProps);
    const fileInput = mockComposer.getByTestId("customer-chat-file-select");
    fireEvent.change(fileInput, {target: {files: [mockAttachmentsFile]}});

    const textInput = mockComposer.getByTestId("customer-chat-text-input");
    const attachmentIcon = mockComposer.getByTestId("customer-chat-attachment-icon");
    expect(textInput).not.toBeDisabled();
    expect(fileInput).not.toBeDisabled();
    expect(attachmentIcon).toHaveAttribute("tabIndex", "0");

    const sendMessageButton = mockComposer.getByTestId("customer-chat-send-message-button");
    fireEvent.click(sendMessageButton);

    // Locked immediately - the addAttachment promise hasn't settled yet.
    expect(textInput).toBeDisabled();
    expect(fileInput).toBeDisabled();
    expect(attachmentIcon).toHaveAttribute("tabIndex", "-1");

    // Selecting another file while the icon is disabled must not stage it.
    const secondFile = {name: "duringSend.pdf", type: ContentType.ATTACHMENT_CONTENT_TYPE.PDF, size: 1};
    fireEvent.change(fileInput, {target: {files: [secondFile]}});
    expect(mockComposer.queryByText("duringSend.pdf")).toBeNull();

    // Flush addAttachment's own promise plus the Promise.all/.catch/.finally
    // chain built on top of it in sendAttachments.
    await act(async () => {
      await mockProps.addAttachment.mock.results[0].value;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(textInput).not.toBeDisabled();
    expect(fileInput).not.toBeDisabled();
    expect(attachmentIcon).toHaveAttribute("tabIndex", "0");
    expect(mockProps.addAttachment).toHaveBeenCalledTimes(1);
  });

  test("Should be able to send a message via the send message button", async () => {
    renderElement(mockProps);

    const testMessage = "Hello, World!";
    const textInput = mockComposer.getByTestId("customer-chat-text-input");
    userEvent.type(textInput, testMessage);

    const sendMessageButton = mockComposer.getByTestId("customer-chat-send-message-button");
    fireEvent.click(sendMessageButton);

    expect(mockProps.addMessage).toHaveBeenCalledTimes(1);
    expect(mockProps.addMessage).toHaveBeenCalledWith(mockProps.contactId, {
      text: testMessage,
    });
  });

  test("Should be able to jitter to fix iphone mobile scroll issue", () => {
    renderElement(mockProps);

    const testMessage = "Hello, World!";
    const textInput = mockComposer.getByTestId("customer-chat-text-input");
    userEvent.type(textInput, testMessage);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 300);
    jest.runOnlyPendingTimers();
  });

  test("Should be able to send an attachment plus additional text via the send message button", () => {
    renderElement(mockProps);

    const fileInput = mockComposer.getByTestId("customer-chat-file-select");
    fireEvent.change(fileInput, {target: { files: [mockAttachmentsFile]} });

    const testMessage = "Hello, World!";
    const textInput = mockComposer.getByTestId("customer-chat-text-input");
    userEvent.type(textInput, testMessage);

    const sendMessageButton = mockComposer.getByTestId("customer-chat-send-message-button");
    fireEvent.click(sendMessageButton);

    expect(mockProps.addAttachment).toHaveBeenCalledTimes(1);
    expect(mockProps.addAttachment).toHaveBeenCalledWith(mockProps.contactId, {
      ...mockAttachmentsFile,
    });

    expect(mockProps.addMessage).toHaveBeenCalledTimes(1);
    expect(mockProps.addMessage).toHaveBeenCalledWith(mockProps.contactId, {
      text: testMessage,
    });
  });

  test("Should not send message if send button is clicked and there is no input", () => {
    renderElement(mockProps);
    const sendMessageButton = mockComposer.getByTestId("customer-chat-send-message-button");
    fireEvent.click(sendMessageButton);

    expect(mockProps.addMessage).toHaveBeenCalledTimes(0);
  });

  test("Should be able to unselect an attachment", () => {
    renderElement(mockProps);
    const fileInput = mockComposer.getByTestId("customer-chat-file-select");
    fireEvent.change(fileInput, {target: { files: [mockAttachmentsFile]} });
    const textInput = mockComposer.getByTestId("customer-chat-text-input");
    fireEvent.keyDown(textInput, {key: KEYBOARD_KEY_CONSTANTS.DELETE});
    fireEvent.keyDown(textInput, {key: KEYBOARD_KEY_CONSTANTS.ENTER});
    expect(mockProps.addAttachment).toHaveBeenCalledTimes(0);
  });

  test("Should not allow staging more than five attachments at a time", () => {
    renderElement(mockProps);
    const sixFiles = Array.from({length: 6}, (_, i) => ({
      name: `testUpload${i + 1}.pdf`,
      type: ContentType.ATTACHMENT_CONTENT_TYPE.PDF,
      size: 1,
    }));
    const fileInput = mockComposer.getByTestId("customer-chat-file-select");
    fireEvent.change(fileInput, {target: {files: sixFiles}});

    // Only the first five of the six selected files get staged.
    for (let i = 1; i <= 5; i++) {
      expect(mockComposer.getByText(`testUpload${i}.pdf`)).toBeInTheDocument();
    }
    expect(mockComposer.queryByText("testUpload6.pdf")).toBeNull();
    expect(mockComposer.getByTestId("customer-chat-attachment-limit-message")).toBeInTheDocument();

    const textInput = mockComposer.getByTestId("customer-chat-text-input");
    fireEvent.keyDown(textInput, {key: KEYBOARD_KEY_CONSTANTS.ENTER});
    expect(mockProps.addAttachment).toHaveBeenCalledTimes(5);
  });

  test("Should ignore a further file once already at the five-attachment limit", () => {
    renderElement(mockProps);
    const fiveFiles = Array.from({length: 5}, (_, i) => ({
      name: `testUpload${i + 1}.pdf`,
      type: ContentType.ATTACHMENT_CONTENT_TYPE.PDF,
      size: 1,
    }));
    const fileInput = mockComposer.getByTestId("customer-chat-file-select");
    fireEvent.change(fileInput, {target: {files: fiveFiles}});
    expect(mockComposer.queryByTestId("customer-chat-attachment-limit-message")).toBeNull();

    fireEvent.change(fileInput, {target: {files: [mockAttachmentsFile]}});
    expect(mockComposer.queryByText(mockAttachmentsFile.name)).toBeNull();
    expect(mockComposer.getByTestId("customer-chat-attachment-limit-message")).toBeInTheDocument();

    const textInput = mockComposer.getByTestId("customer-chat-text-input");
    fireEvent.keyDown(textInput, {key: KEYBOARD_KEY_CONSTANTS.ENTER});
    expect(mockProps.addAttachment).toHaveBeenCalledTimes(5);
  });

  // Figma pins the attach icon immediately to the left of send (both on the
  // right edge of the pill), so DOM/tab order is: text input -> attach icon
  // container -> attach icon's inner <button> -> send button. (The
  // attachment control has two nested focusable nodes - the outer container
  // owns the Space/Enter handler under test, the inner <button> is an
  // incidental extra stop from being a native button - both pre-date this
  // reorder and are out of scope here.)
  test("Should be able to click send button using Tab and Space", () => {
    renderElement(mockProps);
    const textInput = document.querySelector('[aria-label="Type a message"]');
    const testMessage = "Hello, World!";
    userEvent.type(textInput, testMessage);
    userEvent.tab(); // attachment icon container
    userEvent.tab(); // attachment icon's inner button
    userEvent.tab(); // send button
    const sendMessageButton = mockComposer.getByTestId("customer-chat-send-message-button");
    expect(sendMessageButton).toHaveFocus();
    fireEvent.keyDown(sendMessageButton, {key: KEYBOARD_KEY_CONSTANTS.SPACE});
    expect(mockProps.addMessage).toHaveBeenCalledTimes(1);
  });

  test("Should be able to click send button using Tab and Enter", () => {
    renderElement(mockProps);
    const textInput = document.querySelector('[aria-label="Type a message"]');
    const testMessage = "Hello, World!";
    userEvent.type(textInput, testMessage);
    userEvent.tab(); // attachment icon container
    userEvent.tab(); // attachment icon's inner button
    userEvent.tab(); // send button
    const sendMessageButton = mockComposer.getByTestId("customer-chat-send-message-button");
    expect(sendMessageButton).toHaveFocus();
    fireEvent.keyDown(sendMessageButton, {key: KEYBOARD_KEY_CONSTANTS.ENTER});
    expect(mockProps.addMessage).toHaveBeenCalledTimes(1);
  });

  test("Should be able to click attachment icon using Tab and Space", () => {
    renderElement(mockProps);
    const textInput = document.querySelector('[aria-label="Type a message"]');
    const testMessage = "Hello, World!";
    userEvent.type(textInput, testMessage);
    // focus on the attachment icon container (owns the keyboard handler)
    userEvent.tab();
    const attachmentIcon = mockComposer.getByTestId("customer-chat-attachment-icon");
    expect(attachmentIcon).toHaveFocus();
    // TODO: add test for verifying the click event
    fireEvent.keyDown(attachmentIcon, {key: KEYBOARD_KEY_CONSTANTS.SPACE});
  });

  test("Should be able to click attachment icon using Tab and Enter", () => {
    renderElement(mockProps);
    const textInput = document.querySelector('[aria-label="Type a message"]');
    const testMessage = "Hello, World!";
    userEvent.type(textInput, testMessage);
    // focus on the attachment icon container (owns the keyboard handler)
    userEvent.tab();
    const attachmentIcon = mockComposer.getByTestId("customer-chat-attachment-icon");
    expect(attachmentIcon).toHaveFocus();
    // TODO: add test for verifying the click event
    fireEvent.keyDown(attachmentIcon, {key: KEYBOARD_KEY_CONSTANTS.ENTER});
  });
});

describe("when window.connect is defined", () => {
  beforeEach(() => {
    window.connect = {
      LogManager: {
        getLogger: function (obj) {
          return {
            debug: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
          };
        },
      },
    };
  });

  test("Style should match the snapshot", () => {
    renderElement(mockProps);
    expect(mockComposer).toMatchSnapshot();
  });

  test("Should be able to send an attachment via the send message button", () => {
    renderElement(mockProps);

    const fileInput = mockComposer.getByTestId("customer-chat-file-select");
    fireEvent.change(fileInput, {target: { files: [mockAttachmentsFile]} });

    const sendMessageButton = mockComposer.getByTestId("customer-chat-send-message-button");
    fireEvent.click(sendMessageButton);

    expect(mockProps.addAttachment).toHaveBeenCalledTimes(1);
    expect(mockProps.addAttachment).toHaveBeenCalledWith(mockProps.contactId, {
      ...mockAttachmentsFile,
    });
  });

  it("should not render richtoolbar when missing optional supportedMessagingContentTypes input", () => {
    mockProps.composerConfig.richMessagingEnabled = false;
    delete mockProps.composerConfig.supportedMessagingContentTypes;
    renderElement(mockProps);

    expect(() => mockComposer.getByTestId("rich-text-editor")).toThrow("Unable to find an element");
  });

  // The rich-text composer is force-disabled regardless of richMessagingEnabled
  // (see ChatComposer.js's FORCE_DISABLE_RICH_MESSAGING - Figma spec calls for
  // a plain single-line composer), so this stays absent even when enabled.
  it("should not render richtoolbar even when given supportedMessagingContentTypes input", () => {
    mockProps.composerConfig.richMessagingEnabled = true;
    mockProps.composerConfig.supportedMessagingContentTypes = "text/plain,text/markdown";
    renderElement(mockProps);

    expect(() => mockComposer.getByTestId("rich-text-editor")).toThrow("Unable to find an element");
  });
});
