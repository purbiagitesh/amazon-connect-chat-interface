import React from "react";
import PT from "prop-types";
import styled from "styled-components";
import { MOCK_PRODUCT } from "./SingleProduct.mockData";
import { ContentType } from "../../../datamodel/Model";

// Fixed 200px card per the Single Product figma spec - unlike the List
// widget family (230px), this width does not change across brands, viewport,
// or device.
const CARD_WIDTH = 200;

// Card chrome (background/border) is neutral per spec and stays fixed across
// brands. Reuses the same --ac-widget-selection-card-border override the
// List/Carousel widget families already expose, so a host page only has one
// var to theme for card borders.
const SingleProductCardShell = styled.div`
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

// Product name is a hyperlink and, per spec, keeps the same blue/underline
// styling across every brand - color comes from theme.componentPalette.
// productLink (defaultTheme.js / componentPalette.js), which is neutral by
// design, not derived from a brand's colors.json. Each state is additionally
// exposed via a CSS var as a host override escape hatch (same pattern as
// ChatComposer/Disclaimer.js's link color) - the default is identical
// everywhere unless a host page opts in.
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

const ShadeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
`;

const ShadeSwatch = styled.span`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${(props) => props.color};
`;

const ShadeLabel = styled.div`
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
  overflow-wrap: break-word;
`;

// Neutral divider color is spec'd literally (#D9D9D9), same as the List
// widget family's divider.
const Divider = styled.div`
  border-top: 1px solid #d9d9d9;
`;

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

// Reuses the same --ac-widget-selection-card-select-bg accent var as the
// List widget family's PrimaryCtaButton, so brands theme one CTA color
// across every card widget.
const PrimaryCtaButton = styled.button`
  ${ctaButtonBase}
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
  cursor: pointer;
  background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});
`;

const SecondaryCtaButton = styled.button`
  ${ctaButtonBase}
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
  cursor: pointer;
  background: ${({ theme }) => theme.chatTranscriptor.incomingMsgBg};
`;

function getShadeOrSize(product) {
  return product.shade || product.size;
}

SingleProduct.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function SingleProduct({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // SingleProduct.mockData.js. Swapping to the real VA JSON is a data
  // change only, not a structural one.
  const product = (content && content.product) || MOCK_PRODUCT;
  const yesLabel = product.yesLabel || "Yes";
  const noLabel = product.noLabel || "No";
  const yesMessage = product.yesMessage || "Yes";
  const noMessage = product.noMessage || "No";
  const shadeOrSize = getShadeOrSize(product);

  function respond(text) {
    addMessage({ text, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN });
  }

  return (
    <SingleProductCardShell data-testid="single-product">
      <ProductNameLink
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="single-product-link"
      >
        {product.name}
      </ProductNameLink>
      <ProductPrice>{product.price}</ProductPrice>
      {shadeOrSize && (
        <ShadeRow>
          {product.shade && product.shadeColor && <ShadeSwatch color={product.shadeColor} />}
          <ShadeLabel>{shadeOrSize}</ShadeLabel>
        </ShadeRow>
      )}
      <Divider />
      <CtaGroup>
        <PrimaryCtaButton onClick={() => respond(yesMessage)} data-testid="single-product-yes">
          {yesLabel}
        </PrimaryCtaButton>
        <SecondaryCtaButton onClick={() => respond(noMessage)} data-testid="single-product-no">
          {noLabel}
        </SecondaryCtaButton>
      </CtaGroup>
    </SingleProductCardShell>
  );
}
