import React from "react";
import {useIntl} from "react-intl";
import PT from "prop-types";
import styled from "styled-components";

// Recording/privacy consent banner shown directly above the composer input.
// Figma spec ("Disclaimer" component):
//  - Expanded by default at the start of a new chat session.
//  - Collapses into a single-line sticky banner once the consumer sends
//    their first message; "Show more"/"Show less" toggles between the two
//    for the rest of the session (never fully hidden).
//  - Icon + neutral background/text are fixed across every brand; the
//    background picks up the brand's tint only while the consumer is
//    engaging with the message input (see `highlighted` prop).
const Container = styled.div`
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: var(--ac-widget-disclaimer-gap, 10px);
  padding: var(--ac-widget-disclaimer-padding, 16px);
  border-top: var(--ac-widget-disclaimer-border-top, 1px solid ${(props) => props.theme.palette.lightGray});
  background: ${(props) => (props.highlighted
    ? `var(--ac-widget-disclaimer-background-active, ${props.theme.componentPalette.disclaimer.activeBackgroundColor})`
    : `var(--ac-widget-disclaimer-background, ${props.theme.palette.haze})`)};
  transition: background-color 0.2s ease;

  /* Matches the composer's own small-screen breakpoint (ChatComposer.js
     DefaultChatComposerWrapper) so the two stay visually aligned. */
  @media (max-width: 360px) {
    padding: var(--ac-widget-disclaimer-padding-small, 12px);
  }
`;

const IconWrapper = styled.div`
  flex-shrink: 0;
  display: flex;

  svg {
    width: var(--ac-widget-disclaimer-icon-size, 20px);
    height: var(--ac-widget-disclaimer-icon-size, 20px);
  }
`;

const Body = styled.div`
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
`;

// Collapsed state only: text + toggle sit side by side on one line (text
// truncates, toggle never shrinks). Expanded state doesn't need this row -
// the toggle floats into the paragraph itself instead (see ToggleButton).
const CollapsedRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
`;

const Text = styled.p`
  margin: 0;
  font-family: inherit !important;
  ${(props) => props.theme.typography.disclaimer};
  color: var(--ac-widget-disclaimer-text-color, ${(props) => props.theme.palette.darkerGray});

  ${(props) => (props.expanded ? `
    overflow-wrap: break-word;
  ` : `
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `)}
`;

const Link = styled.a`
  ${(props) => props.theme.typography.disclaimerLink};
  color: var(--ac-widget-disclaimer-link-color, ${(props) => props.theme.palette.darkBlue});
`;

// Figma floats "Show less" into the top-right corner of the paragraph in
// the expanded state (text wraps around it), but keeps "Show more" inline
// at the end of the single truncated line in the collapsed state - two
// different placements, both driven by the same `expanded` prop here.
const ToggleButton = styled.button`
  ${(props) => props.theme.typography.disclaimer};
  ${(props) => props.theme.typography.disclaimerLink};
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ac-widget-disclaimer-link-color, ${(props) => props.theme.palette.charcoal});
  font-family: inherit;
  font-size: 9px;
  font-style: normal;
  letter-spacing: normal;
  text-decoration-style: solid;
  white-space: nowrap;
  width: auto !important;

  &:hover {
    background: none !important;
    border-color: transparent !important;
    color: var(--ac-widget-disclaimer-link-color, ${(props) => props.theme.palette.charcoal}) !important;
    text-decoration: underline !important;
  }

  ${(props) => (props.expanded ? `
    align-self: flex-end;
    margin-top: 8px;
  ` : `
    margin-top: 2px;
  `)}
`;

const Chevron = styled.svg`
  flex-shrink: 0;
  width: 8px;
  height: 6px;
  /* Set directly here (rather than relying on the path's fill="currentColor"
     to inherit color from the button) so it can't silently end up
     transparent/unset depending on how the ancestor chain resolves color. */
  fill: var(--ac-widget-disclaimer-link-color, ${(props) => props.theme.palette.charcoal});
`;

// Inlined directly as JSX (mirrors src/assets/images/icon-disclaimer.svg,
// the shared source-of-truth asset file) rather than imported from that
// file, since this project's @svgr/webpack loader version is incompatible
// with its webpack/loader-utils version (fails with "this.getOptions is not
// a function" on any `{ReactComponent}` SVG import) and a plain
// `<img src={...}>` file-loader reference breaks whenever the widget is
// served from a different path than the build's PUBLIC_URL/homepage
// assumes. Inline JSX has no loader dependency and no runtime request, so
// neither failure mode applies.
function ShieldIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM19 11C19 12.85 18.49 14.65 17.62 16.21L16.17 14.76C17.46 12.82 17.24 10.18 15.53 8.47C13.58 6.52 10.41 6.52 8.46 8.47C6.51 10.42 6.51 13.59 8.46 15.54C10.17 17.25 12.81 17.46 14.75 16.18L16.47 17.9C15.28 19.32 13.74 20.41 12 20.94C7.98 19.69 5 15.52 5 11V6.3L12 3.19L19 6.3V11ZM12 15C10.34 15 9 13.66 9 12C9 10.34 10.34 9 12 9C13.66 9 15 10.34 15 12C15 13.66 13.66 15 12 15Z" fill="#595959" />
    </svg>
  );
}

// Mirrors src/assets/images/expand-more-icon.svg / expand-less-icon.svg
// (the Figma-exported source-of-truth files) as inline JSX for the same
// reason as ShieldIcon above - no loader dependency, no runtime request.
function ExpandMoreIcon(props) {
  return (
    <svg width="5" height="4" viewBox="0 0 5 4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.5875 3.08789L2.5 1.17956L4.4125 3.08789L5 2.50039L2.5 0.000390768L0 2.50039L0.5875 3.08789Z" fill="#595959" />
    </svg>
  );
}

function ExpandLessIcon(props) {
  return (
    <svg width="5" height="4" viewBox="0 0 5 4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.4125 0L2.5 1.90833L0.5875 0L0 0.5875L2.5 3.0875L5 0.5875L4.4125 0Z" fill="#595959" />
    </svg>
  );
}

export default function Disclaimer({expanded, onToggleExpand, highlighted, privacyPolicyUrl, termsOfUseUrl, consumerHealthDataPrivacyStatementUrl, disclaimerMessage}) {
  const intl = useIntl();

  const privacyPolicyLabel = intl.formatMessage({
    id: "disclaimer.privacyPolicy",
    defaultMessage: "Privacy Policy",
  });
  const termsOfUseLabel = intl.formatMessage({
    id: "disclaimer.termsOfUse",
    defaultMessage: "Terms & Conditions",
  });

  const consumerHealthDataPrivacyStatementLabel = intl.formatMessage({
    id: "disclaimer.consumerHealthDataPrivacyStatement",
    defaultMessage: "Consumer Health Data Privacy Statement",
  });

  const text = intl.formatMessage(
    {
      id: "disclaimer.recordingNotice",
      // Text is entirely brand-config-driven (widget.disclaimer.disclaimerMessage
      // in the brand's env.*.json);
      // ICU message syntax only treats paired tags (<br></br>) as rich-text
      // nodes that invoke the `br` resolver below; self-closing <br/> is
      // parsed as a literal string and would render as visible text.
      defaultMessage:
         disclaimerMessage,
    },
    {
      // Always rendered with link styling (blue + underline) per spec, even
      // before a brand has a real URL configured - an <a> with no href is
      // inert (no navigation, not keyboard-focusable) but keeps the visual
      // match with Figma instead of silently degrading to plain text.
      consumerHealthDataPrivacyStatementLink: (
        <Link
          key="consumerHealthDataPrivacyStatement"
          href={consumerHealthDataPrivacyStatementUrl || undefined}
          target={consumerHealthDataPrivacyStatementUrl ? "_blank" : undefined}
          rel={consumerHealthDataPrivacyStatementUrl ? "noopener noreferrer" : undefined}
        >
          {consumerHealthDataPrivacyStatementLabel}
        </Link>
      ),
      privacyPolicyLink: (
        <Link
          key="privacy"
          href={privacyPolicyUrl || undefined}
          target={privacyPolicyUrl ? "_blank" : undefined}
          rel={privacyPolicyUrl ? "noopener noreferrer" : undefined}
        >
          {privacyPolicyLabel}
        </Link>
      ),
      termsOfUseLink: (
        <Link
          key="terms"
          href={termsOfUseUrl || undefined}
          target={termsOfUseUrl ? "_blank" : undefined}
          rel={termsOfUseUrl ? "noopener noreferrer" : undefined}
        >
          {termsOfUseLabel}
        </Link>
      ),
      // white-space: nowrap (collapsed Text below) stops wrapping but still
      // honors an explicit <br> as a forced break, which would push the rest
      // of the message onto a visible second line past the ellipsis. Only
      // render a real line break in the expanded view; collapse it to a
      // space otherwise so the single-line truncation stays intact.
      br: () => (expanded ? <br /> : " "),
    }
  );

  const toggleLabel = intl.formatMessage({
    id: expanded ? "disclaimer.showLess" : "disclaimer.showMore",
    defaultMessage: expanded ? "Show less" : "Show more",
  });

  return (
    <Container data-testid="customer-chat-disclaimer" highlighted={highlighted}>
      <IconWrapper>
        <ShieldIcon aria-hidden="true" />
      </IconWrapper>
      <Body>
        {expanded ? (
          <>
            <Text expanded>{text}</Text>
            <ToggleButton
              type="button"
              expanded
              onClick={onToggleExpand}
              aria-expanded={expanded}
              data-testid="customer-chat-disclaimer-toggle"
            >
              {toggleLabel}
              <ExpandLessIcon />
            </ToggleButton>
          </>
        ) : (
          <CollapsedRow>
            <Text>{text}</Text>
            <ToggleButton
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              data-testid="customer-chat-disclaimer-toggle"
            >
              {toggleLabel}
              <ExpandMoreIcon />
            </ToggleButton>
          </CollapsedRow>
        )}
      </Body>
    </Container>
  );
}

Disclaimer.propTypes = {
  expanded: PT.bool,
  onToggleExpand: PT.func.isRequired,
  highlighted: PT.bool,
  privacyPolicyUrl: PT.string,
  termsOfUseUrl: PT.string,
};

Disclaimer.defaultProps = {
  expanded: true,
  highlighted: false,
  privacyPolicyUrl: "",
  termsOfUseUrl: "",
};
