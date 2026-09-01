// Placeholder data for local/visual development - ReshipCaseCreation falls
// back to this only when no runtime content is passed in. Per the Figma
// "Reship Case Creation" spec: the Virtual Assistant asks whether the
// consumer prefers a reshipment or a refund, rendered as one emphasized
// primary action ("Yes") plus a lower-emphasis quaternary alternative
// ("No, I don't want a reshipment").
export const MOCK_RESHIP_CASE_CREATION = {
  title:
    "I can create a case to have the product reshipped within 5 working days. If reshipment isn't an option, a refund will be processed. Does that work for you?",
  elements: [
    { title: "Yes", emphasis: "primary" },
    { title: "No, I don't want a reshipment", emphasis: "quaternary" },
  ],
};
