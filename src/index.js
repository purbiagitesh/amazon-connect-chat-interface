import 'core-js';
import React from 'react';
import ReactDOM from 'react-dom';
import {BrowserRouter} from 'react-router-dom';
import App from './App';
import {config} from "./utils/log";
import {setupGuidesRenderer} from './utils/helper';

import defaultTheme from './theme/defaultTheme';
import packageJson from '../package.json';

function getClientInfo() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (window.__CHAT_CLIENT_INFO__) {
    return window.__CHAT_CLIENT_INFO__;
  }
  // The widget is typically rendered inside the vendor's iframe, which never
  // loads clientInfo.js itself - only the host page does. Fall back to the
  // parent window's copy (same pattern Chat.js uses for header colors).
  try {
    if (window.parent && window.parent !== window && window.parent.__CHAT_CLIENT_INFO__) {
      return window.parent.__CHAT_CLIENT_INFO__;
    }
  } catch (e) {
    // window.parent is cross-origin; client info isn't reachable
  }
  return null;
}

function resolveFontFaces(clientConfig) {
  const fontFaces = clientConfig.fontFaces;
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

function buildThemeConfig(clientConfig = {}) {
  const themeConfig = {};

  if (clientConfig.primaryColor || clientConfig.secondaryColor) {
    themeConfig.color = {};
    if (clientConfig.primaryColor) {
      themeConfig.color.primary = clientConfig.primaryColor;
    }
    if (clientConfig.secondaryColor) {
      themeConfig.color.secondary = clientConfig.secondaryColor;
    }
  }

  if (clientConfig.fontFamily) {
    themeConfig.globals = {
      ...defaultTheme.globals,
      bodyFontFamily: clientConfig.fontFamily,
    };

    themeConfig.fonts = Object.keys(defaultTheme.fonts).reduce((fonts, key) => {
      fonts[key] = clientConfig.fontFamily;
      return fonts;
    }, {});
  }

  return themeConfig;
}

function buildHeaderConfig(clientConfig = {}) {
  const headerConfig = {};
  if (clientConfig.title) {
    headerConfig.title = clientConfig.title;
  }
  if (clientConfig.subtitle) {
    headerConfig.subtitle = clientConfig.subtitle;
  }
  return headerConfig;
}

function buildLogoConfig(clientInfo) {
  if (clientInfo && clientInfo.assets && clientInfo.assets.logo) {
    return {
      sourceUrl: clientInfo.assets.logo,
      altText: `${clientInfo.client || 'Client'} logo`,
    };
  }
  return {};
}

(function(connect) {
  connect.LogManager && connect.LogManager.updateLoggerConfig(config);
  connect.ChatInterface = connect.ChatInterface || {};
  connect.ChatInterface.init = ({containerId, ...props}) => {
    const clientInfo = getClientInfo();
    const clientConfig = clientInfo?.config || {};
    const themeConfig = Object.assign({}, buildThemeConfig(clientConfig), props.themeConfig || {});
    const headerConfig = Object.assign({}, buildHeaderConfig(clientConfig), props.headerConfig || {});
    const logoConfig = Object.assign({}, buildLogoConfig(clientInfo), props.logoConfig || {});
    const fontFaces = resolveFontFaces(clientConfig);

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
    const clientInfo = getClientInfo();
    return Object.assign({}, defaultTheme, buildThemeConfig(clientInfo?.config || {}));
  };

  window.connect = connect;
}(window.connect || {}));


