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
  ${(props) => props.theme.typography.disclaimer};
  color: var(--ac-widget-disclaimer-text-color, ${(props) => props.theme.palette.mediumGray});

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
  color: var(--ac-widget-disclaimer-link-color, ${(props) => props.theme.palette.darkBlue});
  font-family: inherit;
  font-size: 9px;
  font-style: normal;
  letter-spacing: normal;
  text-decoration-style: solid;
  white-space: nowrap;

  ${(props) => (props.expanded ? `
    float: right;
    margin-left: 8px;
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
  fill: var(--ac-widget-disclaimer-link-color, ${(props) => props.theme.palette.darkBlue});
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
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path
        d="M10 0.833344L2.5 4.16668V9.16668C2.5 13.7917 5.7 18.1167 10 19.1667C14.3 18.1167 17.5 13.7917 17.5 9.16668V4.16668L10 0.833344ZM15.8333 9.16668C15.8333 10.7083 15.4083 12.2083 14.6833 13.5083L13.475 12.3C14.55 10.6833 14.3667 8.48334 12.9417 7.05834C11.3167 5.43334 8.675 5.43334 7.05 7.05834C5.425 8.68334 5.425 11.325 7.05 12.95C8.475 14.375 10.675 14.55 12.2917 13.4833L13.725 14.9167C12.7333 16.1 11.45 17.0083 10 17.45C6.65 16.4083 4.16667 12.9333 4.16667 9.16668V5.25001L10 2.65834L15.8333 5.25001V9.16668ZM10 12.5C8.61667 12.5 7.5 11.3833 7.5 10C7.5 8.61668 8.61667 7.50001 10 7.50001C11.3833 7.50001 12.5 8.61668 12.5 10C12.5 11.3833 11.3833 12.5 10 12.5Z"
        fill="#595959"
      />
    </svg>
  );
}

// Mirrors src/assets/images/expand-more-icon.svg / expand-less-icon.svg
// (the Figma-exported source-of-truth files) as inline JSX for the same
// reason as ShieldIcon above - no loader dependency, no runtime request.
function ExpandMoreIcon(props) {
  return (
    <Chevron viewBox="0 0 12 8" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M10.59 0L6 4.58L1.41 0L0 1.41L6 7.41L12 1.41L10.59 0Z" />
    </Chevron>
  );
}

function ExpandLessIcon(props) {
  return (
    <Chevron viewBox="0 0 12 8" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path d="M6 0L0 6L1.41 7.41L6 2.83L10.59 7.41L12 6L6 0Z" />
    </Chevron>
  );
}

export default function Disclaimer({expanded, onToggleExpand, highlighted, privacyPolicyUrl, termsOfUseUrl}) {
  const intl = useIntl();

  const privacyPolicyLabel = intl.formatMessage({
    id: "disclaimer.privacyPolicy",
    defaultMessage: "Privacy Policy",
  });
  const termsOfUseLabel = intl.formatMessage({
    id: "disclaimer.termsOfUse",
    defaultMessage: "Terms & Conditions",
  });

  const text = intl.formatMessage(
    {
      id: "disclaimer.recordingNotice",
      defaultMessage:
         // ICU message syntax only treats paired tags (<br></br>) as rich-text
         // nodes that invoke the `br` resolver below; self-closing <br/> is
         // parsed as a literal string and would render as visible text.
         "Virtual Assistant is AI-powered and can make mistakes. While I strive for accuracy, please confirm any relevant information. We and our service providers will record and retain a transcript of this chat to provide, support, and improve your experience. This service is not directed to, and should not be used by, individuals who are under the age of majority in their jurisdiction of residence. <br></br><br></br> By sending a message, you agree to our {termsOfUseLink} and consent to the collection, use, and other processing of your personal information for the purpose of responding to your inquiry, including generating personalised product recommendations using automated tools. To learn more about Estée Lauder's privacy practices and your privacy rights, please review our {privacyPolicyLink}.",
    },
    {
      // Always rendered with link styling (blue + underline) per spec, even
      // before a brand has a real URL configured - an <a> with no href is
      // inert (no navigation, not keyboard-focusable) but keeps the visual
      // match with Figma instead of silently degrading to plain text.
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
            <Text expanded>{text}</Text>
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
