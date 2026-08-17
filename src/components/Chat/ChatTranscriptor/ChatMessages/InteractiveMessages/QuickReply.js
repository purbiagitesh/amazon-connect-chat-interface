import React from "react";
import styled from "styled-components";
import PT from "prop-types";
import {RichMessageRenderer} from "../../../RichMessageComponents";
import {Button} from "connect-core";
import {MessageBody} from "../InteractiveMessage";
import {truncateStrFromCharLimit} from "../../../../../utils/helper";
import {InteractiveMessageType, QuickReplyDisplayStyle} from "../../../datamodel/Model";

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
// reference instead of stacking one-per-row. For content.displayStyle
// "rating" quick replies, the content is a face/digit glyph (see the
// RATING_VALUE_ICONS icons below) rather than the full element.title.
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

// Rating chip glyphs (Figma "Feedback Flow Chips" spec, values "1"-"5").
// Each is the face/digit content only - the pill background/border from the
// Figma export is dropped since QuickReplyOption already draws that chrome
// (and animates it per hover/focus/pressed/disabled state); fill is
// currentColor so the glyph follows the button's own text color instead of
// being pinned to the Figma export's static #1A1A1A.
const ChipIcon = styled.svg`
  width: 27px;
  height: 20px;
  flex-shrink: 0;
`;

function SadFaceOneIcon(props) {
  return (
    <ChipIcon viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M20.333 17.3333C20.8853 17.3333 21.333 16.8856 21.333 16.3333C21.333 15.7811 20.8853 15.3333 20.333 15.3333C19.7807 15.3333 19.333 15.7811 19.333 16.3333C19.333 16.8856 19.7807 17.3333 20.333 17.3333Z" fill="currentColor"/>
      <path d="M15.6663 17.3333C16.2186 17.3333 16.6663 16.8856 16.6663 16.3333C16.6663 15.7811 16.2186 15.3333 15.6663 15.3333C15.1141 15.3333 14.6663 15.7811 14.6663 16.3333C14.6663 16.8856 15.1141 17.3333 15.6663 17.3333Z" fill="currentColor"/>
      <path d="M17.9997 19.3333C16.4463 19.3333 15.1197 20.3 14.5863 21.6667H15.6997C16.1597 20.8733 17.013 20.3333 17.9997 20.3333C18.9863 20.3333 19.833 20.8733 20.2997 21.6667H21.413C20.8797 20.3 19.553 19.3333 17.9997 19.3333ZM17.993 11.3333C14.313 11.3333 11.333 14.32 11.333 18C11.333 21.68 14.313 24.6667 17.993 24.6667C21.6797 24.6667 24.6663 21.68 24.6663 18C24.6663 14.32 21.6797 11.3333 17.993 11.3333ZM17.9997 23.3333C15.053 23.3333 12.6663 20.9467 12.6663 18C12.6663 15.0533 15.053 12.6667 17.9997 12.6667C20.9463 12.6667 23.333 15.0533 23.333 18C23.333 20.9467 20.9463 23.3333 17.9997 23.3333Z" fill="currentColor"/>
      <path d="M34.786 22H33.658V16.084H31.918V15.34C32.83 15.34 33.434 15.104 33.73 14.632C33.866 14.424 33.95 14.184 33.982 13.912H34.786V22Z" fill="currentColor"/>
    </ChipIcon>
  );
}

function NumberTwoIcon(props) {
  return (
    <ChipIcon viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M26.742 22H21.45L21.462 20.968C21.574 20.912 21.742 20.82 21.966 20.692C22.59 20.292 23.254 19.76 23.958 19.096C24.446 18.648 24.83 18.208 25.11 17.776C25.39 17.336 25.53 16.852 25.53 16.324C25.53 15.844 25.394 15.468 25.122 15.196C24.858 14.916 24.486 14.776 24.006 14.776C23.454 14.776 23.05 14.94 22.794 15.268C22.73 15.356 22.658 15.5 22.578 15.7C22.514 15.916 22.482 16.14 22.482 16.372C22.482 16.628 22.53 16.948 22.626 17.332H21.57C21.474 17.004 21.426 16.684 21.426 16.372C21.426 15.556 21.678 14.92 22.182 14.464C22.654 14.048 23.274 13.84 24.042 13.84C24.73 13.84 25.31 14.04 25.782 14.44C26.358 14.92 26.646 15.572 26.646 16.396C26.646 17.236 26.282 18.064 25.554 18.88C25.298 19.176 24.994 19.472 24.642 19.768C24.322 20.048 24.006 20.3 23.694 20.524C23.51 20.652 23.234 20.836 22.866 21.076H26.742V22Z" fill="currentColor"/>
    </ChipIcon>
  );
}

function NumberThreeIcon(props) {
  return (
    <ChipIcon viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M26.85 19.744C26.85 20.36 26.642 20.876 26.226 21.292C25.722 21.812 24.986 22.072 24.018 22.072C23.866 22.072 23.714 22.064 23.562 22.048C23.418 22.04 23.202 22 22.914 21.928C22.634 21.856 22.386 21.76 22.17 21.64C21.954 21.512 21.738 21.32 21.522 21.064C21.314 20.8 21.166 20.492 21.078 20.14C21.022 19.924 20.99 19.652 20.982 19.324H22.062C22.11 19.74 22.158 20.02 22.206 20.164C22.438 20.796 23.022 21.112 23.958 21.112C24.07 21.112 24.174 21.108 24.27 21.1C24.374 21.092 24.522 21.064 24.714 21.016C24.906 20.96 25.066 20.888 25.194 20.8C25.33 20.704 25.45 20.56 25.554 20.368C25.666 20.168 25.722 19.932 25.722 19.66C25.722 19.324 25.63 19.044 25.446 18.82C25.182 18.476 24.658 18.304 23.874 18.304C23.634 18.304 23.394 18.316 23.154 18.34L23.166 17.368C24.03 17.44 24.646 17.352 25.014 17.104C25.358 16.872 25.53 16.536 25.53 16.096C25.53 15.824 25.458 15.584 25.314 15.376C25.018 14.944 24.546 14.728 23.898 14.728C23.314 14.728 22.882 14.952 22.602 15.4C22.45 15.656 22.358 16.064 22.326 16.624L21.258 16.576C21.29 16.104 21.342 15.748 21.414 15.508C21.51 15.212 21.646 14.956 21.822 14.74C21.998 14.516 22.174 14.348 22.35 14.236C22.534 14.124 22.738 14.036 22.962 13.972C23.186 13.908 23.366 13.872 23.502 13.864C23.638 13.848 23.774 13.84 23.91 13.84C24.334 13.84 24.734 13.904 25.11 14.032C25.414 14.136 25.67 14.28 25.878 14.464C26.094 14.648 26.25 14.848 26.346 15.064C26.442 15.272 26.51 15.46 26.55 15.628C26.59 15.788 26.61 15.944 26.61 16.096C26.61 16.616 26.482 17.028 26.226 17.332C26.114 17.476 25.914 17.636 25.626 17.812C25.81 17.892 25.974 17.988 26.118 18.1C26.606 18.5 26.85 19.048 26.85 19.744Z" fill="currentColor"/>
    </ChipIcon>
  );
}

function NumberFourIcon(props) {
  return (
    <ChipIcon viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M26.886 20.056H25.71V22H24.666V20.056H21.006V19.084L24.87 13.912H25.71V19.144H26.886V20.056ZM24.714 15.52L22.098 19.144H24.666L24.714 15.52Z" fill="currentColor"/>
    </ChipIcon>
  );
}

function HappyFaceFiveIcon(props) {
  return (
    <ChipIcon viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M16.802 19.168C16.802 19.768 16.646 20.324 16.334 20.836C16.022 21.34 15.594 21.692 15.05 21.892C14.73 22.012 14.362 22.072 13.946 22.072C13.522 22.072 13.138 22.012 12.794 21.892C12.458 21.764 12.186 21.6 11.978 21.4C11.77 21.192 11.606 20.996 11.486 20.812C11.374 20.628 11.282 20.44 11.21 20.248C11.146 20.048 11.098 19.792 11.066 19.48L12.134 19.408C12.15 19.592 12.206 19.804 12.302 20.044C12.494 20.532 12.802 20.86 13.226 21.028C13.426 21.108 13.654 21.148 13.91 21.148C14.182 21.148 14.426 21.1 14.642 21.004C14.922 20.884 15.166 20.672 15.374 20.368C15.582 20.064 15.686 19.652 15.686 19.132C15.686 18.86 15.658 18.636 15.602 18.46C15.538 18.22 15.418 18.004 15.242 17.812C15.074 17.62 14.878 17.48 14.654 17.392C14.414 17.312 14.174 17.272 13.934 17.272C13.566 17.272 13.258 17.356 13.01 17.524C12.946 17.556 12.87 17.616 12.782 17.704C12.582 17.896 12.434 18.1 12.338 18.316H11.366L11.63 13.912H16.226V14.86H12.446L12.338 16.984C12.866 16.544 13.462 16.328 14.126 16.336C14.534 16.336 14.902 16.408 15.23 16.552C15.726 16.776 16.11 17.128 16.382 17.608C16.662 18.088 16.802 18.608 16.802 19.168Z" fill="currentColor"/>
      <path d="M32.333 17.3333C32.8853 17.3333 33.333 16.8856 33.333 16.3333C33.333 15.7811 32.8853 15.3333 32.333 15.3333C31.7807 15.3333 31.333 15.7811 31.333 16.3333C31.333 16.8856 31.7807 17.3333 32.333 17.3333Z" fill="currentColor"/>
      <path d="M27.6663 17.3333C28.2186 17.3333 28.6663 16.8856 28.6663 16.3333C28.6663 15.7811 28.2186 15.3333 27.6663 15.3333C27.1141 15.3333 26.6663 15.7811 26.6663 16.3333C26.6663 16.8856 27.1141 17.3333 27.6663 17.3333Z" fill="currentColor"/>
      <path d="M29.9997 20.6667C29.013 20.6667 28.1663 20.1267 27.6997 19.3333H26.5863C27.1197 20.7 28.4463 21.6667 29.9997 21.6667C31.553 21.6667 32.8797 20.7 33.413 19.3333H32.2997C31.833 20.1267 30.9863 20.6667 29.9997 20.6667ZM29.993 11.3333C26.313 11.3333 23.333 14.32 23.333 18C23.333 21.68 26.313 24.6667 29.993 24.6667C33.6797 24.6667 36.6663 21.68 36.6663 18C36.6663 14.32 33.6797 11.3333 29.993 11.3333ZM29.9997 23.3333C27.053 23.3333 24.6663 20.9467 24.6663 18C24.6663 15.0533 27.053 12.6667 29.9997 12.6667C32.9463 12.6667 35.333 15.0533 35.333 18C35.333 20.9467 32.9463 23.3333 29.9997 23.3333Z" fill="currentColor"/>
    </ChipIcon>
  );
}

const RATING_VALUE_ICONS = {
  "1": SadFaceOneIcon,
  "2": NumberTwoIcon,
  "3": NumberThreeIcon,
  "4": NumberFourIcon,
  "5": HappyFaceFiveIcon,
};
const RATING_VALUES = Object.keys(RATING_VALUE_ICONS);

// Bot responses aren't required to set content.displayStyle explicitly - if
// the elements are exactly the 1-5 rating scale (regardless of order), treat
// it as a rating QuickReply automatically so existing bot payloads render
// the Figma chip icons without a bot-side change.
function isRatingElements(elements) {
  return Array.isArray(elements) &&
    elements.length === RATING_VALUES.length &&
    RATING_VALUES.every((value) => elements.some((element) => element.value === value));
}

function ReplyElement({element, handleSelection, isRatingStyle}) {
  const title = truncateStrFromCharLimit( element.title, InteractiveMessageType.QUICK_REPLY, "replyOptionCharLimit");
  // Rating chips show the Figma face/digit glyph for the element's value
  // instead of the full descriptive title. The full title is still sent as
  // the reply text so the bot/transcript keep the descriptive wording
  // (e.g. "1 Very Dissatisfied").
  const RatingIcon = isRatingStyle ? RATING_VALUE_ICONS[element.value] : null;

  return (
    <QuickReplyOption
      onClick={() => handleSelection({ text: element.title})}
      aria-label={RatingIcon ? title : undefined}
    >
      {RatingIcon ? <RatingIcon /> : title}
    </QuickReplyOption>
  );
}

QuickReply.propTypes = {
  content: PT.object.isRequired,
  addMessage: PT.func.isRequired,
};

export default function QuickReply({content, addMessage}) {
  const {title: inputTitle, elements, displayStyle} = content;
  const title = truncateStrFromCharLimit(inputTitle, InteractiveMessageType.QUICK_REPLY, "titleCharLimit");
  const isRatingStyle = displayStyle === QuickReplyDisplayStyle.RATING || isRatingElements(elements);

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
            isRatingStyle={isRatingStyle}
            key={index}
          />
        ))}
      </ResponsesSection>
    </>
  );
}
