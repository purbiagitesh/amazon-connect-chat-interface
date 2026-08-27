(function () {
  'use strict';
  var LAUNCHER_BASE_URL = (function () {
    var scriptUrl = null;
    if (document.currentScript && document.currentScript.src) {
      scriptUrl = document.currentScript.src;
    } else {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (/launcher\.js(\?|$)/.test(scripts[i].src)) {
          scriptUrl = scripts[i].src;
          break;
        }
      }
    }
    return scriptUrl ? scriptUrl.replace(/\/[^\/]*(\?.*)?$/, '/') : './';
  })();

  function absoluteUrl(relativeOrAbsolute) {
    return new URL(relativeOrAbsolute, LAUNCHER_BASE_URL).href;
  }

  var realOpenWidget = null;
  var realCloseWidget = null;
  var pendingOpenRequest = false;

  window.connect = window.connect || {};
  window.connect.ChatWidget = {
    ready: false,
    open: function () {
      if (realOpenWidget) {
        realOpenWidget();
      } else {
        pendingOpenRequest = true;
      }
    },
    close: function () {
      if (realCloseWidget) {
        realCloseWidget();
      }
    }
  };

  var CHAT_PANEL_ID = 'amazon-connect-chat-panel';

  var LAUNCHER_CSS = ''
    + '#amazon-connect-launcher-btn {'
    + '  all: initial;'
    + '  box-sizing: border-box !important;'
    + '  display: none !important;'
    + '  position: fixed !important;'
    + '  bottom: 24px !important;'
    + '  right: 24px !important;'
    + '  top: auto !important;'
    + '  left: auto !important;'
    + '  width: auto !important;'
    + '  height: 48px !important;'
    + '  max-height: 48px !important;'
    + '  margin: 0 !important;'
    + '  background-color: var(--launcher-color-default, #8B005D) !important;'
    + '  color: #ffffff !important;'
    + '  border: none !important;'
    + '  border-radius: 50px !important;'
    + '  padding: 8px 15px !important;'
    + '  font-size: 14px !important;'
    + '  font-weight: 600 !important;'
    + '  line-height: normal !important;'
    + '  cursor: pointer !important;'
    + '  align-items: center !important;'
    + '  gap: 10px !important;'
    + '  box-shadow: var(--launcher-shadow, 0 4px 16px rgba(139, 0, 93, 0.4)) !important;'
    + '  z-index: 9999 !important;'
    + '  font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif !important;'
    + '  transition: background-color 0.2s ease, transform 0.15s ease !important;'
    + '}'
    + '#amazon-connect-launcher-btn.ready { display: flex !important; }'
    + '#amazon-connect-launcher-btn:hover { background-color: var(--launcher-color-active, #a3006e) !important; transform: scale(1.04); }'
    + '#amazon-connect-launcher-btn:active { background-color: var(--launcher-color-active, #a3006e) !important; transform: scale(0.97); }'
    + '#amazon-connect-launcher-btn .btn-icon {'
    + '  box-sizing: border-box !important;'
    + '  display: flex !important;'
    + '  align-items: center !important;'
    + '  justify-content: center !important;'
    + '  background: rgba(255, 255, 255, 0.2) !important;'
    + '  border-radius: 50% !important;'
    + '  width: 28px !important;'
    + '  height: 28px !important;'
    + '  flex-shrink: 0 !important;'
    + '  margin: 0 !important;'
    + '  padding: 0 !important;'
    + '}'
    + '#amazon-connect-launcher-btn .btn-icon svg { width: 15px !important; height: 15px !important; }'
    + '#amazon-connect-launcher-btn .btn-icon svg .chat-icon-bg { fill: #ffffff; }'
    + '#amazon-connect-launcher-btn .btn-icon svg .chat-icon-fg { fill: var(--launcher-color-default, #8B005D); }'
    + '#amazon-connect-launcher-btn:hover .btn-icon svg .chat-icon-fg,'
    + '#amazon-connect-launcher-btn:active .btn-icon svg .chat-icon-fg { fill: var(--launcher-color-active, #a3006e); }'
    + '#amazon-connect-launcher-btn .btn-icon img { width: 15px !important; height: 15px !important; object-fit: contain; }'
    + '#amazon-connect-launcher-btn.widget-open { display: none !important; }'
    + '#' + CHAT_PANEL_ID + ' {'
    + '  box-sizing: border-box !important;'
    + '  display: none !important;'
    + '  position: fixed !important;'
    + '  bottom: 24px !important;'
    + '  right: 24px !important;'
    + '  top: auto !important;'
    + '  left: auto !important;'
    + '  margin: 0 !important;'
    + '  width: 330px !important;'
    + '  height: 660px !important;'
    + '  max-width: calc(100vw - 32px) !important;'
    + '  max-height: calc(100vh - 32px) !important;'
    + '  background: #ffffff !important;'
    + '  border-radius: 24px !important;'
    + '  overflow: hidden !important;'
    + '  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2) !important;'
    + '  z-index: 9998 !important;'
    + '}'
    + '#' + CHAT_PANEL_ID + '.open { display: block !important; }'
    + '#' + CHAT_PANEL_ID + ' .connect-customer-interface {'
    + '  width: 100% !important;'
    + '  height: 100% !important;'
    + '  margin: 0 !important;'
    + '  box-shadow: none !important;'
    + '}';

  var FALLBACK_ICON_SVG = ''
    + '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<path class="chat-icon-bg" d="M28 13.4826C28.0054 15.5762 27.5163 17.6414 26.5724 19.5102C25.4532 21.7495 23.7327 23.6329 21.6036 24.9496C19.4744 26.2663 17.0207 26.9643 14.5174 26.9652C12.4238 26.9707 10.3586 26.4816 8.48984 25.5377L1.25432 27.9495C0.510306 28.1975 -0.197519 27.4897 0.0504845 26.7457L2.46233 19.5102C1.51843 17.6414 1.0293 15.5762 1.03476 13.4826C1.03572 10.9793 1.73365 8.52557 3.05036 6.39643C4.36706 4.26729 6.25055 2.54678 8.48984 1.42761C10.3586 0.483724 12.4238 -0.00541329 14.5174 4.51875e-05H15.3104C18.6166 0.182444 21.7393 1.57792 24.0807 3.91929C26.4221 6.26066 27.8176 9.38338 28 12.6896V13.4826Z" />'
    + '<path class="chat-icon-fg" d="M13.625 5.5846C13.9316 4.75602 15.1036 4.75602 15.4102 5.5846L17.1504 10.2876C17.2468 10.5481 17.4522 10.7535 17.7127 10.8499L22.4157 12.5901C23.2443 12.8967 23.2443 14.0687 22.4157 14.3753L17.7127 16.1155C17.4522 16.2119 17.2468 16.4173 17.1504 16.6778L15.4102 21.3808C15.1036 22.2094 13.9316 22.2094 13.625 21.3808L11.8848 16.6778C11.7884 16.4173 11.583 16.2119 11.3225 16.1155L6.61949 14.3753C5.79091 14.0687 5.79092 12.8967 6.61949 12.5901L11.3225 10.8499C11.583 10.7535 11.7884 10.5481 11.8848 10.2876L13.625 5.5846Z" />'
    + '</svg>';

  function createLauncherDom() {
    var style = document.createElement('style');
    style.setAttribute('data-source', 'amazon-connect-chat-launcher');
    style.textContent = LAUNCHER_CSS;
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.id = 'amazon-connect-launcher-btn';
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = '<span class="btn-icon">' + FALLBACK_ICON_SVG + '</span>Chat now';
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = CHAT_PANEL_ID;
    document.body.appendChild(panel);

    return { btn: btn, panel: panel };
  }

  var UTAG_POLL_INTERVAL_MS = 100;
  var UTAG_TIMEOUT_MS = 10000;

  var ENV_MAP = {
    PROD: 'prod', PRODUCTION: 'prod',
    QA: 'qa', STAGE: 'qa', STAGING: 'qa',
    DEV: 'dev', DEVELOPMENT: 'dev',
    NOPROD: 'NOPROD'
  };
  var BRAND_ALIAS_MAP = {};

  function waitForUtagData(onReady, onTimeout) {
    var waited = 0;
    var timer = setInterval(function () {
      if (window.utag_data) {
        clearInterval(timer);
        onReady(window.utag_data);
        return;
      }
      waited += UTAG_POLL_INTERVAL_MS;
      if (waited >= UTAG_TIMEOUT_MS) {
        clearInterval(timer);
        onTimeout();
      }
    }, UTAG_POLL_INTERVAL_MS);
  }

  function resolveBrand(utagData) {
    var rawBrand = (utagData.brand || '').toLowerCase().trim();
    var brand = BRAND_ALIAS_MAP[rawBrand] || rawBrand;
    var rawEnv = (utagData.ELC_ENV || '').toUpperCase().trim();
    var env = ENV_MAP[rawEnv] || 'prod';
    return { brand: brand, env: env };
  }

  function buildContactAttributes(utagData) {
    utagData = utagData || {};
    return {
      brand: utagData.brand || '',
      // customerLoggedIn: utagData.customer_state === 'logged in' ? 'true' : 'false',
      customerLoggedIn: 'Yes',
      customerId: utagData.USER_ID || '',
      customerEmail: 'purbiagitesh@gmail.com',
      customerName: 'Gitesh',
      customerPhone: '8107281183',
      brandRegion: utagData.region_code || '',
      brandLocation: utagData.locale || '',
      languageCode: utagData.language_code || '',
      countryCode: utagData.country_code || '',
      channel: 'Chat'
    };
  }

  function hexToRgba(hex, alpha) {
    var match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!match) return null;
    var r = parseInt(match[1], 16), g = parseInt(match[2], 16), b = parseInt(match[3], 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function applyBrandColors(brandConfig) {
    var brandColors = brandConfig.colors || {};
    var launcherDefault = brandColors.primary500 || brandConfig.primaryColor;
    var launcherActive = brandColors.primary800 || launcherDefault;
    if (launcherDefault) {
      document.documentElement.style.setProperty('--launcher-color-default', launcherDefault);
      var shadow = hexToRgba(launcherDefault, 0.4);
      if (shadow) document.documentElement.style.setProperty('--launcher-shadow', '0 4px 16px ' + shadow);
    }
    if (launcherActive) {
      document.documentElement.style.setProperty('--launcher-color-active', launcherActive);
    }
  }

  function applyLauncherIcon(brandInfo, btn) {
    var brandConfig = (brandInfo && brandInfo.config) || {};
    var rawIconUrl = brandConfig.launcherIconUrl || (brandInfo.assets && brandInfo.assets.icon);
    var iconSlot = btn.querySelector('.btn-icon');
    if (!rawIconUrl || !iconSlot) return Promise.resolve();

    var iconUrl = absoluteUrl(rawIconUrl);

    if (!/\.svg(\?|$)/i.test(iconUrl)) {
      iconSlot.innerHTML = '';
      var img = document.createElement('img');
      img.src = iconUrl;
      img.alt = '';
      iconSlot.appendChild(img);
      return Promise.resolve();
    }

    return fetch(iconUrl, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('launcher icon fetch failed with status ' + res.status);
        return res.text();
      })
      .then(function (svgMarkup) {
        iconSlot.innerHTML = svgMarkup;
      })
      .catch(function (err) {
        console.warn('[chat-widget] failed to load launcher icon, keeping default.', err);
      });
  }

  function revealLauncher(btn) {
    btn.classList.add('ready');
  }

  function loadChatInterfaceScript() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = absoluteUrl('./amazon-connect-chat-interface.js');
      s.async = true;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error('failed to load amazon-connect-chat-interface.js'));
      };
      document.head.appendChild(s);
    });
  }

  function setupWidget(brandInfo, btn, panel) {
    if (brandInfo.config && Array.isArray(brandInfo.config.fontFaces)) {
      brandInfo.config.fontFaces = brandInfo.config.fontFaces.map(function (face) {
        return Object.assign({}, face, { url: absoluteUrl(face.url) });
      });
    }
    if (brandInfo.assets) {
      Object.keys(brandInfo.assets).forEach(function (key) {
        if (brandInfo.assets[key]) {
          brandInfo.assets[key] = absoluteUrl(brandInfo.assets[key]);
        }
      });
    }
    if (brandInfo.config && brandInfo.config.header && brandInfo.config.header.logoUrl) {
      brandInfo.config.header.logoUrl = absoluteUrl(brandInfo.config.header.logoUrl);
    }
    window.__CHAT_BRAND_INFO__ = brandInfo;
    var brandConfig = brandInfo.config || {};
    var brandColors = brandConfig.colors || {};

    applyBrandColors(brandConfig);

    window.connect.ChatInterface.init({
      containerId: CHAT_PANEL_ID,
      headerConfig: brandConfig.header,
      logoConfig: brandInfo.assets && brandInfo.assets.logo
        ? { sourceUrl: brandInfo.assets.logo, altText: (brandInfo.brand || 'Brand') + ' logo' }
        : undefined,
    });

    var hasActiveChat = false;

    function openPanel() {
      panel.classList.add('open');
      btn.classList.add('widget-open');
    }

    function closePanel() {
      panel.classList.remove('open');
      btn.classList.remove('widget-open');
    }

    function startChat() {
      var contactAttributes = buildContactAttributes(window.utag_data);
      window.connect.ChatInterface.initiateChat({
        name: contactAttributes.customerName,
        region: brandConfig.region,
        instanceId: brandConfig.instanceId,
        contactFlowId: brandConfig.contactFlowId,
        apiGatewayEndpoint: brandConfig.apiGatewayEndpoint,
        contactAttributes: JSON.stringify(contactAttributes),
        supportedMessagingContentTypes: 'text/plain,text/markdown,application/vnd.amazonaws.connect.message.interactive,application/vnd.amazonaws.connect.message.interactive.response',
      }, function onSuccess(chatSession) {
        hasActiveChat = true;
        chatSession.onChatClose(function () {
          hasActiveChat = false;
          closePanel();
        });
      }, function onFailure(error) {
        console.error('[chat-widget] Failed to start chat:', error);
        closePanel();
      });
    }

    btn.addEventListener('click', function () {
      if (panel.classList.contains('open')) {
        closePanel();
        return;
      }
      openPanel();
      if (!hasActiveChat) {
        startChat();
      }
    });

    function openWidget() {
      if (panel.classList.contains('open')) return;
      openPanel();
      if (!hasActiveChat) {
        startChat();
      }
    }

    realOpenWidget = openWidget;
    realCloseWidget = closePanel;
    if (pendingOpenRequest) {
      pendingOpenRequest = false;
      openWidget();
    }

    return applyLauncherIcon(brandInfo, btn).then(function () {
      revealLauncher(btn);
    });
  }

  function bootstrap() {
    var dom = createLauncherDom();

    var scriptLoaded = loadChatInterfaceScript();

    var brandInfoLoaded = new Promise(function (resolve, reject) {
      waitForUtagData(function (utagData) {
        var resolved = resolveBrand(utagData);
        if (!resolved.brand) {
          reject(new Error('utag_data.brand is missing/empty'));
          return;
        }
        var brandInfoUrl = absoluteUrl('./brand-assets/' + resolved.brand + '/' + resolved.env + '/brandInfo.json');
        fetch(brandInfoUrl, { cache: 'no-store' })
          .then(function (res) {
            if (!res.ok) throw new Error('brandInfo fetch failed with status ' + res.status);
            return res.json();
          })
          .then(resolve)
          .catch(reject);
      }, function () {
        reject(new Error('window.utag_data was not available after ' + UTAG_TIMEOUT_MS + 'ms'));
      });
    });

    Promise.all([scriptLoaded, brandInfoLoaded])
      .then(function (results) {
        var brandInfo = results[1];
        return setupWidget(brandInfo, dom.btn, dom.panel).then(function () {
          window.connect.ChatWidget.ready = true;
          document.dispatchEvent(new CustomEvent('elc:chatWidgetReady', {
            detail: {
              brand: brandInfo.brand,
              env: brandInfo.environment
            }
          }));
        });
      })
      .catch(function (err) {
        console.warn('[chat-widget] failed to initialize - launcher will remain hidden.', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
