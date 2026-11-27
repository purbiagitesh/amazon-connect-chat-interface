import React, { useState } from "react";
import PT from "prop-types";
import { FormattedMessage } from "react-intl";
import { MOCK_LIST_SELECTION_STEPPER } from "./ListSelectionStepper.mockData";
import { ContentType } from "../../../datamodel/Model";
import Checkbox from "./Checkbox";
import NumericStepper from "./NumericStepper";
import {
  ListCardShell,
  CardHeader,
  CardHeaderTitle,
  CardHeaderSubtitle,
  Divider,
  ProductList,
  SelectableProductRow,
  ProductTextColumn,
  ProductPrimaryText,
  ProductSecondaryText,
  CtaGroup,
  PrimaryCtaButton,
  SecondaryCtaButton,
} from "./ListPrimitives";

function formatProductMeta(product) {
  const detail = product.shade ? `Shade: ${product.shade}` : product.size;
  return `${detail} • Qty: ${product.qty}`;
}

ListSelectionStepper.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function ListSelectionStepper({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // ListSelectionStepper.mockData.js.
  const data = content || MOCK_LIST_SELECTION_STEPPER;
  const { title, subtitle, products, quantityLabel, confirmLabel = "Confirm" } = data;
  const secondaryCta = data.secondaryCta || { type: "none", label: "None of it" };

  const [selected, setSelected] = useState({});
  // Quantities are only meaningful for selected products; unselected entries
  // are just left absent rather than tracked at 0.
  const [quantities, setQuantities] = useState({});
  const anySelected = products.some((product) => selected[product.id]);

  function toggle(product) {
    setSelected((prev) => {
      const next = { ...prev, [product.id]: !prev[product.id] };
      return next;
    });
    // Stepper always initializes to 1 the first time an item is checked;
    // re-checking after unchecking keeps whatever quantity was last set.
    setQuantities((prev) => (prev[product.id] ? prev : { ...prev, [product.id]: 1 }));
  }

  function setQuantity(productId, value) {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  }

  function respond(text) {
    addMessage({ text, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN });
  }

  function handleConfirm() {
    const chosen = products.filter((product) => selected[product.id]);
    respond(JSON.stringify({
      display: chosen.map((p) => p.name).join(", "),
      skus:    chosen.map((p) => `${p.id}:${quantities[p.id] || 1}`).join(", "),
    }));
  }

  function handleAllOfIt() {
    const next = {};
    products.forEach((p) => { next[p.id] = true; });
    setSelected(next);
    setQuantities((prev) => {
      const updated = { ...prev };
      products.forEach((p) => { if (!updated[p.id]) updated[p.id] = 1; });
      return updated;
    });
  }

  function handleNoneOfIt() {
    setSelected({});
    setQuantities({});
  }

  return (
    <ListCardShell data-testid="list-selection-stepper">
      <CardHeader>
        <CardHeaderTitle>{title}</CardHeaderTitle>
        <CardHeaderSubtitle>{subtitle}</CardHeaderSubtitle>
      </CardHeader>
      <Divider />
      <ProductList>
        {products.map((product) => {
          const isSelected = !!selected[product.id];
          return (
            <div key={product.id}>
              <SelectableProductRow>
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggle(product)}
                  ariaLabel={product.name}
                  testId={`list-selection-stepper-checkbox-${product.id}`}
                />
                <ProductTextColumn>
                  <ProductPrimaryText>{product.name}</ProductPrimaryText>
                  <ProductSecondaryText>{formatProductMeta(product)}</ProductSecondaryText>
                  {isSelected && (
                    <NumericStepper
                      value={quantities[product.id] || 1}
                      max={product.qty}
                      onChange={(value) => setQuantity(product.id, value)}
                      label={quantityLabel}
                      testId={`list-selection-stepper-qty-${product.id}`}
                    />
                  )}
                </ProductTextColumn>
              </SelectableProductRow>
            </div>
          );
        })}
      </ProductList>
      <CtaGroup>
        <PrimaryCtaButton disabled={!anySelected} onClick={handleConfirm} data-testid="list-selection-stepper-confirm">
          {confirmLabel}
        </PrimaryCtaButton>
        <SecondaryCtaButton onClick={handleAllOfIt} data-testid="list-selection-stepper-all">
          {secondaryCta.label}
        </SecondaryCtaButton>
        {anySelected && (
          <SecondaryCtaButton onClick={handleNoneOfIt} data-testid="list-selection-stepper-none">
            <FormattedMessage id="Chat.NoneOfIt" defaultMessage="None of it" />
          </SecondaryCtaButton>
        )}
      </CtaGroup>
    </ListCardShell>
  );
}
