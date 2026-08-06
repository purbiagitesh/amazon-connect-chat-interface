import React from "react";
import PT from "prop-types";
import styled from "styled-components";

// Real (visually-hidden) input drives :checked so keyboard/screen-reader
// behavior comes for free; the visible box is a sibling styled off it rather
// than a custom click handler re-implementing native checkbox semantics.
const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 22px;
  height: 22px;
  margin: 0;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
`;

// Unchecked is a neutral outline (fixed across brands, per spec); checked
// fills solid with the brand accent color - no checkmark glyph, matching the
// figma mock exactly (a filled square, not a check icon).
const Box = styled.span`
  display: inline-block;
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.alto};
  background: transparent;
  pointer-events: none;

  ${HiddenInput}:checked + & {
    background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});
    border-color: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});
  }

  ${HiddenInput}:disabled + & {
    opacity: 0.5;
  }
`;

const Wrapper = styled.label`
  position: relative;
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
`;

Checkbox.propTypes = {
  checked: PT.bool,
  onChange: PT.func.isRequired,
  disabled: PT.bool,
  ariaLabel: PT.string,
  testId: PT.string,
};

export default function Checkbox({ checked, onChange, disabled, ariaLabel, testId }) {
  return (
    <Wrapper>
      <HiddenInput
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
        data-testid={testId}
      />
      <Box />
    </Wrapper>
  );
}
