import 'core-js';
import React from 'react';
import ReactDOM from 'react-dom';
import {BrowserRouter} from 'react-router-dom';
import App from './App';
import {config} from "./utils/log";
import {setupGuidesRenderer} from './utils/helper';

import defaultTheme from './theme/defaultTheme';
import buildComponentPalette from './theme/componentPalette';
import packageJson from '../package.json';

function getBrandInfo() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (window.__CHAT_BRAND_INFO__) {
    return window.__CHAT_BRAND_INFO__;
  }
  // The widget is typically rendered inside the vendor's iframe, which never
  // loads brandInfo.js itself - only the host page does. Fall back to the
  // parent window's copy (same pattern Chat.js uses for header colors).
  try {
    if (window.parent && window.parent !== window && window.parent.__CHAT_BRAND_INFO__) {
      return window.parent.__CHAT_BRAND_INFO__;
    }
  } catch (e) {
    // window.parent is cross-origin; brand info isn't reachable
  }
  return null;
}

function resolveFontFaces(brandConfig) {
  const fontFaces = brandConfig.fontFaces;
  if (!Array.isArray(fontFaces) || !fontFaces.length) {
    return [];
  }

  let baseHref = window.location.href;
  try {
    if (window.parent && window.parent !== window) {
      baseHref = window.parent.location.href;
    }
  } catch (e) {
    // window.parent is cross-origin; resolve font URLs against our own document instead
  }

  return fontFaces.map(face => ({...face, url: new URL(face.url, baseHref).href}));
}

function buildThemeConfig(brandConfig = {}) {
  const themeConfig = {};
  const colors = brandConfig.colors || {};

  // colors.primary500 already carries prepare-brand.js's own fallback chain
  // (colors.json -> widget.primaryColor -> hardcoded default), so reading
  // it here is safe even for brands that haven't set up colors.json yet.
  const primary = colors.primary500;
  const secondary = (colors.secondary && colors.secondary['500']) || brandConfig.secondaryColor;

  if (primary || secondary) {
    themeConfig.color = {};
    if (primary) {
      themeConfig.color.primary = primary;
    }
    if (secondary) {
      themeConfig.color.secondary = secondary;
    }
    // Full colors.json scale, plus the readable per-UI-area tokens built
    // from it - the single place every component's color should come from.
    themeConfig.colors = colors;
    themeConfig.componentPalette = buildComponentPalette(colors);
  }

  if (brandConfig.fontFamily) {
    themeConfig.globals = {
      ...defaultTheme.globals,
      bodyFontFamily: brandConfig.fontFamily,
    };

    themeConfig.fonts = Object.keys(defaultTheme.fonts).reduce((fonts, key) => {
      fonts[key] = brandConfig.fontFamily;
      return fonts;
    }, {});
  }

  return themeConfig;
}

function buildHeaderConfig(brandConfig = {}) {
  const headerConfig = {};
  if (brandConfig.title) {
    headerConfig.title = brandConfig.title;
  }
  if (brandConfig.subtitle) {
    headerConfig.subtitle = brandConfig.subtitle;
  }
  return headerConfig;
}

function buildLogoConfig(brandInfo) {
  if (brandInfo && brandInfo.assets && brandInfo.assets.logo) {
    return {
      sourceUrl: brandInfo.assets.logo,
      altText: `${brandInfo.brand || 'Brand'} logo`,
    };
  }
  return {};
}

(function(connect) {
  connect.LogManager && connect.LogManager.updateLoggerConfig(config);
  connect.ChatInterface = connect.ChatInterface || {};
  connect.ChatInterface.init = ({containerId, ...props}) => {
    const brandInfo = getBrandInfo();
    const brandConfig = brandInfo?.config || {};
    const themeConfig = Object.assign({}, buildThemeConfig(brandConfig), props.themeConfig || {});
    const headerConfig = Object.assign({}, buildHeaderConfig(brandConfig), props.headerConfig || {});
    const logoConfig = Object.assign({}, buildLogoConfig(brandInfo), props.logoConfig || {});
    const fontFaces = resolveFontFaces(brandConfig);

    if (props.widgetType) {
      config.csmConfig = {
        widgetType: props.widgetType
      };
    }
    config.features = {
      messageReceipts: {
        shouldSendMessageReceipts: true,
        throttleTime: 5000
      }
    };
    config.customUserAgentSuffix = `AmazonConnect-ChatInterface/${packageJson.version}`;
    connect.ChatSession.setGlobalConfig(config);

    // Guides in Chat
    setupGuidesRenderer(props);

    ReactDOM.render(
      <BrowserRouter><App {...props} themeConfig={themeConfig} headerConfig={headerConfig} logoConfig={logoConfig} fontFaces={fontFaces} /></BrowserRouter>, document.getElementById(containerId) || document.getElementById("root"));
  };

  connect.ChatInterface.getCurrentTheme = () => {
    const brandInfo = getBrandInfo();
    return Object.assign({}, defaultTheme, buildThemeConfig(brandInfo?.config || {}));
  };

  window.connect = connect;
}(window.connect || {}));

