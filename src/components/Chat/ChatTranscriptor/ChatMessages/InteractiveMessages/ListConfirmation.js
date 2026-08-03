import React from "react";
import PT from "prop-types";
import { MOCK_ORDER } from "./ListConfirmation.mockData";
import { ContentType } from "../../../datamodel/Model";
import {
  ListCardShell,
  CardHeader,
  CardHeaderTitle,
  CardHeaderSubtitle,
  Divider,
  ProductList,
  ProductRow,
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

ListConfirmation.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function ListConfirmation({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // ListConfirmation.mockData.js. Swapping to the real VA JSON is a data
  // change only, not a structural one.
  const order = (content && content.order) || MOCK_ORDER;
  const yesLabel = order.yesLabel || "Yes";
  const noLabel = order.noLabel || "No";
  const yesMessage = order.yesMessage || `Yes, order ${order.orderNumber} is correct`;
  const noMessage = order.noMessage || `No, order ${order.orderNumber} is not correct`;

  function respond(text) {
    addMessage({ text, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN });
  }

  return (
    <ListCardShell data-testid="list-confirmation">
      <CardHeader>
        <CardHeaderTitle>Order No. {order.orderNumber}</CardHeaderTitle>
        <CardHeaderSubtitle>Placed on: {order.orderDate}</CardHeaderSubtitle>
      </CardHeader>
      <Divider />
      <ProductList>
        {order.products.map((product, index) => (
          <ProductRow key={index}>
            <ProductPrimaryText>{product.name}</ProductPrimaryText>
            <ProductSecondaryText>{formatProductMeta(product)}</ProductSecondaryText>
          </ProductRow>
        ))}
      </ProductList>
      <CtaGroup>
        <PrimaryCtaButton onClick={() => respond(yesMessage)} data-testid="list-confirmation-yes">
          {yesLabel}
        </PrimaryCtaButton>
        <SecondaryCtaButton onClick={() => respond(noMessage)} data-testid="list-confirmation-no">
          {noLabel}
        </SecondaryCtaButton>
      </CtaGroup>
    </ListCardShell>
  );
}
