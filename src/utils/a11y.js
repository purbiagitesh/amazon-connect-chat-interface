import {useContext} from "react";
import {IntlContext} from "react-intl";
import enMessages from "../localization/localization/en_US.json";

// Helpers for screen-reader-only text (alt text, aria-labels, live-region
// copy). The only place these strings are defined is the localization JSON
// files (src/localization/localization/*.json): callers pass the message key
// and the English text from en_US.json is the fallback when there is no
// IntlProvider or no translation for the current language.

function interpolate(message, values) {
  return Object.keys(values || {}).reduce(
    (text, key) => text.split(`{${key}}`).join(values[key]),
    message
  );
}

// Safe to call with a null intl (components rendered outside IntlProvider).
export function formatA11yMessage(intl, id, values) {
  const defaultMessage = enMessages[id] || id;
  return intl
    ? intl.formatMessage({id, defaultMessage}, values)
    : interpolate(defaultMessage, values);
}

export function useA11yText() {
  const intl = useContext(IntlContext);
  return (id, values) => formatA11yMessage(intl, id, values);
}
