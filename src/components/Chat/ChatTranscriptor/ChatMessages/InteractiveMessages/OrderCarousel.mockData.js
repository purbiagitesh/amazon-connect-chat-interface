// Placeholder data for local/visual development (see step 6 of the Order
// Carousel design plan - build and verify the UI before the VA JSON
// contract exists). OrderCarousel falls back to this only when no
// content.orders is passed in, so swapping to runtime data later requires
// no structural changes.
export const MOCK_ORDERS = [
  {
    id: "order-00000",
    orderNumber: "00000",
    orderDate: "May 5, 2026",
    products: [
      { name: "Product Name", size: "1.7 oz", qty: 1 },
      { name: "Product Name", shade: "Rose", qty: 1 },
      { name: "Sample of Long Product Name", size: "1.7 oz", qty: 1 },
      { name: "Product Name", size: "1.7 oz", qty: 1 },
      { name: "Sample of Long Product Name", size: "1.7 oz", qty: 1 },
      { name: "Product Name", size: "1.7 oz", qty: 1 },
    ],
  },
  {
    id: "order-11111",
    orderNumber: "11111",
    orderDate: "May 1, 2026",
    products: [
      { name: "Sample of Long Product Name", size: "1.7 oz", qty: 1 },
    ],
  },
];
