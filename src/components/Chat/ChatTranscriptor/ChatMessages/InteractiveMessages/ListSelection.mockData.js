// Placeholder data for local/visual development, same approach as
// OrderCarousel.mockData.js - ListSelection falls back to this only when no
// runtime content is passed in.
export const MOCK_LIST_SELECTION = {
  title: "Which items are missing?",
  subtitle: "Select all that apply.",
  products: [
    { id: "p1", name: "Product Name", size: "1.7 oz", qty: 1 },
    { id: "p2", name: "Product Name", shade: "Ruby", qty: 2 },
    { id: "p3", name: "Product Name", size: "1.7 oz", qty: 1 },
    { id: "p4", name: "Product Name", shade: "Rose", qty: 3 },
    { id: "p5", name: "Product Name", size: "1.7 oz", qty: 1 },
  ],
  confirmLabel: "Confirm",
  secondaryCta: { type: "all", label: "All of it" },
};
