import React from "react";
import styled from "styled-components";
import PT from "prop-types";
import {RichMessageRenderer} from "../../../RichMessageComponents";
import {Button} from "connect-core";
import {MessageBody} from "../InteractiveMessage";
import {truncateStrFromCharLimit} from "../../../../../utils/helper";
import {InteractiveMessageType} from "../../../datamodel/Model";

const ResponsesSection = styled.div`
  padding: ${({ theme}) => theme.spacing.base} 0;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  gap: ${({ theme}) => theme.spacing.mini};
  justify-content: flex-end;
`;

// Chip per Figma "Chips" spec: background/border/text colors are neutral
// and fixed across every brand (see componentPalette.js's quickReply block -
// only the font-family follows the brand's typeface, inherited globally via
// theme.typography.label not setting one). Sized to content (inline-flex,
// not the old block/width:100%) so chips wrap left-to-right like the Figma
// reference instead of stacking one-per-row; the emoji/icon a caller wants
// on either side is just part of element.title's text (no separate icon
// field exists on quick-reply elements), and this flex layout keeps that
// centered alongside the label either way.
const QuickReplyOption = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme}) => theme.spacing.micro};
  width: auto;
  min-height: 36px;
  box-sizing: border-box;
  border-radius: 999px;
  border: 1px solid var(--ac-widget-quickreply-border-color, ${({theme}) => theme.componentPalette.quickReply.borderColor});
  background-color: var(--ac-widget-quickreply-bg-color, ${({theme}) => theme.componentPalette.quickReply.backgroundColor});
  color: var(--ac-widget-quickreply-text-color, ${({theme}) => theme.componentPalette.quickReply.textColor});
  ${({ theme}) => theme.typography.label};
  padding: 8px 16px;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    background-color: var(--ac-widget-quickreply-hover-bg-color, ${({theme}) => theme.componentPalette.quickReply.hoverBackgroundColor});
    border-color: var(--ac-widget-quickreply-hover-border-color, ${({theme}) => theme.componentPalette.quickReply.hoverBorderColor});
  }

  &:focus-visible {
    outline: 2px solid var(--ac-widget-quickreply-focus-border-color, ${({theme}) => theme.componentPalette.quickReply.focusBorderColor});
    outline-offset: 1px;
  }

  &:active:not(:disabled) {
    background-color: var(--ac-widget-quickreply-active-bg-color, ${({theme}) => theme.componentPalette.quickReply.activeBackgroundColor});
    border-color: var(--ac-widget-quickreply-active-border-color, ${({theme}) => theme.componentPalette.quickReply.activeBorderColor});
  }

  &:disabled {
    background-color: var(--ac-widget-quickreply-disabled-bg-color, ${({theme}) => theme.componentPalette.quickReply.disabledBackgroundColor});
    border-color: var(--ac-widget-quickreply-disabled-border-color, ${({theme}) => theme.componentPalette.quickReply.disabledBorderColor});
    color: var(--ac-widget-quickreply-disabled-text-color, ${({theme}) => theme.componentPalette.quickReply.disabledTextColor});
    cursor: not-allowed;
  }
`;

function ReplyElement({element, handleSelection}) {
  const title = truncateStrFromCharLimit( element.title, InteractiveMessageType.QUICK_REPLY, "replyOptionCharLimit");

  return (
    <QuickReplyOption onClick={() => handleSelection({ text: element.title})}>
      {title}
    </QuickReplyOption>
  );
}

QuickReply.propTypes = {
  content: PT.object.isRequired,
  addMessage: PT.func.isRequired,
};

export default function QuickReply({content, addMessage}) {
  const {title: inputTitle, elements} = content;
  const title = truncateStrFromCharLimit(inputTitle, InteractiveMessageType.QUICK_REPLY, "titleCharLimit");

  return (
    <>
      <MessageBody addChildBackgroundStyles={true} data-testid="interactive-quickreply-message-title" applySpeechBubbleCaret={true}>
        <RichMessageRenderer content={title} />
      </MessageBody>
      <ResponsesSection data-testid="interactive-quickreply-response-section">
        {elements.map((element, index) => (
          <ReplyElement
            element={element}
            handleSelection={addMessage}
            key={index}
          />
        ))}
      </ResponsesSection>
    </>
  );
}
