import React, { useEffect, useRef, useState } from "react";
import PT from "prop-types";
import styled from "styled-components";
import { MOCK_SHADE_SELECTOR } from "./ShadeSelector.mockData";
import { ContentType } from "../../../datamodel/Model";

// Fully self-contained widget - deliberately does not import from
// ListPrimitives.js/ProductSelector.js/SingleProduct.js, matching the
// convention those widgets already established (see ProductSelector.js's
// header comment). Keeps this widget free to evolve independently.

// Fixed 230px card per the Shade Selector figma spec.
const CARD_WIDTH = 230;

// Card content (everything below the 16px padding) is 198px wide per spec -
// every inner block below is sized to that, not to CARD_WIDTH directly.
const CONTENT_WIDTH = 198;

// Card chrome (background/border) is neutral per spec and stays fixed across
// brands. Reuses the same --color-borders-main-default override ProductSelector
// already exposes for its divider, so a host page only has one var to theme
// neutral card borders with.
const CardShell = styled.div`
  box-sizing: border-box;
  width: ${CARD_WIDTH}px;
  max-width: ${CARD_WIDTH}px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--color-borders-main-default, #d9d9d9);
  background: ${({ theme }) => theme.palette.white};
`;

const CardHeader = styled.div`
  width: ${CONTENT_WIDTH}px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

// Text color/size is neutral per spec; font-family is intentionally left
// unset by theme.typography.h3/label so it inherits the brand's typeface
// (see defaultTheme.js's "Canonical widget text styles" note) - this is how
// "Font is brand-specific, color is neutral" is satisfied without hardcoding
// a brand font here.
const CardHeaderTitle = styled.div`
  ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.globals.bodyFontColor};
`;

const CardHeaderSubtitle = styled.div`
  ${({ theme }) => theme.typography.label};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
`;

// Single bordered box that contains both the always-visible trigger row and
// the (conditionally rendered) option list, matching the figma mock where
// the border wraps both as one control rather than two stacked cards.
// Collapsed height is fixed to the trigger's 36px; expanded height is capped
// at the spec's 216px and the option list scrolls internally past that.
const DropdownBox = styled.div`
  box-sizing: border-box;
  width: ${CONTENT_WIDTH}px;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  border: 1px solid
    var(--color-borders-main-darker, ${({ theme }) => theme.componentPalette.quickReply.borderColor});
  overflow: hidden;
  ${(props) => (props.open ? "max-height: 216px;" : "height: 36px;")}
`;

const Trigger = styled.button`
  box-sizing: border-box;
  flex: 0 0 auto;
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
`;

const TriggerLabel = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const OptionsList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0 8px 8px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

// Selected option is bolded rather than re-colored - keeps the neutral
// "Card and dropdown" color rule intact while still distinguishing the
// current shade, same non-color-based selected-state treatment used
// elsewhere (e.g. ProductSelector's radio dot only fills, never recolors
// the option row itself).
const Option = styled.li`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
  font-weight: ${(props) => (props.selected ? "700" : "400")};
  background: ${(props) =>
    props.selected ? "var(--ac-widget-shade-selector-option-selected-bg, #f7f7f7)" : "transparent"};

  &:hover {
    background: var(--ac-widget-shade-selector-option-hover-bg, #f2f2f2);
  }
`;

const OptionLabel = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: break-word;
`;

// Swatch is only rendered when a shade has color data (see ShadeSelector
// below) - "If swatch data is unavailable, the dropdown will display shade
// names only" per spec, same optional-swatch pattern SingleProduct.js
// already uses for product.shadeColor.
const ShadeSwatch = styled.span`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${(props) => props.color};
`;

const ChevronWrapper = styled.span`
  flex: 0 0 auto;
  display: inline-flex;
  color: ${({ theme }) => theme.globals.textSecondaryColor};
  transform: rotate(${(props) => (props.open ? "180" : "0")}deg);
  transition: transform 0.15s ease;
`;

function ChevronDown({ open }) {
  return (
    <ChevronWrapper open={open}>
      <svg width="12" height="8" viewBox="0 0 12 8" xmlns="http://www.w3.org/2000/svg">
        <polygon fill="currentColor" points="0 1.41 1.41 0 6 4.59 10.59 0 12 1.41 6 7.41" />
      </svg>
    </ChevronWrapper>
  );
}

ChevronDown.propTypes = {
  open: PT.bool,
};

const ctaButtonBase = `
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-width: 48px;
  min-height: 36px;
  padding: 10px 8px;
  border-radius: 16px;
  border: none;
  box-sizing: border-box;
`;

// Reuses the same --ac-widget-selection-card-select-bg accent var as the
// ProductSelector/SingleProduct primary CTAs, so brands theme one CTA color
// across every card widget rather than a new var per widget.
const ConfirmButton = styled.button`
  ${ctaButtonBase}
  ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.globals.bodyFontColor};
  cursor: pointer;
  background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});

  &:disabled {
    background: ${({ theme }) => theme.chatTranscriptor.incomingMsgBg};
    cursor: not-allowed;
  }
`;

ShadeSelector.propTypes = {
  content: PT.object,
  addMessage: PT.func.isRequired,
};

export default function ShadeSelector({ content, addMessage }) {
  // Falls back to mock data only when no runtime content is supplied - see
  // ShadeSelector.mockData.js. Swapping to the real VA JSON is a data
  // change only, not a structural one.
  const data = content || MOCK_SHADE_SELECTOR;
  const { title, subtitle, shades } = data;
  const confirmLabel = data.confirmLabel || "Confirm";

  // Per spec: "the widget displays a shade dropdown field with the first
  // available shade pre-selected."
  const [selectedId, setSelectedId] = useState(shades[0] && shades[0].id);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  const selectedShade = shades.find((shade) => shade.id === selectedId);

  // Closes on outside click - scoped to the dropdown box only (not the
  // whole card) so clicking Confirm while the list is open still closes it
  // first, same as a native <select>.
  useEffect(() => {
    if (!open) return undefined;
    function handleOutsideClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  function respond(text) {
    addMessage({ text, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN });
  }

  function selectShade(shade) {
    setSelectedId(shade.id);
    setOpen(false);
    if (triggerRef.current) triggerRef.current.focus();
  }

  function handleTriggerKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function handleOptionKeyDown(event, shade) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectShade(shade);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      if (triggerRef.current) triggerRef.current.focus();
    }
  }

  function handleConfirm() {
    if (!selectedShade) return;
    respond(selectedShade.name);
  }

  return (
    <CardShell data-testid="shade-selector">
      <CardHeader>
        <CardHeaderTitle>{title}</CardHeaderTitle>
        <CardHeaderSubtitle>{subtitle}</CardHeaderSubtitle>
      </CardHeader>
      <DropdownBox open={open} ref={dropdownRef}>
        <Trigger
          type="button"
          ref={triggerRef}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={handleTriggerKeyDown}
          data-testid="shade-selector-trigger"
        >
          {selectedShade && selectedShade.color && <ShadeSwatch color={selectedShade.color} />}
          <TriggerLabel>{selectedShade ? selectedShade.name : ""}</TriggerLabel>
          <ChevronDown open={open} />
        </Trigger>
        {open && (
          <OptionsList role="listbox" aria-label={title} data-testid="shade-selector-listbox">
            {shades.map((shade) => (
              <Option
                key={shade.id}
                role="option"
                tabIndex={0}
                aria-selected={shade.id === selectedId}
                selected={shade.id === selectedId}
                onClick={() => selectShade(shade)}
                onKeyDown={(event) => handleOptionKeyDown(event, shade)}
                data-testid={`shade-selector-option-${shade.id}`}
              >
                {shade.color && <ShadeSwatch color={shade.color} />}
                <OptionLabel>{shade.name}</OptionLabel>
              </Option>
            ))}
          </OptionsList>
        )}
      </DropdownBox>
      <ConfirmButton disabled={!selectedShade} onClick={handleConfirm} data-testid="shade-selector-confirm">
        {confirmLabel}
      </ConfirmButton>
    </CardShell>
  );
}
