// Placeholder data for local/visual development - ShadeSelector falls back
// to this only when no runtime content is passed in. `color` is optional per
// shade: when the backend can't resolve swatch imagery/color data for a
// shade, omit it and the dropdown falls back to a name-only row.
export const MOCK_SHADE_SELECTOR = {
  title: "Which shade are you looking for?",
  subtitle: "Select one of the options.",
  shades: [
    { id: "s1", name: "812 Change the World", color: "#4B2E2C" },
    { id: "s2", name: "333 Persuasive", color: "#B24A34" },
    { id: "s3", name: "421 Stay Neutral", color: "#C98A63" },
    { id: "s4", name: "220 Wheat", color: "#D9A876" },
    { id: "s5", name: "130 Ivory Beige", color: "#E8C7A0" },
    { id: "s6", name: "620 Ecru Beige", color: "#C9B08C" },
  ],
  confirmLabel: "Confirm",
};
