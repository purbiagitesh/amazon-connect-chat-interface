import React from "react";
import PT from "prop-types";
import SelectionCarousel from "./SelectionCarousel";
import { MOCK_CASE_ELEMENTS } from "./CaseCarousel.mockData";

// Adapter for the "Find Case Number" flow - maps case-shaped VA content onto
// the generic SelectionCarousel primitive. Per design this reuses the same
// visual pattern as OrderCarousel.js (no new Figma design was needed for
// Case Number), but stays its own adapter/component and template type so
// each flow's data mapping is independent and neither can break the other.
//
// The VA sends this data today under templateType "ListPicker" with plain
// {title, subtitle} elements (case number as title, "<ISO date> | <type>"
// as subtitle, plus a no-subtitle "Help With Something Else" element) - see
// the real payload this was built against. Reading that exact same
// content.elements shape here means the only backend change needed to get
// the carousel design is switching templateType to "CaseCarousel"; no new
// fields required.
const SUBTITLE_PATTERN = /^(.+?)\s*\|\s*(.+)$/;

function formatCaseDate(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) return isoTimestamp;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function toTitleCase(text) {
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

CaseCarousel.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function CaseCarousel({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // CaseCarousel.mockData.js. Swapping to the real VA JSON is a data change
  // only, not a structural one.
  const elements = (content && content.elements) || MOCK_CASE_ELEMENTS;

  const cards = [];
  const fallbackCtas = [];

  elements.forEach((element, index) => {
    const match = element.subtitle && element.subtitle.match(SUBTITLE_PATTERN);
    if (!match) {
      // No parseable "<date> | <type>" subtitle (e.g. "Help With Something
      // Else") - not a case, just a plain reply option like ListPicker
      // would have rendered it as a list button.
      fallbackCtas.push({ testId: `case-card-fallback-${index}`, label: element.title, message: element.title });
      return;
    }
    const [, isoDate, type] = match;
    cards.push({
      id: `case-${element.title}`,
      testId: `case-card-${element.title}`,
      header: {
        title: `Case No. ${element.title}`,
        subtitle: `Date: ${formatCaseDate(isoDate)}`,
      },
      items: [{ labelAbove: true, primaryText: toTitleCase(type), secondaryText: "Related to:" }],
      hideToggle: true,
      // Case cards only ever have one "Related to" line, unlike Order's
      // multi-product list - drop SelectionCarousel's default 255px min
      // height so the card hugs its (shorter) content instead of leaving a
      // gap above the button.
      minHeight: 0,
      selectLabel: "Select this Case",
      // Matches how a plain ListPicker element reply already works
      // (createInteractiveMessagePayload sends selectedElement.title back
      // as-is) so the VA side needs no change to recognize the selection.
      onSelectMessage: element.title,
    });
  });

  const fallbackCard = fallbackCtas.length
    ? { testId: "case-card-empty", heading: "Need help with something else?", ctas: fallbackCtas, minHeight: 0 }
    : undefined;

  return (
    <SelectionCarousel cards={cards} fallbackCard={fallbackCard} addMessage={addMessage} testIdPrefix="case-carousel" />
  );
}
