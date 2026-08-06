// Placeholder data for local/visual development, same approach as
// OrderCarousel.mockData.js - ListConfirmation falls back to this only when
// no content.order is passed in, so swapping to real VA JSON later requires
// no structural changes.
export const MOCK_ORDER = {
  orderNumber: "00000",
  orderDate: "December 1, 2026",
  products: [
    { name: "Product Name", size: "1.7 oz", qty: 1 },
    { name: "Product Name", size: "1.7 oz", qty: 2 },
    { name: "Product Name", shade: "Rose", qty: 3 },
    { name: "Product Name", size: "1.7 oz", qty: 1 },
    { name: "Product Name", shade: "1W1", qty: 1 },
  ],
};
