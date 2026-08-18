import React, { useState } from "react";
import PT from "prop-types";
import styled from "styled-components";
import { MOCK_PRODUCT_SELECTOR } from "./ProductSelector.mockData";
import { ContentType } from "../../../datamodel/Model";

// Fully self-contained widget - deliberately does not import from
// ListPrimitives.js/SingleProduct.js/Checkbox.js, even though the card
// chrome and CTA styling are visually close to that family. Keeps this
// widget free to evolve (or be deleted) without touching any other widget.

// Fixed 230px card per the Product Selector figma spec.
const CARD_WIDTH = 230;

// Card chrome (background/border) is neutral per spec and stays fixed across
// brands. Reuses the same --ac-widget-selection-card-border override the
// other card widgets already expose, so a host page only has one var to
// theme for card borders.
const CardShell = styled.div`
  box-sizing: border-box;
  width: ${CARD_WIDTH}px;
  max-width: ${CARD_WIDTH}px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--ac-widget-selection-card-border, ${({ theme }) => theme.palette.alto});
  background: ${({ theme }) => theme.palette.white};
`;

const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CardHeaderTitle = styled.div`
  ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.globals.bodyFontColor};
`;

const CardHeaderSubtitle = styled.div`
  ${({ theme }) => theme.typography.label};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
`;

// Neutral divider color, exposed via --color-borders-main-default per this
// widget's own "Border" spec, falling back to the spec'd #D9D9D9.
const Divider = styled.div`
  border-top: 1px solid var(--color-borders-main-default, #d9d9d9);
`;

const ProductList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ProductRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

const ProductTextColumn = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

// Product name is a hyperlink and, per spec, keeps the same blue/underline
// styling across every brand - color comes from theme.componentPalette.
// productLink (defaultTheme.js / componentPalette.js), which is neutral by
// design, not derived from a brand's colors.json. Each state is additionally
// exposed via a CSS var as a host override escape hatch - the default is
// identical everywhere unless a host page opts in.
// Note: Figma's "text-decoration-offset/-thickness: 0%" map to CSS
// text-underline-offset/text-decoration-thickness "auto", which is already
// the browser default - left unset here rather than pinned to a literal 0
// (which would render as no visible underline).
const ProductNameLink = styled.a`
  ${({ theme }) => theme.typography.title};
  display: block;
  font-weight: 700;
  letter-spacing: 0;
  text-decoration: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  color: var(--color-text-link-default, ${({ theme }) => theme.componentPalette.productLink.default});
  overflow-wrap: break-word;
  cursor: pointer;

  &:hover {
    color: var(--color-text-link-hover, ${({ theme }) => theme.componentPalette.productLink.hover});
  }

  &:active {
    color: var(--color-text-link-pressed, ${({ theme }) => theme.componentPalette.productLink.pressed});
  }
`;

const ProductPrice = styled.div`
  ${({ theme }) => theme.typography.body};
  font-weight: 700;
  color: ${({ theme }) => theme.globals.bodyFontColor};
`;

const ProductMetaText = styled.div`
  ${({ theme }) => theme.typography.label};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
`;

// Real (visually-hidden) radio input drives :checked so keyboard/screen-
// reader behavior and single-select grouping (shared `name`) come for free;
// the visible ring is a sibling styled off it rather than a custom click
// handler re-implementing native radio semantics.
const HiddenRadio = styled.input`
  position: absolute;
  opacity: 0;
  width: 22px;
  height: 22px;
  margin: 0;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
`;

// Center dot only exists/colors in when checked - per spec ("Unchecked is
// neutral ... once checked, the color INSIDE the radio button will turn
// into a brand-specific color"), the outer ring itself never changes color,
// unlike Checkbox's full-fill treatment.
const RadioDot = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: transparent;
`;

const RadioRing = styled.span`
  position: relative;
  display: inline-block;
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.palette.alto};
  background: transparent;
  pointer-events: none;

  ${HiddenRadio}:checked + & ${RadioDot} {
    background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});
  }

  ${HiddenRadio}:disabled + & {
    opacity: 0.5;
  }
`;

const RadioWrapper = styled.label`
  position: relative;
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  margin-top: 2px;
`;

function ProductRadio({ checked, onChange, name, ariaLabel, testId }) {
  return (
    <RadioWrapper>
      <HiddenRadio
        type="radio"
        name={name}
        checked={!!checked}
        onChange={onChange}
        aria-label={ariaLabel}
        data-testid={testId}
      />
      <RadioRing>
        <RadioDot />
      </RadioRing>
    </RadioWrapper>
  );
}

ProductRadio.propTypes = {
  checked: PT.bool,
  onChange: PT.func.isRequired,
  name: PT.string.isRequired,
  ariaLabel: PT.string,
  testId: PT.string,
};

const CtaGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ctaButtonBase = `
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-height: 36px;
  padding: 10px 8px;
  border-radius: 16px;
  border: none;
  box-sizing: border-box;
`;

// Disabled (no product selected yet) swaps to the neutral bg rather than
// dimming the brand color, matching the figma mock (flat grey while
// disabled, not a faded brand color) - same treatment as the List widget
// family's PrimaryCtaButton.
const PrimaryCtaButton = styled.button`
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

const SecondaryCtaButton = styled.button`
  ${ctaButtonBase}
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
  cursor: pointer;
  background: ${({ theme }) => theme.chatTranscriptor.incomingMsgBg};
`;

function formatPrice(product) {
  const min = Number(product.priceMin);
  const max = Number(product.priceMax);
  if (!Number.isFinite(min)) return "";
  if (!Number.isFinite(max) || max === min) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
}

// Prioritizes shade count when available, otherwise falls back to size
// count - same precedence rule as the SingleProduct widget.
function formatCount(product) {
  if (product.shadeCount != null) {
    return `${product.shadeCount} Shade${product.shadeCount === 1 ? "" : "s"}`;
  }
  if (product.sizeCount != null) {
    return `${product.sizeCount} Size${product.sizeCount === 1 ? "" : "s"}`;
  }
  return "";
}

ProductSelector.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function ProductSelector({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // ProductSelector.mockData.js. Swapping to the real VA JSON is a data
  // change only, not a structural one.
  const data = content || MOCK_PRODUCT_SELECTOR;
  const { title, subtitle, products } = data;
  const checkAvailabilityLabel = data.checkAvailabilityLabel || "Check availability";
  const enterAnotherLabel = data.enterAnotherLabel || "Enter another product";
  const enterAnotherMessage = data.enterAnotherMessage || enterAnotherLabel;

  const [selectedId, setSelectedId] = useState(null);

  function respond(text) {
    addMessage({ text, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN });
  }

  function handleCheckAvailability() {
    const selected = products.find((product) => product.id === selectedId);
    if (!selected) return;
    respond(selected.name);
  }

  function handleEnterAnother() {
    respond(enterAnotherMessage);
  }

  return (
    <CardShell data-testid="product-selector">
      <CardHeader>
        <CardHeaderTitle>{title}</CardHeaderTitle>
        <CardHeaderSubtitle>{subtitle}</CardHeaderSubtitle>
      </CardHeader>
      <Divider />
      <ProductList>
        {products.map((product) => (
          <ProductRow key={product.id}>
            <ProductRadio
              checked={selectedId === product.id}
              onChange={() => setSelectedId(product.id)}
              name="product-selector"
              ariaLabel={product.name}
              testId={`product-selector-radio-${product.id}`}
            />
            <ProductTextColumn>
              <ProductNameLink
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`product-selector-link-${product.id}`}
              >
                {product.name}
              </ProductNameLink>
              <ProductPrice>{formatPrice(product)}</ProductPrice>
              <ProductMetaText>{formatCount(product)}</ProductMetaText>
            </ProductTextColumn>
          </ProductRow>
        ))}
      </ProductList>
      <CtaGroup>
        <PrimaryCtaButton
          disabled={!selectedId}
          onClick={handleCheckAvailability}
          data-testid="product-selector-check-availability"
        >
          {checkAvailabilityLabel}
        </PrimaryCtaButton>
        <SecondaryCtaButton onClick={handleEnterAnother} data-testid="product-selector-enter-another">
          {enterAnotherLabel}
        </SecondaryCtaButton>
      </CtaGroup>
    </CardShell>
  );
}
