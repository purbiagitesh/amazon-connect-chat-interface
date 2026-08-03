import styled from "styled-components";

// Shared shell for the "List" widget family (ListConfirmation, ListSelection,
// ListSelectionStepper) - a single, non-carousel card. Deliberately not
// shared with SelectionCarousel's CardBase: that card is a fluid 200px
// carousel slide, this one is a fixed 230px block, and several child
// measurements (item-row gap, in particular) differ between the two specs.
// Card chrome (background/border) is neutral per spec and stays fixed across
// brands; only the CTA/checkbox/stepper accent color is brand-driven, via
// the same --ac-widget-selection-card-select-bg override SelectionCarousel
// already exposes, so a host page only has one accent var to theme.
export const LIST_WIDTH = 230;

export const ListCardShell = styled.div`
  box-sizing: border-box;
  width: ${LIST_WIDTH}px;
  max-width: ${LIST_WIDTH}px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--ac-widget-selection-card-border, ${({ theme }) => theme.palette.alto});
  background: ${({ theme }) => theme.palette.white};
`;

export const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const CardHeaderTitle = styled.div`
  ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.globals.bodyFontColor};
`;

export const CardHeaderSubtitle = styled.div`
  ${({ theme }) => theme.typography.label};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
`;

// Neutral divider color is spec'd literally (#D9D9D9) and stays fixed across
// brands, unlike the card border which brands can override via the CSS var.
export const Divider = styled.div`
  border-top: 1px solid #d9d9d9;
`;

export const ProductList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

// Row gap is 8px here per the List-widget spec, vs. 4px on SelectionCarousel's
// ItemRow - the two specs genuinely disagree, so this isn't reused from there.
export const ProductRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

// Row that additionally lays a checkbox next to the product's text column,
// used by ListSelection/ListSelectionStepper (ListConfirmation has no
// checkbox, so it uses ProductRow directly).
export const SelectableProductRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

export const ProductTextColumn = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

// Product names always wrap in full - unlike SelectionCarousel's collapsible
// cards, this widget family has no collapse/toggle state, so there's no
// truncated variant to support.
export const ProductPrimaryText = styled.div`
  ${({ theme }) => theme.typography.body};
  font-weight: 600;
  color: ${({ theme }) => theme.globals.bodyFontColor};
  overflow-wrap: break-word;
`;

export const ProductSecondaryText = styled.div`
  ${({ theme }) => theme.typography.label};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
`;

export const CtaGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ctaButtonBase = `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 36px;
  padding: 8px;
  border-radius: 16px;
  border: none;
  box-sizing: border-box;
`;

// Enabled state fills with the brand accent color; disabled state swaps to
// the neutral bg rather than dimming the brand color, matching the figma
// mock (flat grey while disabled, not a faded brand color).
export const PrimaryCtaButton = styled.button`
  ${ctaButtonBase}
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
  cursor: pointer;
  background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});

  &:disabled {
    background: ${({ theme }) => theme.chatTranscriptor.incomingMsgBg};
    cursor: not-allowed;
  }
`;

export const SecondaryCtaButton = styled.button`
  ${ctaButtonBase}
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
  cursor: pointer;
  background: ${({ theme }) => theme.chatTranscriptor.incomingMsgBg};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;
