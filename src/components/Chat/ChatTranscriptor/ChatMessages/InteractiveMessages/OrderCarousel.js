import React from "react";
import PT from "prop-types";
import SelectionCarousel from "./SelectionCarousel";
import { MOCK_ORDERS } from "./OrderCarousel.mockData";

// Adapter for the "Find Order Number" flow - maps order-shaped VA content
// onto the generic SelectionCarousel primitive (structure/behavior lives
// there and is shared across flows; only this mapping is order-specific).
function formatProductMeta(product) {
  const detail = product.shade ? `Shade: ${product.shade}` : product.size;
  return `${detail} • Qty: ${product.qty}`;
}

OrderCarousel.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function OrderCarousel({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // OrderCarousel.mockData.js. Swapping to the real VA JSON is a data
  // change only, not a structural one.
  const orders = (content && content.orders) || MOCK_ORDERS;

  const cards = orders.map((order) => ({
    id: order.id,
    testId: `order-card-${order.id}`,
    header: {
      title: `Order No. ${order.orderNumber}`,
      subtitle: `Placed on: ${order.orderDate}`,
    },
    items: order.products.map((product) => ({
      primaryText: product.name,
      secondaryText: formatProductMeta(product),
    })),
    onSelectMessage: `Selected order ${order.orderNumber}`,
  }));

  const fallbackCard = {
    testId: "order-card-empty",
    heading: "Can't find your order?",
    ctas: [
      { testId: "order-card-empty-enter", label: "Enter order number", message: "Enter order number" },
      { testId: "order-card-empty-unknown", label: "Don't know order number", message: "Don't know order number" },
    ],
  };

  return (
    <SelectionCarousel
      cards={cards}
      fallbackCard={fallbackCard}
      addMessage={addMessage}
      testIdPrefix="order-carousel"
    />
  );
}
