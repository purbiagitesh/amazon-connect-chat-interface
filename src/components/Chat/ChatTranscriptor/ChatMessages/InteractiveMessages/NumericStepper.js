import React from "react";
import PT from "prop-types";
import styled from "styled-components";

const StepperRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
`;

// Circle fills with the brand accent when its direction is usable, and
// drops to a flat neutral when not - covers both the floor/ceiling case
// (value at min/max) and the "purchased qty is 1" case (both directions
// locked, value fixed at 1).
const StepperButton = styled.button`
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.palette.white};
  background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});
  cursor: pointer;

  &:disabled {
    background: ${({ theme }) => theme.palette.alto};
    cursor: not-allowed;
  }

  svg {
    width: 8px;
    height: 8px;
  }
`;

const StepperValue = styled.div`
  min-width: 12px;
  text-align: center;
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
`;

const StepperLabel = styled.div`
  ${({ theme }) => theme.typography.label};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
`;

function MinusIcon() {
  return (
    <svg viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="3.25" width="8" height="1.5" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="3.25" width="8" height="1.5" fill="currentColor" />
      <rect x="3.25" y="0" width="1.5" height="8" fill="currentColor" />
    </svg>
  );
}

NumericStepper.propTypes = {
  value: PT.number.isRequired,
  min: PT.number,
  max: PT.number.isRequired,
  onChange: PT.func.isRequired,
  label: PT.string,
  testId: PT.string,
};

NumericStepper.defaultProps = {
  min: 1,
};

export default function NumericStepper({ value, min, max, onChange, label, testId }) {
  // Purchased qty of 1 (max <= min) locks the stepper entirely, per spec,
  // rather than hiding it - the consumer still sees the fixed value of 1.
  const locked = max <= min;
  const canDecrement = !locked && value > min;
  const canIncrement = !locked && value < max;

  return (
    <StepperRow data-testid={testId}>
      <StepperButton
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrement}
        onClick={() => onChange(value - 1)}
        data-testid={`${testId}-decrement`}
      >
        <MinusIcon />
      </StepperButton>
      <StepperValue>{value}</StepperValue>
      <StepperButton
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrement}
        onClick={() => onChange(value + 1)}
        data-testid={`${testId}-increment`}
      >
        <PlusIcon />
      </StepperButton>
      {label && <StepperLabel>of {max} {label}</StepperLabel>}
    </StepperRow>
  );
}
