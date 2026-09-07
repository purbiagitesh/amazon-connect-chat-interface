import React from "react";
import styled from "styled-components";
import PT from "prop-types";
import {RichMessageRenderer} from "../../../RichMessageComponents";
import {Button} from "connect-core";
import {MessageBody} from "../InteractiveMessage";
import {
  truncateStrFromCharLimit,
  isRatingQuickReply,
} from "../../../../../utils/helper";
import {ContentType, InteractiveMessageType} from "../../../datamodel/Model";

const ResponsesSection = styled.div`
  padding: ${({ theme}) => theme.spacing.base} 0;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  gap: ${({ theme}) => theme.spacing.mini};
  justify-content: flex-start;
`;

// Rating options stack vertically, full width, one per row - per the
// updated Figma spec (298x212 frame for 5 buttons -> gap:8, replaces the
// earlier single-row icon-chip layout).
const RatingOptionStack = styled(ResponsesSection)`
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 8px;
`;

// Chip per Figma "Chips" spec: min-width 48px, height 36 (hugs larger
// content - RatingOptionButton below stretches this to width:100% for the
// rating flow), padding sp-10 (theme.spacing.small), gap 4
// (theme.spacing.micro), border-radius rd-16, border-width br-1. Colors are
// neutral and fixed across every brand (see componentPalette.js's
// quickReply block) - only the font-family follows the brand's typeface,
// inherited globally via theme.typography.label not setting one.
const QuickReplyOption = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme}) => theme.spacing.micro};
  width: auto;
  min-width: 48px;
  min-height: 36px;
  box-sizing: border-box;
  border-radius: 16px;
  border: 1px solid var(--ac-widget-quickreply-border-color, ${({theme}) => theme.componentPalette.quickReply.borderColor});
  background-color: var(--ac-widget-quickreply-bg-color, ${({theme}) => theme.componentPalette.quickReply.backgroundColor});
  color: var(--ac-widget-quickreply-text-color, ${({theme}) => theme.componentPalette.quickReply.textColor});
  ${({ theme}) => theme.typography.label};
  padding: ${({ theme}) => theme.spacing.small};
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

// Rating options are the same chip chrome/colors/states as QuickReplyOption,
// just full width - text stays centered like every other chip (the button
// row itself is what's left-aligned, flush with the avatar; see
// QuickReplyActionsRow in ChatMessage.js)
const RatingOptionButton = styled(QuickReplyOption)`
  width: 100%;
`;

function ReplyElement({element, handleSelection, isRatingStyle}) {
  const title = truncateStrFromCharLimit( element.title, InteractiveMessageType.QUICK_REPLY, "replyOptionCharLimit");
  const Option = isRatingStyle ? RatingOptionButton : QuickReplyOption;

  // The component always emits the structured INTERACTIVE_RESPONSE envelope.
  // Feedback-flow answers are flattened to plain text centrally in
  // ChatSession (flattenFeedbackQuickReplyResponse) - that decision needs the
  // incoming prompt's metadata, which this component never receives.
  return (
    <Option
      onClick={() => handleSelection({
        text: JSON.stringify({
          templateType: InteractiveMessageType.QUICK_REPLY,
          version: "1.0",
          action: element.title,
        }),
        type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE,
      })}
    >
      {title}
    </Option>
  );
}

QuickReply.propTypes = {
  content: PT.object.isRequired,
  addMessage: PT.func.isRequired,
  // "bubble" -> render only the title bubble, "actions" -> render only the
  // option/rating controls, undefined -> render both (default, unchanged).
  // ChatMessage renders the two halves separately so the message avatar sits
  // beside the title bubble instead of beside the tall controls row - the
  // controls keep the exact same width/position they had inside the bubble.
  renderPart: PT.oneOf(["bubble", "actions"]),
};

// The grey title bubble ("How was your experience?" / the rating prompt).
export function QuickReplyTitle({content}) {
  const title = truncateStrFromCharLimit(content.title, InteractiveMessageType.QUICK_REPLY, "titleCharLimit");
  return (
    <MessageBody addChildBackgroundStyles={true} capWidth={true} data-testid="interactive-quickreply-message-title">
      <RichMessageRenderer content={title} />
    </MessageBody>
  );
}

// The tappable option chips / 1-5 rating scale.
export function QuickReplyActions({content, addMessage}) {
  const {elements} = content;
  const isRatingStyle = isRatingQuickReply(content);
  const Section = isRatingStyle ? RatingOptionStack : ResponsesSection;
  return (
    <Section data-testid="interactive-quickreply-response-section">
      {elements.map((element, index) => (
        <ReplyElement
          element={element}
          handleSelection={addMessage}
          isRatingStyle={isRatingStyle}
          key={index}
        />
      ))}
    </Section>
  );
}

export default function QuickReply({content, addMessage, renderPart}) {
  if (renderPart === "bubble") {
    return <QuickReplyTitle content={content} />;
  }
  if (renderPart === "actions") {
    return <QuickReplyActions content={content} addMessage={addMessage} />;
  }
  return (
    <>
      <QuickReplyTitle content={content} />
      <QuickReplyActions content={content} addMessage={addMessage} />
    </>
  );
}
