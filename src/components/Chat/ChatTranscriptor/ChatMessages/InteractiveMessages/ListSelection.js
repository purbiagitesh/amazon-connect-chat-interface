import React, { useState } from "react";
import PT from "prop-types";
import { MOCK_LIST_SELECTION } from "./ListSelection.mockData";
import { ContentType } from "../../../datamodel/Model";
import Checkbox from "./Checkbox";
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

ListSelection.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function ListSelection({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // ListSelection.mockData.js.
  const data = content || MOCK_LIST_SELECTION;
  const { title, subtitle, products, confirmLabel = "Confirm" } = data;
  const secondaryCta = data.secondaryCta || { type: "all", label: "All of it" };

  const [selected, setSelected] = useState({});
  const anySelected = products.some((product) => selected[product.id]);

  function toggle(productId) {
    setSelected((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }

  function respond(text) {
    addMessage({ text, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN });
  }

  function handleConfirm() {
    const names = products.filter((product) => selected[product.id]).map((product) => product.name);
    respond(names.join(", "));
  }

  function handleSecondaryCta() {
    // "All of it" only checks every box - per spec it still routes through
    // an explicit Confirm click. "None of it" is a direct, immediate
    // response since there's nothing further to select.
    if (secondaryCta.type === "all") {
      const next = {};
      products.forEach((product) => {
        next[product.id] = true;
      });
      setSelected(next);
    } else {
      respond(secondaryCta.message || secondaryCta.label);
    }
  }

  return (
    <ListCardShell data-testid="list-selection">
      <CardHeader>
        <CardHeaderTitle>{title}</CardHeaderTitle>
        <CardHeaderSubtitle>{subtitle}</CardHeaderSubtitle>
      </CardHeader>
      <Divider />
      <ProductList>
        {products.map((product) => (
          <SelectableProductRow key={product.id}>
            <Checkbox
              checked={!!selected[product.id]}
              onChange={() => toggle(product.id)}
              ariaLabel={product.name}
              testId={`list-selection-checkbox-${product.id}`}
            />
            <ProductTextColumn>
              <ProductPrimaryText>{product.name}</ProductPrimaryText>
              <ProductSecondaryText>{formatProductMeta(product)}</ProductSecondaryText>
            </ProductTextColumn>
          </SelectableProductRow>
        ))}
      </ProductList>
      <CtaGroup>
        <PrimaryCtaButton disabled={!anySelected} onClick={handleConfirm} data-testid="list-selection-confirm">
          {confirmLabel}
        </PrimaryCtaButton>
        <SecondaryCtaButton onClick={handleSecondaryCta} data-testid="list-selection-secondary">
          {secondaryCta.label}
        </SecondaryCtaButton>
      </CtaGroup>
    </ListCardShell>
  );
}
