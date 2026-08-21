import React, {useState, useLayoutEffect, useEffect, useRef, useMemo, useCallback} from "react";
import {useIntl} from 'react-intl'
import styled from "styled-components";
import throttle from "lodash/throttle";
import PT from "prop-types";
import {CONTACT_STATUS, KEYBOARD_KEY_CONSTANTS} from "connect-constants";
import TextareaAutosize from "react-textarea-autosize";
import SendMessageButton from "./SendMessageButton";
import Disclaimer from "./Disclaimer";
import {RichTextEditor} from "../RichMessageComponents";

import {ATTACHMENT_ACCEPT_CONTENT_TYPES, AttachmentStatus, ContentType} from "../datamodel/Model";

// Defaults for the "Standard" and "With Character Counter" Input Field variants (Figma spec).
const DEFAULT_COMPOSER_MAX_LENGTH = 200;
const DEFAULT_CHARACTER_COUNTER_THRESHOLD = 150;
const DEFAULT_COMPOSER_MAX_ROWS = 5;

// ---------------------------------------------------------------------------
// MOCK ATTACHMENT BACKEND ("With Media Attached" Figma variant)
// ---------------------------------------------------------------------------
// AWS Connect chat does not currently expose a multi-attachment upload API -
// the real SDK just sends one raw file per message with no upload-status
// payload. Until that backend contract exists, `mockAttachmentUploadResponse`
// simulates it locally so each media chip has a real async `status` to react
// to (see the `status` field on attachment entries in `addFiles` below).
// The resolved shape here is only a guess at what a future response may look
// like - it is NOT on the critical path for actually sending an attachment
// (that still goes through the real `addAttachment` prop / chatSession).
//
// TO WIRE UP THE REAL API LATER:
//   Swap the body of this function for the real backend/chatSession call,
//   keeping the same resolved shape ({ attachmentId, status }), or update
//   the single call site in `addFiles` if the real response differs.
// ---------------------------------------------------------------------------
const MOCK_ATTACHMENT_UPLOAD_LATENCY_MS = 600;

function mockAttachmentUploadResponse(file) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        attachmentId: `mock-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        // A real backend may resolve AttachmentStatus.REJECTED (oversized file,
        // disallowed type, etc.) - the mock always approves.
        status: AttachmentStatus.APPROVED,
      });
    }, MOCK_ATTACHMENT_UPLOAD_LATENCY_MS);
  });
}

function isMediaFile(file) {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

let attachmentIdSeed = 0;
function nextAttachmentId() {
  attachmentIdSeed += 1;
  return `attachment-${Date.now()}-${attachmentIdSeed}`;
}

// "With Character Counter" variant: hidden below the threshold, then tracks length live;
// switches to the error copy once the consumer hits maxLength.
function getCharacterCounterText(intl, count, maxLength, hasError) {
  if (hasError) {
    return intl.formatMessage(
      { id: "chatComposer.characterLimitReached", defaultMessage: "You have reached the character limit of {max}." },
      { max: maxLength }
    );
  }
  return intl.formatMessage(
    { id: "chatComposer.characterLimit", defaultMessage: "Character limit: {count}/{max}" },
    { count, max: maxLength }
  );
}

const ChatComposerWrapper = styled.div`
  margin: 0;
  padding: 0;
`;

const DefaultChatComposerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: ${(props) => props.disabled
    ? "var(--color-surface-background-disabled-disabled, #F0F0F0)"
    : `var(--ac-widget-composer-background, ${props.theme.palette.white})`};
  border: ${(props) => props.hasError
    ? `var(--ac-widget-composer-error-border, 1px solid ${props.theme.palette.red})`
    : `var(--ac-widget-composer-border, 1px solid ${props.theme.palette.lightGray})`};
  border-radius: var(--ac-widget-composer-border-radius, 24px);
  margin: var(--ac-widget-composer-margin, 8px 16px 16px);

  @media (max-width: 360px) {
    margin: var(--ac-widget-composer-margin-small, 8px 10px 10px);
  }
`;

// Holds the text input and the right-aligned icon cluster (attach + send) on
// one line. Kept as its own `position: relative` row (rather than putting
// that on DefaultChatComposerWrapper) so the icon cluster stays vertically
// centered on this row even when the media chips row above it changes the
// wrapper's total height.
const ComposerInputRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

// Figma places the attach icon directly to the left of the send button, both
// pinned to the right edge of the pill - grouped together here rather than
// the attach icon living on the opposite side of the input.
const ComposerRightIcons = styled.div`
  position: absolute;
  top: 50%;
  right: var(--ac-widget-composer-send-button-offset, ${(props) => props.theme.spacing.small});
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: var(--ac-widget-composer-icons-gap, ${(props) => props.theme.spacing.mini});
  z-index: 2;
`;

const PaperClipContainer = styled.div`
  cursor: pointer;
  height: auto;
  vertical-align: top;

  button {
    height: 100%;
    width: 100%;
  }

  label {
    align-items: center;
    display: flex;
    cursor: pointer;
    font-size: 0;
    height: 100%;
    margin-bottom: 0;
  }

  input {
    display: none;
  }
`;

const IconButton = styled.button`
  background-color: transparent;
  border: 1px solid transparent;
  position: relative;
  padding: 0;
  margin: 0;
`;

const AttachmentContainer = styled.div`
  --outgoingMsgBg-background-color: ${(props) => props.theme.chatTranscriptor.outgoingMsgBg};
  display: flex;
  background-color: var(--ac-widget-transcript-customer-bubble-color, var(--outgoingMsgBg-background-color));
  border-radius: 5px;
  margin: 5px;
  padding: ${(props) => props.theme.spacing.mini};
  min-width: 0;

  & > div {
    width: 100%;

    span {
      overflow-wrap: break-word;
    }

    button {
      align-items: center;
      display: inline-flex;
      cursor: pointer;
      margin-left: 5px;
    }
  }

  & + div {
    padding-left: 0;
  }
`;

const TextInput = styled(TextareaAutosize)`
  flex: 1;
  outline: none;
  user-select: text;
  word-break: break-word;
  font-family: inherit;
  padding: ${(props) => props.theme.spacing.small};
  padding-left: ${(props) => props.theme.spacing.base};
  /* Reserves room for the right-aligned attach + send icon cluster
     (ComposerRightIcons) so typed text never runs underneath it. */
  padding-right: var(--ac-widget-composer-icons-clearance, 84px);
  background: transparent;
  line-height: 1.5rem;
  overflow-y: auto;
  min-height: 39px;
  z-index: 2;
  resize: none;
  letter-spacing: ${(props) => props.theme.globals.letterSpacing};
  font-size: var(--ac-widget-composer-fontsize, var(--ac-widget-global-fontsize, 16px));
  border: none;

  /* Figma shows no scrollbar past the 5-line cap; keep the box scrollable
     (text beyond 5 lines must stay reachable) but hide the scrollbar chrome. */
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  &::placeholder {
    color: ${(props) => props.theme.palette.mediumGray};
  }

  &:focus::placeholder {
    color: transparent;
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const PaperClipIcon = styled.div`
  display: flex;
  font-size: 0;

  svg {
    width: 24px;
    height: 24px;
  }
`;

const CloseIcon = styled.div`
  display: flex;
  font-size: 0;
  svg {
    width: ${({ theme}) => theme.fontsSize.mini};
    height: ${({ theme}) => theme.fontsSize.mini};
  }
`;

// ---------------------------------------------------------------------------
// "With Media Attached" chip carousel (Figma spec)
// ---------------------------------------------------------------------------
const MediaAttachmentsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.micro};
  padding: ${(props) => props.theme.spacing.mini} ${(props) => props.theme.spacing.mini} 0;
`;

const MediaChipScrollArea = styled.div`
  display: flex;
  gap: ${(props) => props.theme.spacing.mini};
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const MEDIA_CHIP_SIZE_PX = 56;

const MediaChip = styled.div`
  position: relative;
  flex: 0 0 auto;
  width: var(--ac-widget-composer-media-chip-size, ${MEDIA_CHIP_SIZE_PX}px);
  height: var(--ac-widget-composer-media-chip-size, ${MEDIA_CHIP_SIZE_PX}px);
`;

const MediaChipVisual = styled.div`
  width: 100%;
  height: 100%;
  border-radius: var(--ac-widget-composer-media-chip-radius, 12px);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: var(--ac-widget-composer-media-chip-background, ${(props) => props.theme.palette.whisper});
  color: var(--ac-widget-composer-media-chip-icon-color, ${(props) => props.theme.palette.silver});
  border: ${(props) => (props.status === "rejected"
    ? `1px solid var(--ac-widget-composer-media-chip-error-border, ${props.theme.palette.red})`
    : "1px solid transparent")};
  /* Mock upload is purely local bookkeeping today (see mockAttachmentUploadResponse) -
     dim the chip slightly while it's "in flight" so there is somewhere for a
     real pending/loading state to hook in later. */
  opacity: ${(props) => (props.status === "uploading" ? 0.6 : 1)};
  transition: opacity 0.15s ease;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  svg {
    width: 60%;
    height: 60%;
  }
`;

const MediaChipRemoveButton = styled.button`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
  line-height: 0;

  svg {
    width: 20px;
    height: 20px;
  }
`;

const ScrollArrowButton = styled.button`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--ac-widget-composer-media-scroll-arrow-color, ${(props) => props.theme.palette.mediumGray});

  svg {
    width: 18px;
    height: 18px;
  }
`;

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Generic placeholder glyph shown until a real thumbnail/preview is
// available for a chip (see previewUrl usage in ChatComposer). Mirrors the
// Figma reference icon: a rounded square with a picture glyph.
function ImagePlaceholderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 8v10H6V8h8Zm0-1H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1ZM9.83 12.9 7.83 15.4 6.5 13.83 4.5 16.33h9l-2.86-3.43-.81.99Z" fill="currentColor" />
    </svg>
  );
}

// Video attachments always use this placeholder (no real thumbnail) since
// grabbing a genuine poster frame needs canvas work that isn't built yet -
// matches the 3rd chip in the Figma reference.
function VideoPlaceholderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="6.5" fill="currentColor" fillOpacity="0.4" />
      <path d="M8.5 7.3v5.4l4.5-2.7-4.5-2.7Z" fill="currentColor" />
    </svg>
  );
}

// Circular "x" remove badge overlapping the top-right corner of a chip -
// mirrors the reference icon's badge.
function RemoveBadgeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="var(--ac-widget-composer-media-chip-badge-bg, #232F3E)" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Attach-media trigger icon (picture glyph + solid "+" badge), replacing the
// previous plain paperclip per the exported Figma "With Media Attached" icon.
function AttachMediaIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
      <rect x="2" y="4" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="9" r="1.3" fill="currentColor" />
      <path d="M3.5 15.5 8 11l2.5 2.5L15 9l3.5 5v1a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-.5Z" fill="currentColor" />
      <circle cx="18.5" cy="17.5" r="4.5" fill="var(--ac-widget-composer-attach-badge-bg, #232F3E)" />
      <path d="M18.5 15.7v3.6M16.7 17.5h3.6" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const CharacterCounter = styled.div`
  text-align: center;
  color: ${(props) => props.hasError
    ? `var(--ac-widget-composer-error-color, ${props.theme.palette.red})`
    : `var(--ac-widget-composer-counter-color, ${props.theme.palette.mediumGray})`};
  font-size: var(--ac-widget-composer-counter-fontsize, 12px);
  margin: 4px 16px;
`;

const DisclaimerText = styled.div`
  text-align: center;
  color: var(--ac-widget-composer-disclaimer-color, ${(props) => props.theme.palette.mediumGray});
  font-size: var(--ac-widget-composer-disclaimer-fontsize, 12px);
  margin: 0 16px 8px;
`;  //Text value to add in footer

ChatComposer.propTypes = {
  addMessage: PT.func,
  addAttachment: PT.func,
  onTyping: PT.func,
  contactId: PT.string.isRequired,
  contactStatus: PT.string.isRequired,
  onTypingValidityTime: PT.number,
  composerConfig: PT.object,
  disclaimerConfig: PT.object,
  disabled: PT.bool,
  attachmentStepActive: PT.bool,
};

ChatComposer.defaultProps = {
  onTypingValidityTime: 10 * 1000,
  disabled: false,
  attachmentStepActive: false,
};

export default function ChatComposer({addMessage, addAttachment, onTyping, contactId, contactStatus, onTypingValidityTime, textInputRef, composerConfig, disclaimerConfig, disabled, attachmentStepActive}) {
  let logger;
  let mobileJitter;
  if (window.connect && window.connect.LogManager) {
    logger = window.connect.LogManager.getLogger({
      prefix: "ChatInterface-ChatComposer",
    });
  }
  const [message, setMessage] = useState("");
  // Multiple staged attachments: [{ id, file, isMedia, isVideo, previewUrl, status }].
  // `status` is "uploading" | "ready" | "rejected" and is only ever set by
  // the mock in mockAttachmentUploadResponse() today - see the comment there
  // for how to wire in the real backend response later.
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
  const mediaScrollRef = useRef(null);
  const [canScrollMediaLeft, setCanScrollMediaLeft] = useState(false);
  const [canScrollMediaRight, setCanScrollMediaRight] = useState(false);
  // Recording/privacy disclaimer: expanded by default at the start of a new
  // session, auto-collapses the first time the consumer sends a message,
  // and stays toggleable (Show more/less) for the rest of that session.
  const [isDisclaimerExpanded, setIsDisclaimerExpanded] = useState(true);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // Mirrors `attachments` for use in the unmount cleanup effect below without
  // making that effect re-run (and re-subscribe) on every attachment change.
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  useEffect(() => {
    logger && logger.info("Component mounted.");
  }, [logger]);

  // A new contactId means a new chat session - the disclaimer reappears in
  // its default expanded state per the Figma spec.
  useEffect(() => {
    setIsDisclaimerExpanded(true);
    setHasSentFirstMessage(false);
  }, [contactId]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
    };
  }, []);

  useLayoutEffect(() => {
    if (!textInputRef || !textInputRef.current || !textInputRef.current.focus) {
      return;
    }
    textInputRef.current.focus();
  }, [attachments.length, textInputRef]);

  function hasSameContent(event) {
    return event.target.innerText === message;
  }

  function onInput(event) {
    if (!event.shiftKey && event.key === KEYBOARD_KEY_CONSTANTS.ENTER) {
      event.preventDefault();
      sendMessage();

      return false;
    } else {
      if (!hasSameContent(event)) {
        throttledOnTyping();
      }
      setMessage(event.target.value);
    }

    if (event.key === KEYBOARD_KEY_CONSTANTS.DELETE || event.key === KEYBOARD_KEY_CONSTANTS.BACKSPACE) {
      if (attachments.length > 0 && message === "") {
        event.preventDefault();
        // Removes the most recently attached chip first, like clearing
        // tokens in a normal text field.
        removeAttachment(attachments[attachments.length - 1].id);
        return;
      }
    }
  }

  /**
   * Fix for https://app.asana.com/0/1200039825797577/1202475657019640/f
   * Bug: In iOS browser when we focus on input elem, virtual keyboard pops up on top of the chat content and we can not scroll and view entire chat.
   * Fix: We create a temp input element at top of screen and set focus, then we set focus back to the actual input element.
   *      This forces the viewport scrollbar to recalculate scroll position initially to focus on top of the new viewport screen and then to the bottom which brings actual input element within the new viewport.
   *      Note: "new viewport" - refers to the small screen after virtual keyboard is displayed on iphone.
   */
  function onTextInputFocus() {
    setIsInputFocused(true);
    if (!mobileJitter && isIphone()) {
      mobileJitter = true;
      const tempInputElem = document.createElement("input");
      const chatWidgetWrapper = document.querySelector('[data-testid="amazon-connect-chat-wrapper"] div');
      if (chatWidgetWrapper) {
        chatWidgetWrapper.appendChild(tempInputElem);
        tempInputElem.focus();
      }

      setTimeout(() => {
        textInputRef && textInputRef.current && textInputRef.current.focus();
        tempInputElem.remove();
        mobileJitter = false;
      }, 300);
    }
  }

  function onTextInputBlur() {
    setIsInputFocused(false);
  }

  function isIphone() {
    const userAgent = window.navigator && window.navigator.userAgent;
    return userAgent && userAgent.search(/iPhone/i) !== -1;
  }

  /**
   * Cancel any pending (not flushed) typing events, send the message (and attachment if applicable), and clear input bar.
   */
  function sendMessage() {
    throttledOnTyping.cancel();
    sendTextMessage(message);
    setMessage("");

    if (attachments.length > 0) {
      sendAttachments();
      clearFileInput();
    }

    if (!hasSentFirstMessage) {
      setHasSentFirstMessage(true);
      setIsDisclaimerExpanded(false);
    }
  }

  function toggleDisclaimerExpanded() {
    setIsDisclaimerExpanded((expanded) => !expanded);
  }

  const throttleOptions = useMemo(
    () => ({trailing: false, leading: true}),
    []
  );

  const throttledOnTyping = useMemo(
    () =>
      throttle(
        () => {
          onTyping().then(() => {
            console.log("On typing event");
          });
        },
        onTypingValidityTime,
        throttleOptions
      ),
    [onTyping, onTypingValidityTime, throttleOptions]
  );

  function sendTextMessage(text) {
    if (text.trim()) {
      addMessage(contactId, {text});
    }
  }

  function sendMarkdownMessage(markdownMessage) {
    throttledOnTyping.cancel();
    if (markdownMessage.trim()) {
      addMessage(contactId, {
        text: markdownMessage,
        type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN,
      });
    }
  }

  function updateAttachment(id, changes) {
    setAttachments((current) => current.map((entry) => (entry.id === id ? {...entry, ...changes} : entry)));
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    const newEntries = files.map((file) => {
      const media = isMediaFile(file);
      const isVideo = file.type.startsWith("video/");
      return {
        id: nextAttachmentId(),
        file,
        isMedia: media,
        isVideo,
        // Images get a real local preview since we already have the file in
        // the browser; videos fall back to the placeholder glyph (matches
        // the Figma reference) since grabbing a genuine poster frame needs
        // canvas work that isn't built yet.
        previewUrl: media && !isVideo ? URL.createObjectURL(file) : null,
        status: "uploading",
      };
    });

    setAttachments((current) => [...current, ...newEntries]);
    logger && logger.info(`${newEntries.length} file(s) added.`);

    // MOCK: see mockAttachmentUploadResponse() above - this is where a real
    // backend upload-status response would be consumed once available.
    newEntries.forEach((entry) => {
      mockAttachmentUploadResponse(entry.file).then((response) => {
        updateAttachment(entry.id, {
          status: response.status === AttachmentStatus.APPROVED ? "ready" : "rejected",
        });
      });
    });
  }

  function removeAttachment(id) {
    setAttachments((current) => {
      const entry = current.find((item) => item.id === id);
      if (entry && entry.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
    logger && logger.info(`Attachment removed.`);
  }

  function onFileInput(e) {
    addFiles(e.target.files);
  }

  function clearFileInput() {
    attachments.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
    setAttachments([]);
    fileInputRef.current.value = null;
    logger && logger.info(`Attachments cleared.`);
  }

  function sendAttachments() {
    // AWS Connect chat sends one attachment per message, so a multi-file
    // composer selection is fanned out into one addAttachment call per file,
    // in the order they were attached. Anything the mock (or a future real
    // check) has flagged "rejected" is skipped.
    attachments
      .filter((entry) => entry.status !== "rejected")
      .forEach((entry) => addAttachment(contactId, entry.file));
  }

  function sendAttachmentGivenFile(file) {
    addAttachment(contactId, file);
  }

  // "With Media Attached" variant only applies to images/videos; other file
  // types (pdf, doc, etc.) keep the pre-existing filename-row treatment.
  const mediaAttachments = attachments.filter((entry) => entry.isMedia);
  const documentAttachments = attachments.filter((entry) => !entry.isMedia);

  const updateMediaScrollState = useCallback(() => {
    const el = mediaScrollRef.current;
    if (!el) {
      return;
    }
    setCanScrollMediaLeft(el.scrollLeft > 0);
    setCanScrollMediaRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateMediaScrollState();
  }, [mediaAttachments.length, updateMediaScrollState]);

  function scrollMediaBy(direction) {
    const el = mediaScrollRef.current;
    if (!el) {
      return;
    }
    el.scrollBy({left: direction * MEDIA_CHIP_SIZE_PX * 2, behavior: "smooth"});
  }

  const intl = useIntl();
  // "Standard" variant: placeholder shown until the consumer starts typing.
  const ariaLabel = intl.formatMessage({
    id: "chatComposer.placeholder",
    defaultMessage: "Type a message"
  });
  const placeholder = attachments.length === 0 ? ariaLabel : "";

  const maxLength = (composerConfig && composerConfig.maxLength) || DEFAULT_COMPOSER_MAX_LENGTH;
  const characterCounterThreshold = (composerConfig && composerConfig.characterCounterThreshold) || DEFAULT_CHARACTER_COUNTER_THRESHOLD;
  const isAtCharacterLimit = message.length >= maxLength;
  const showCharacterCounter = isAtCharacterLimit || message.length >= characterCounterThreshold;
  const characterCounterText = getCharacterCounterText(intl, message.length, maxLength, isAtCharacterLimit);

  const richMessagingComposer = (
    <RichTextEditor
      allowedFileContentTypes={ATTACHMENT_ACCEPT_CONTENT_TYPES}
      attachmentsEnabled={composerConfig && composerConfig.attachmentsEnabled && attachmentStepActive}
      sendMessage={sendMarkdownMessage}
      sendAttachment={sendAttachmentGivenFile}
      placeholder={placeholder}
      onTyping={throttledOnTyping}
    ></RichTextEditor>
  );

  const defaultComposer = (
    <>
    <DefaultChatComposerWrapper hasError={isAtCharacterLimit} disabled={disabled}>
      {composerConfig && composerConfig.attachmentsEnabled && mediaAttachments.length > 0 && (
        <MediaAttachmentsRow data-testid="customer-chat-media-attachments">
          {canScrollMediaLeft && (
            <ScrollArrowButton type="button" aria-label="Show previous attachment" onClick={() => scrollMediaBy(-1)}>
              <ChevronLeftIcon />
            </ScrollArrowButton>
          )}
          <MediaChipScrollArea ref={mediaScrollRef} onScroll={updateMediaScrollState}>
            {mediaAttachments.map((entry) => (
              <MediaChip key={entry.id}>
                <MediaChipVisual status={entry.status}>
                  {entry.previewUrl ? (
                    <img src={entry.previewUrl} alt={entry.file.name} />
                  ) : entry.isVideo ? (
                    <VideoPlaceholderIcon />
                  ) : (
                    <ImagePlaceholderIcon />
                  )}
                </MediaChipVisual>
                <MediaChipRemoveButton
                  type="button"
                  aria-label={`Remove ${entry.file.name}`}
                  onClick={() => removeAttachment(entry.id)}
                >
                  <RemoveBadgeIcon />
                </MediaChipRemoveButton>
              </MediaChip>
            ))}
          </MediaChipScrollArea>
          {canScrollMediaRight && (
            <ScrollArrowButton type="button" aria-label="Show more attachments" onClick={() => scrollMediaBy(1)}>
              <ChevronRightIcon />
            </ScrollArrowButton>
          )}
        </MediaAttachmentsRow>
      )}
      <ComposerInputRow>
          {documentAttachments.map((entry) => (
            <AttachmentContainer key={entry.id}>
              <div>
                <span>{entry.file.name}</span>
                <IconButton onClick={() => removeAttachment(entry.id)} aria-label={"Remove attachment"}>
                  <CloseIcon>
                    <svg viewBox="0 0 13 13" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                      <path d="M13 1.3L11.7 0 6.5 5.2 1.3 0 0 1.3l5.2 5.2L0 11.7 1.3 13l5.2-5.2 5.2 5.2 1.3-1.3-5.2-5.2z" fillRule="evenodd" />
                    </svg>
                  </CloseIcon>
                </IconButton>
              </div>
            </AttachmentContainer>
          ))}
          <TextInput
            data-testid="customer-chat-text-input"
            ref={textInputRef}
            value={message}
            onInput={onInput}
            onKeyPress={onInput}
            onKeyDown={onInput}
            onFocus={onTextInputFocus}
            onBlur={onTextInputBlur}
            aria-label={ariaLabel}
            placeholder={placeholder}
            tabIndex="0"
            spellCheck="true"
            maxLength={maxLength}
            maxRows={DEFAULT_COMPOSER_MAX_ROWS}
            disabled={disabled}
          />
          {/* Figma pins the attach icon immediately to the left of send,
              both right-aligned in the pill - grouped in one cluster rather
              than splitting attach (left) and send (right) across the row. */}
          <ComposerRightIcons>
            {composerConfig && composerConfig.attachmentsEnabled && attachmentStepActive && (
              <PaperClipContainer
                tabIndex={0}
                data-testid="customer-chat-attachment-icon"
                onKeyDown={(e) => {
                  // if space or enter is pressed
                  if (e.key === KEYBOARD_KEY_CONSTANTS.SPACE || e.key === KEYBOARD_KEY_CONSTANTS.ENTER) {
                    e.preventDefault();
                    document.getElementById(`customer-chat-file-select-${contactId}`).click();
                  }
                }}
              >
                <IconButton aria-label={"Attach a file"}>
                  <label htmlFor={`customer-chat-file-select-${contactId}`}>
                    <PaperClipIcon>
                      <AttachMediaIcon />
                    </PaperClipIcon>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      id={`customer-chat-file-select-${contactId}`}
                      data-testid={`customer-chat-file-select`}
                      accept={ATTACHMENT_ACCEPT_CONTENT_TYPES.join(",")}
                      onChange={onFileInput}
                      aria-label={"Attach a file"}
                      tabIndex={-1}
                    />
                  </label>
                </IconButton>
              </PaperClipContainer>
            )}
            <SendMessageButton isActive={!!message || attachments.length > 0} sendMessage={sendMessage.bind(this)} />
          </ComposerRightIcons>
      </ComposerInputRow>
    </DefaultChatComposerWrapper>
    {showCharacterCounter && (
      <CharacterCounter data-testid="customer-chat-character-counter" hasError={isAtCharacterLimit}>
        {characterCounterText}
      </CharacterCounter>
    )}
    </>
  );

  // Figma spec calls for a plain single-line composer with no Bold/Italic/list/link/emoji
  // toolbar, so the rich-text composer is force-disabled here regardless of
  // composerConfig.richMessagingEnabled. To restore rich text formatting (e.g. if the design
  // changes back), set FORCE_DISABLE_RICH_MESSAGING to false.
  const FORCE_DISABLE_RICH_MESSAGING = true;

  return (
    <ChatComposerWrapper className="composer">
      { contactStatus === CONTACT_STATUS.CONNECTED && (
        <Disclaimer
          expanded={isDisclaimerExpanded}
          onToggleExpand={toggleDisclaimerExpanded}
          highlighted={isInputFocused}
          privacyPolicyUrl={disclaimerConfig && disclaimerConfig.privacyPolicyUrl}
          termsOfUseUrl={disclaimerConfig && disclaimerConfig.termsOfUseUrl}
        />
      )}
      { contactStatus === CONTACT_STATUS.CONNECTED && (
          composerConfig && composerConfig.richMessagingEnabled && !FORCE_DISABLE_RICH_MESSAGING
              ? richMessagingComposer
              : defaultComposer)
      }
      { contactStatus === CONTACT_STATUS.CONNECTED && (
        <DisclaimerText>
          Virtual Assistant is AI and can make mistakes.
        </DisclaimerText>
      )}
    </ChatComposerWrapper>
  );
}
