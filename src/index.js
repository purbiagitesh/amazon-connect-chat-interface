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
  return typeof window !== 'undefined' && window.__CHAT_CLIENT_INFO__ ? window.__CHAT_CLIENT_INFO__ : null;
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
      <BrowserRouter><App {...props} themeConfig={themeConfig} headerConfig={headerConfig} logoConfig={logoConfig} /></BrowserRouter>, document.getElementById(containerId) || document.getElementById("root"));
  };

  connect.ChatInterface.getCurrentTheme = () => {
    const clientInfo = getClientInfo();
    return Object.assign({}, defaultTheme, buildThemeConfig(clientInfo?.config || {}));
  };

  window.connect = connect;
}(window.connect || {}));


