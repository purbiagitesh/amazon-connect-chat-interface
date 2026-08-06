// Placeholder data for local/visual development, same approach as
// OrderCarousel.mockData.js - ListSelectionStepper falls back to this only
// when no runtime content is passed in. `qty` doubles as each product's
// purchased quantity, i.e. the stepper's ceiling.
export const MOCK_LIST_SELECTION_STEPPER = {
  title: "Which items are damaged?",
  subtitle: "Select all that apply.",
  quantityLabel: "Damaged",
  products: [
    { id: "p1", name: "Product Name", size: "1.7 oz", qty: 1 },
    { id: "p2", name: "Sample of Long Product Name", shade: "Rose", qty: 2 },
    { id: "p3", name: "Product Name", size: "1.7 oz", qty: 3 },
    { id: "p4", name: "Product Name", size: "1.7 oz", qty: 1 },
    { id: "p5", name: "Product Name", shade: "Ruby", qty: 1 },
  ],
  confirmLabel: "Confirm",
  secondaryCta: { type: "none", label: "None of it" },
};
