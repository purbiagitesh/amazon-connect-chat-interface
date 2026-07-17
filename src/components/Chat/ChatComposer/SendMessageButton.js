import React from 'react';
import styled from 'styled-components';
import defaultTheme from '../../../theme/defaultTheme';
import {KEYBOARD_KEY_CONSTANTS} from "connect-constants";

const ACTIVE_COLOR = '#CFD7FF';
const INACTIVE_COLOR = defaultTheme.palette.whisper;
const ACTIVE_ICON_COLOR = defaultTheme.palette.secondaryBlack;
const INACTIVE_ICON_COLOR = defaultTheme.palette.white;

// The widget is typically rendered inside the vendor's iframe, which never
// loads clientInfo.js itself - only the host page does. Fall back to the
// parent window's copy (same pattern used in ChatMessage.js and index.js).
function getClientSendIconUrl() {
  if (window.__CHAT_BRAND_INFO__ && window.__CHAT_BRAND_INFO__.assets) {
    return window.__CHAT_BRAND_INFO__.assets.sendIcon;
  }
  try {
    if (window.parent && window.parent !== window && window.parent.__CHAT_BRAND_INFO__ && window.parent.__CHAT_BRAND_INFO__.assets) {
      return window.parent.__CHAT_BRAND_INFO__.assets.sendIcon;
    }
  } catch (e) {
    // window.parent is cross-origin; client info isn't reachable
  }
  return null;
}

const SendButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--ac-widget-send-button-size, 32px);
  height: var(--ac-widget-send-button-size, 32px);
  border-radius: 50%;
  cursor: ${props => props.isActive ? 'pointer' : 'default'};
  transition: background-color 0.15s ease;
  background-color: ${props => props.isActive
    ? `var(--ac-widget-send-button-active-bg, ${ACTIVE_COLOR})`
    : `var(--ac-widget-send-button-bg, ${INACTIVE_COLOR})`};

  &>svg {
    width: var(--ac-widget-send-button-icon-size, 16px);
    height: var(--ac-widget-send-button-icon-size, 16px);
    fill: ${props => props.isActive
      ? `var(--ac-widget-send-button-active-icon-color, ${ACTIVE_ICON_COLOR})`
      : `var(--ac-widget-send-button-icon-color, ${INACTIVE_ICON_COLOR})`};
  }

  &>img {
    width: var(--ac-widget-send-button-icon-size, 16px);
    height: var(--ac-widget-send-button-icon-size, 16px);
    object-fit: contain;
  }
`;

/**
 * Send message button for the Chat Composer.
 * 
 * @param {Object} props
 * @param {boolean} props.isActive
 * @param {Function} props.sendMessage
 */
function SendMessageButton({isActive, sendMessage}) {
  const sendIconUrl = getClientSendIconUrl();

  return (
    <SendButton
      isActive={isActive}
      onClick={sendMessage}
      data-testid="customer-chat-send-message-button"
      aria-label="Send Message"
      tabIndex={0}
      onKeyDown={(e) => {
        // if space or enter is pressed
        if (e.key === KEYBOARD_KEY_CONSTANTS.SPACE || e.key === KEYBOARD_KEY_CONSTANTS.ENTER) {
          sendMessage(e);
        }
      }}
      >
      {sendIconUrl
        ? <img src={sendIconUrl} alt="" />
        : <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M4.01 6.03L11.52 9.25L4 8.25L4.01 6.03ZM11.51 14.75L4 17.97V15.75L11.51 14.75ZM2.01 3L2 10L17 12L2 14L2.01 21L23 12L2.01 3Z"/></svg>
      }
    </SendButton>
  );
};

export default SendMessageButton;