import React, { useState } from "react";
import PT from "prop-types";
import styled from "styled-components";
import { RichMessageRenderer } from "../../../RichMessageComponents";
import { MessageBody } from "../InteractiveMessage";
import { ContentType, InteractiveMessageType } from "../../../datamodel/Model";
import { truncateStrFromCharLimit } from "../../../../../utils/helper";
import { MOCK_RESHIP_CASE_CREATION } from "./ReshipCaseCreation.mockData";

// Fully self-contained widget - like ShadeSelector/ProductSelector it does
// not import from sibling widgets except for the shared grey title bubble
// (MessageBody), which QuickReply.js already reuses the same way. Keeps this
// widget free to evolve independently.
//
// Layout note: this renders BOTH halves (grey title bubble + the actions
// row) stacked, the same as QuickReply's default render. It is not lifted
// into ChatMessage.js's QuickReplyActionsRow split - the avatar aligns to
// the whole block, which is acceptable here and keeps the ChatMessage.js
// blast radius to the single childWillAddBackground line.

// Option buttons stack vertically and left-align below the title bubble -
// mirrors QuickReply's ResponsesSection (same theme.spacing.base vertical
// padding) but as a column since these are fixed 200px buttons, not chips
// that hug their content and wrap.
const ActionsSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.mini};
  padding: ${({ theme }) => theme.spacing.base} 0;
`;

// Figma "Reship Case Creation" button spec - identical box for the primary
// and the quaternary variant: width 200 / height 36 (min 48x36), gap 4,
// border-radius rd-16, padding sp-10 (block) / sp-8 (inline). Literal px
// per the spec, matching ShadeSelector.js's ctaButtonBase which encodes the
// same values. Only color/emphasis differs between the two variants below.
const buttonBase = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 200px;
  max-width: 100%;
  min-width: 48px;
  min-height: 36px;
  height: 36px;
  box-sizing: border-box;
  padding: 10px 8px;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  text-align: center;
  transition: opacity 0.15s ease;
`;

// Preferred action ("Yes"). Reuses the same --ac-widget-selection-card-select-bg
// accent var / theme.chatTranscriptor.sendButtonActiveBg fill as the
// ProductSelector/SingleProduct/ShadeSelector primary CTAs, so a brand
// themes one CTA color across every card widget. Colour/typography follow
// the brand; the layout above does not (per the spec's "visual elements
// adapted per brand, without impacting layout/behaviour").
const PrimaryButton = styled.button`
  ${buttonBase}
  ${({ theme }) => theme.typography.label};
  background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});
  color: var(--ac-widget-reship-primary-text-color, ${({ theme }) => theme.globals.bodyFontColor});

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:focus-visible {
    outline: 2px solid var(--ac-widget-quickreply-focus-border-color, ${({ theme }) => theme.componentPalette.quickReply.focusBorderColor});
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

// Lower-emphasis alternative ("No, I don't want a reshipment"). Same box as
// the primary per spec, but no fill and an underlined label so it reads as
// the de-emphasised choice (matches the Figma mock where the alternative is
// plain underlined text). Quaternary text colour is neutral across brands.
const QuaternaryButton = styled.button`
  ${buttonBase}
  ${({ theme }) => theme.typography.label};
  background: transparent;
  color: var(--ac-widget-reship-quaternary-text-color, ${({ theme }) => theme.globals.bodyFontColor});
  text-decoration: underline;

  &:hover:not(:disabled) {
    opacity: 0.7;
  }

  &:focus-visible {
    outline: 2px solid var(--ac-widget-quickreply-focus-border-color, ${({ theme }) => theme.componentPalette.quickReply.focusBorderColor});
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

// The grey title bubble ("...Does that work for you?") - same treatment as
// QuickReplyTitle (MessageBody + addChildBackgroundStyles + capWidth).
function ReshipCaseCreationTitle({ title }) {
  const safeTitle = truncateStrFromCharLimit(
    title,
    InteractiveMessageType.RESHIP_CASE_CREATION,
    "titleCharLimit"
  );
  return (
    <MessageBody
      addChildBackgroundStyles={true}
      capWidth={true}
      data-testid="interactive-reshipcasecreation-title"
    >
      <RichMessageRenderer content={safeTitle} />
    </MessageBody>
  );
}

ReshipCaseCreationTitle.propTypes = {
  title: PT.string,
};

ReshipCaseCreation.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function ReshipCaseCreation({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // ReshipCaseCreation.mockData.js. Swapping to the real VA JSON is a data
  // change only, not a structural one.
  const data = content && Array.isArray(content.elements) ? content : MOCK_RESHIP_CASE_CREATION;
  const { title } = data;
  const elements = Array.isArray(data.elements) ? data.elements : [];

  // Guards against a double-submit between the click and the transcript
  // re-render that collapses this widget to its title (once the consumer's
  // reply arrives it is no longer the latest message - "buttons disappear
  // similar to a chip's behaviour" per the spec, handled centrally).
  const [submitted, setSubmitted] = useState(false);

  // Business rule (Figma): one preferred action is emphasised as the primary
  // button, every other option is a low-emphasis quaternary button. An
  // element is primary iff it declares emphasis:"primary"; if none does, the
  // first element defaults to primary so a bare elements array still renders
  // exactly one emphasised choice.
  const hasExplicitPrimary = elements.some((el) => el && el.emphasis === "primary");
  const isPrimary = (el, index) =>
    hasExplicitPrimary ? el.emphasis === "primary" : index === 0;

  function handleSelect(element) {
    if (submitted) return;
    setSubmitted(true);
    const label = truncateStrFromCharLimit(
      element.title,
      InteractiveMessageType.RESHIP_CASE_CREATION,
      "replyOptionCharLimit"
    );
    // Plain-text reply (like ShadeSelector's Confirm) so CUSTOM_BOT / Lambda
    // bots that only accept text/plain still match the consumer's choice;
    // the chosen label is echoed into the thread as the consumer's message.
    addMessage({ text: label, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN });
  }

  return (
    <React.Fragment>
      <ReshipCaseCreationTitle title={title} />
      <ActionsSection data-testid="interactive-reshipcasecreation-actions">
        {elements.map((element, index) => {
          const OptionButton = isPrimary(element, index) ? PrimaryButton : QuaternaryButton;
          const label = truncateStrFromCharLimit(
            element.title,
            InteractiveMessageType.RESHIP_CASE_CREATION,
            "replyOptionCharLimit"
          );
          return (
            <OptionButton
              key={index}
              type="button"
              disabled={submitted}
              onClick={() => handleSelect(element)}
              data-testid={`reshipcasecreation-option-${index}`}
            >
              {label}
            </OptionButton>
          );
        })}
      </ActionsSection>
    </React.Fragment>
  );
}
