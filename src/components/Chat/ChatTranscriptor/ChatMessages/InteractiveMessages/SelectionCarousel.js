import React, { useCallback, useRef, useState } from "react";
import styled from "styled-components";
import PT from "prop-types";
import { Button } from "connect-core";
import { ContentType } from "../../../datamodel/Model";

// Generic carousel-of-selectable-cards primitive. Structure/behavior here
// (scroll, expand/collapse, single-select-disables-siblings, chevron +
// pagination nav, fixed 200px card width) is meant to stay identical across
// every flow that uses it - only the content/CTAs passed in via `cards`/
// `fallbackCard` should vary. Flow-specific adapters (e.g. OrderCarousel.js)
// map their own domain data onto this generic shape rather than duplicating
// this component. See the plan doc this was built from for the rationale.
const CARD_WIDTH = 200;
const CARD_GAP = 12;
const DEFAULT_COLLAPSED_ITEM_COUNT = 2;
const DEFAULT_TOGGLE_LABELS = { expand: "Show all items", collapse: "Hide all items" };
const DEFAULT_SELECT_LABEL = "Select this order";

function ChevronIcon({ direction }) {
  return (
    <ChevronIconWrapper direction={direction}>
      <svg width="8px" height="12px" viewBox="0 0 8 12" xmlns="http://www.w3.org/2000/svg">
        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
          <polygon fill="currentColor" fillRule="nonzero" points="2 0 0.59 1.41 5.17 6 0.59 10.59 2 12 8 6" />
        </g>
      </svg>
    </ChevronIconWrapper>
  );
}

const ChevronIconWrapper = styled.div`
  font-size: 0;
  transform: rotate(${(props) => (props.direction === "left" ? "180" : "0")}deg);
`;

const CarouselShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.small};
`;

const CardsScroller = styled.div`
  display: flex;
  gap: ${CARD_GAP}px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;

  ::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
`;

const DEFAULT_CARD_MIN_HEIGHT = 255;

const CardBase = styled.div`
  flex: 0 0 auto;
  box-sizing: border-box;
  width: ${CARD_WIDTH}px;
  min-height: ${(props) => (props.minHeight != null ? props.minHeight : DEFAULT_CARD_MIN_HEIGHT)}px;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--ac-widget-selection-card-border, ${({ theme }) => theme.palette.alto});
  background: ${({ theme }) => theme.palette.white};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  pointer-events: ${(props) => (props.disabled ? "none" : "auto")};

  ${(props) =>
    props.selected
      ? `border-color: var(--ac-widget-selection-card-select-bg, ${props.theme.chatTranscriptor.sendButtonActiveBg}); border-width: 2px;`
      : ""}
`;

const CardTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CardHeaderTitle = styled.div`
  ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.globals.bodyFontColor};
`;

const CardHeaderSubtitle = styled.div`
  ${({ theme }) => theme.typography.label};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
`;

const Divider = styled.div`
  border-top: 1px solid var(--ac-widget-selection-card-border, ${({ theme }) => theme.palette.alto});
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ItemRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

// Truncates to a single line only while collapsed - an expanded card must
// show the full text (spec: "Show all items" reveals full product names).
const ItemPrimaryText = styled.div`
  ${({ theme }) => theme.typography.body};
  font-weight: 600;
  color: ${({ theme }) => theme.globals.bodyFontColor};
  ${(props) =>
    props.truncate
      ? `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `
      : ""}
`;

const ItemSecondaryText = styled.div`
  ${({ theme }) => theme.typography.label};
  color: ${({ theme }) => theme.globals.textSecondaryColor};
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CardButton = styled(Button)`
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: none;
  min-height: 36px;
  padding: 10px 8px;
  border-radius: 16px;
  border: none;
  ${({ theme }) => theme.typography.body};
`;

const SecondaryCardButton = styled(CardButton)`
  background: ${({ theme }) => theme.chatTranscriptor.incomingMsgBg};
  color: ${({ theme }) => theme.globals.bodyFontColor};

  &:hover:enabled {
    background: ${({ theme }) => theme.chatTranscriptor.incomingMsgBg};
  }
`;

const PrimaryCardButton = styled(CardButton)`
  background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});
  color: ${({ theme }) => theme.globals.bodyFontColor};

  &:hover:enabled {
    background: var(--ac-widget-selection-card-select-bg, ${({ theme }) => theme.chatTranscriptor.sendButtonActiveBg});
  }
`;

const FallbackCard = styled(CardBase)`
  border-style: dashed;
  justify-content: flex-start;
  align-items: stretch;
  text-align: center;
`;

const FallbackCardHeading = styled.div`
  ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.globals.bodyFontColor};
`;

const NavRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const NavButton = styled.button`
  width: 36px;
  height: 36px;
  padding: 10px;
  border-radius: 50%;
  box-sizing: border-box;
  border: 1px solid ${(props) => (props.enabled ? props.theme.color.primary : "transparent")};
  background: ${({ theme }) => theme.palette.white};
  color: ${({ theme }) => theme.color.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${(props) => (props.enabled ? "pointer" : "default")};
  opacity: ${(props) => (props.enabled ? 1 : 0.4)};

  svg {
    width: 8px;
    height: 12px;
  }
`;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Dot = styled.div`
  height: 8px;
  width: ${(props) => (props.active ? "24px" : "8px")};
  border-radius: 4px;
  background: ${(props) => (props.active ? props.theme.color.primary : props.theme.palette.alto)};
  transition: width 0.15s ease;
`;

function SelectableCard({ card, expanded, onToggleExpand, selected, disabled, onSelect }) {
  const collapsedItemCount = card.collapsedItemCount || DEFAULT_COLLAPSED_ITEM_COUNT;
  const toggleLabels = card.toggleLabels || DEFAULT_TOGGLE_LABELS;
  const selectLabel = card.selectLabel || DEFAULT_SELECT_LABEL;
  const items = expanded ? card.items : card.items.slice(0, collapsedItemCount);

  return (
    <CardBase disabled={disabled} selected={selected} minHeight={card.minHeight} data-testid={card.testId}>
      <CardTop>
        <CardHeader>
          <CardHeaderTitle>{card.header.title}</CardHeaderTitle>
          <CardHeaderSubtitle>{card.header.subtitle}</CardHeaderSubtitle>
        </CardHeader>
        <Divider />
        <ItemList>
          {items.map((item, index) => (
            <ItemRow key={index}>
              {item.labelAbove ? (
                <>
                  <ItemSecondaryText>{item.secondaryText}</ItemSecondaryText>
                  <ItemPrimaryText truncate={!expanded}>{item.primaryText}</ItemPrimaryText>
                </>
              ) : (
                <>
                  <ItemPrimaryText truncate={!expanded}>{item.primaryText}</ItemPrimaryText>
                  <ItemSecondaryText>{item.secondaryText}</ItemSecondaryText>
                </>
              )}
            </ItemRow>
          ))}
        </ItemList>
      </CardTop>
      <ButtonGroup>
        {!card.hideToggle && (
          <SecondaryCardButton disabled={disabled} onClick={onToggleExpand} data-testid={`${card.testId}-toggle`}>
            {expanded ? toggleLabels.collapse : toggleLabels.expand}
          </SecondaryCardButton>
        )}
        <PrimaryCardButton disabled={disabled} onClick={onSelect} data-testid={`${card.testId}-select`}>
          {selectLabel}
        </PrimaryCardButton>
      </ButtonGroup>
    </CardBase>
  );
}

function FallbackSelectionCard({ card, disabled, onCtaClick }) {
  return (
    <FallbackCard disabled={disabled} minHeight={card.minHeight} data-testid={card.testId}>
      <FallbackCardHeading>{card.heading}</FallbackCardHeading>
      <ButtonGroup>
        {card.ctas.map((cta) => (
          <SecondaryCardButton
            key={cta.testId}
            disabled={disabled}
            onClick={() => onCtaClick(cta)}
            data-testid={cta.testId}
          >
            {cta.label}
          </SecondaryCardButton>
        ))}
      </ButtonGroup>
    </FallbackCard>
  );
}

SelectionCarousel.propTypes = {
  cards: PT.arrayOf(
    PT.shape({
      id: PT.string.isRequired,
      testId: PT.string.isRequired,
      header: PT.shape({ title: PT.string, subtitle: PT.string }).isRequired,
      items: PT.arrayOf(
        PT.shape({ primaryText: PT.string, secondaryText: PT.string, labelAbove: PT.bool })
      ).isRequired,
      collapsedItemCount: PT.number,
      toggleLabels: PT.shape({ expand: PT.string, collapse: PT.string }),
      hideToggle: PT.bool,
      selectLabel: PT.string,
      onSelectMessage: PT.string.isRequired,
      minHeight: PT.number,
    })
  ).isRequired,
  fallbackCard: PT.shape({
    testId: PT.string.isRequired,
    heading: PT.string.isRequired,
    ctas: PT.arrayOf(PT.shape({ testId: PT.string, label: PT.string, message: PT.string })).isRequired,
    minHeight: PT.number,
  }),
  addMessage: PT.func.isRequired,
  testIdPrefix: PT.string,
};

export default function SelectionCarousel({ cards, fallbackCard, addMessage, testIdPrefix = "selection-carousel" }) {
  const totalCards = cards.length + (fallbackCard ? 1 : 0);

  const scrollerRef = useRef(null);
  const [expandedIds, setExpandedIds] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(totalCards > 1);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const index = Math.round(el.scrollLeft / (CARD_WIDTH + CARD_GAP));
    setActiveIndex(Math.max(0, Math.min(index, totalCards - 1)));
  }, [totalCards]);

  function scrollByCard(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft += direction * (CARD_WIDTH + CARD_GAP);
  }

  function handleToggleExpand(cardId) {
    setExpandedIds((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  }

  function sendInteractiveResponse(text) {
    addMessage({ text, type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN });
  }

  function handleSelect(card) {
    setSelectedId(card.id);
    sendInteractiveResponse(card.onSelectMessage);
  }

  return (
    <CarouselShell data-testid={testIdPrefix}>
      <CardsScroller ref={scrollerRef} onScroll={updateScrollState} data-testid={`${testIdPrefix}-scroller`}>
        {cards.map((card) => (
          <SelectableCard
            key={card.id}
            card={card}
            expanded={!!expandedIds[card.id]}
            onToggleExpand={() => handleToggleExpand(card.id)}
            selected={selectedId === card.id}
            disabled={selectedId !== null && selectedId !== card.id}
            onSelect={() => handleSelect(card)}
          />
        ))}
        {fallbackCard && (
          <FallbackSelectionCard
            card={fallbackCard}
            disabled={selectedId !== null}
            onCtaClick={(cta) => sendInteractiveResponse(cta.message)}
          />
        )}
      </CardsScroller>

      <NavRow>
        <NavButton
          enabled={canScrollLeft}
          disabled={!canScrollLeft}
          onClick={() => scrollByCard(-1)}
          aria-label="Previous cards"
          data-testid={`${testIdPrefix}-prev`}
        >
          <ChevronIcon direction="left" />
        </NavButton>
        <Pagination>
          {Array.from({ length: totalCards }).map((_, index) => (
            <Dot key={index} active={index === activeIndex} />
          ))}
        </Pagination>
        <NavButton
          enabled={canScrollRight}
          disabled={!canScrollRight}
          onClick={() => scrollByCard(1)}
          aria-label="Next cards"
          data-testid={`${testIdPrefix}-next`}
        >
          <ChevronIcon direction="right" />
        </NavButton>
      </NavRow>
    </CarouselShell>
  );
}
