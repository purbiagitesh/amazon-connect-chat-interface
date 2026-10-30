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

  // Tab-local (sessionStorage, NOT localStorage) record of whether THIS
  // tab's panel was open or minimized the last time it changed - survives a
  // same-tab reload/navigation, but starts empty for a genuinely new tab
  // (sessionStorage never carries over to a new tab the way localStorage
  // would). Read synchronously here, before any async bootstrap work, so
  // it's available on window.connect.ChatWidget immediately - panel
  // visibility itself is never decided by this script (see bootstrap()'s
  // auto-resume below), only exposed as data for the brand developer's own
  // script to act on, e.g. calling ChatWidget.open() on page load to
  // restore exactly what this tab had before the reload.
  var PANEL_VISIBILITY_SESSION_KEY = 'ac_panel_open_state_session';
  var panelVisibilitySession = null;
  try {
    panelVisibilitySession = sessionStorage.getItem(PANEL_VISIBILITY_SESSION_KEY);
  } catch (e) {
    // sessionStorage unavailable (private browsing, disabled) - treat the
    // same as a tab that never recorded any prior state (null).
  }
  var wasOpenBeforeReload = panelVisibilitySession === 'open';

  window.connect = window.connect || {};
  window.connect.ChatWidget = {
    ready: false,
    launcherElement: null,
    panelElement: null,
    // Whether a chat is currently active (started or resumed), regardless
    // of whether THIS tab's panel is open or minimized - the signal a
    // brand's own script can check on a new tab to decide whether to call
    // open() itself (see setHasActiveChat below for how this stays in sync).
    hasActiveChat: false,
    // Whether THIS tab's panel was open (not minimized) the last time it
    // changed, before this page load - only meaningful for a same-tab
    // reload/navigation; always false on a genuinely new tab.
    wasOpenBeforeReload: wasOpenBeforeReload,
    // Live current state of THIS tab's panel, kept in sync from here on by
    // openPanel()/closePanel() on every toggle (see notifyChatMinimizedState
    // below) - unlike wasOpenBeforeReload, this is for reading the CURRENT
    // state on demand, not just the pre-reload one. True only when
    // sessionStorage explicitly recorded this tab's panel as closed before
    // this reload - i.e. it was actually minimized, not just never opened.
    // A genuinely new tab (no sessionStorage record) is false: nothing has
    // minimized its panel, it simply hasn't been opened yet - a distinct
    // state from having been minimized, per product decision.
    isMinimized: panelVisibilitySession === 'closed',
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
    + '  z-index: 2147483647 !important;'
    + '  font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif !important;'
    + '  transition: background-color 0.2s ease, transform 0.15s ease !important;'
    + '}'
    + '#amazon-connect-launcher-btn.ready { display: flex !important; }'
    + '#amazon-connect-launcher-btn:hover { background-color: var(--launcher-color-hover, #a3006e) !important; transform: scale(1.04); }'
    + '#amazon-connect-launcher-btn:active { background-color: var(--launcher-color-active, #a3006e) !important; transform: scale(0.97); }'
    + '#amazon-connect-launcher-btn .btn-icon {'
    + '  box-sizing: border-box !important;'
    + '  display: flex !important;'
    + '  align-items: center !important;'
    + '  justify-content: center !important;'
    + '  background: transparent !important;'
    + '  border-radius: 50% !important;'
    + '  width: 28px !important;'
    + '  height: 28px !important;'
    + '  flex-shrink: 0 !important;'
    + '  margin: 0 !important;'
    + '  padding: 0 !important;'
    + '}'
    + '#amazon-connect-launcher-btn .btn-icon svg { width: 24px !important; height: 24px !important; }'
    + '#amazon-connect-launcher-btn .btn-icon svg .chat-icon-bg { fill: #ffffff; }'
    + '#amazon-connect-launcher-btn .btn-icon svg .chat-icon-fg { fill: var(--launcher-color-default, #8B005D); }'
    + '#amazon-connect-launcher-btn:hover .btn-icon svg .chat-icon-fg,'
    + '#amazon-connect-launcher-btn:active .btn-icon svg .chat-icon-fg { fill: var(--launcher-color-active, #a3006e); }'
    + '#amazon-connect-launcher-btn .btn-icon img { width: 24px !important; height: 24px !important; object-fit: contain; }'
    + '#amazon-connect-launcher-btn .btn-text { display: inline-block; }'
    + '#amazon-connect-launcher-btn.chat-active .btn-text { display: none !important; }'
    + '#amazon-connect-launcher-btn.widget-open { display: none !important; }'
    + '#amazon-connect-launcher-btn .notification-badge {'
    + '  box-sizing: border-box !important;'
    + '  display: none !important;'
    + '  position: absolute !important;'
    + '  top: -8px !important;'
    + '  right: -8px !important;'
    + '  left: auto !important;'
    + '  min-width: 24px !important;'
    + '  height: 24px !important;'
    + '  padding: 0 6px !important;'
    + '  border-radius: 12px !important;'
    + '  background: var(--launcher-badge-color, #ff1420) !important;'
    + '  color: #ffffff !important;'
    + '  font-size: 13px !important;'
    + '  font-weight: 700 !important;'
    + '  font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif !important;'
    + '  text-align: center !important;'
    + '  border: none !important;'
    + '  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;'
    + '  pointer-events: none !important;'
    + '}'
    + '#amazon-connect-launcher-btn .notification-badge.visible {'
    + '  display: flex !important;'
    + '  align-items: center !important;'
    + '  justify-content: center !important;'
    + '}'
    + '#amazon-connect-launcher-btn .notification-badge.blink { animation: ac-notification-blink 0.35s ease-in-out 2 !important; }'
    + '@keyframes ac-notification-blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }'
    + '@media (max-width: 1024px) {'
    + '  #amazon-connect-launcher-btn.chat-active {'
    + '    top: 50% !important;'
    + '    bottom: auto !important;'
    + '    transform: translateY(-50%) !important;'
    + '  }'
    + '  #amazon-connect-launcher-btn.chat-active:hover { transform: translateY(-50%) scale(1.04) !important; }'
    + '  #amazon-connect-launcher-btn.chat-active:active { transform: translateY(-50%) scale(0.97) !important; }'
    + '}'
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
    + '  z-index: 2147483646 !important;'
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
    btn.innerHTML = '<span class="btn-icon">' + FALLBACK_ICON_SVG + '</span><span class="btn-text"></span><span class="notification-badge" aria-hidden="true"></span>';
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = CHAT_PANEL_ID;
    document.body.appendChild(panel);

    shieldFromHostFocusTraps([btn, panel]);

    return { btn: btn, panel: panel };
  }

  // Host-site modals (e.g. Colorbox's trapFocus on the brand signup popup) use
  // document-level capture listeners to pull focus back into the modal.
  // Window capture runs first, so swallowing widget-bound events here hides
  // them from the host trap.
  function shieldFromHostFocusTraps(widgetRoots) {
    function isInsideWidget(target) {
      return widgetRoots.some(function (root) { return root.contains(target); });
    }
    function shield(e) {
      if (e.type === 'keydown' && e.key !== 'Tab') {
        return;
      }
      if (!isInsideWidget(e.target)) {
        return;
      }
      e.stopImmediatePropagation();
      // Stopping native focus also hides it from React 16's onFocus; re-announce it.
      if (e.type === 'focus') {
        e.target.dispatchEvent(new CustomEvent('ac-widget-focus'));
      }
    }
    ['focus', 'focusin'].forEach(function (type) {
      window.addEventListener(type, shield, { capture: true, passive: true });
    });
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
  var utagDataStore = null;

  function waitForUtagData(onReady, onTimeout) {
    var waited = 0;
    var timer = setInterval(function () {
      if (
        window.utag_data &&
        typeof window.utag_data.brand === 'string' &&
        window.utag_data.brand.trim()
      ) {
        clearInterval(timer);
        utagDataStore = window.utag_data;
        onReady(window.utag_data);
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

  async function getCustomerContext() {
    // The brand site exposes this to hand us the signed-in customer's details.
    // It may be missing entirely (unsupported market) or reject (failed request);
    // a guest returns { authenticated: false }. Any of those => treat as guest.
    try {
      if (window.ElcAmazonConnect && typeof window.ElcAmazonConnect.getCustomerContext === 'function') {
        return (await window.ElcAmazonConnect.getCustomerContext()) || {};
      }
    } catch (err) {
      console.error('[chat-widget] getCustomerContext() failed:', err);
    }
    return {};
  }

  async function buildContactAttributes(brandInfo, utagData) {
    utagData = utagData || {};

    var customerContext = await getCustomerContext();
    var isAuthenticated = customerContext.authenticated === true;

    var firstName = isAuthenticated && typeof customerContext.firstName === 'string' ? customerContext.firstName : '';
    var lastName = isAuthenticated && typeof customerContext.lastName === 'string' ? customerContext.lastName : '';
    var email = isAuthenticated && typeof customerContext.email === 'string' && customerContext.email
      ? customerContext.email
      : '';
    var customerLoggedIn = isAuthenticated ? 'Yes' : 'No';
    var customerName = firstName;

    var attributes = {
      brand_code: brandInfo.config.title || '',
      customerLoggedIn: customerLoggedIn,
      customerId: String(utagData.USER_ID),
      email: email,
      customerName: customerName,
      region_code:utagData.region_code || 'NA',
      language_code: utagData.locale || 'en-US',
      country_code: utagData.country_code || 'us',
      channel: 'Chat',
      isShopify: brandInfo.config.isShopify
    };
    return attributes;
  }

  // ─── Chat persistence across full page navigations ───
  // This is a traditional multi-page site, not an SPA - every navigation is
  // a full reload that destroys the in-memory ChatSession/websocket. To
  // resume an in-progress chat on whatever page loads next - same tab OR a
  // new tab, both are possible here, so sessionStorage (tab-scoped) isn't
  // enough - the raw StartChatContact credentials are persisted to
  // localStorage (origin-scoped, shared across tabs) right after a
  // successful chat start, and fed back into ChatInterface.resumeChat() to
  // reconnect that SAME still-active contact (never a new one) on whichever
  // page/tab loads next. Transcript restoration needs no new code here -
  // ChatSession.js's existing onConnectionEstablished handler already
  // reloads it on any successful connect, new or reconnected.
  var CHAT_PERSIST_STALE_AFTER_MS = 300 * 60 * 1000; // 5 hours - UX judgment call, not a token-expiry limit; adjust freely

  function chatStorageKey() {
    return 'ac_active_chat';
  }

  function persistActiveChat(brand, env, chatDetails, customerName, language) {
    try {
      localStorage.setItem(chatStorageKey(), JSON.stringify({
        chatDetails: chatDetails,
        name: customerName,
        brand: brand,
        env: env,
        startedAt: Date.now(),
        language: language
      }));
    } catch (e) {
      // localStorage unavailable (private browsing, quota, disabled) -
      // persistence is a nice-to-have on top of a working widget, never let
      // it break chat start itself.
      console.warn('[chat-widget] unable to persist chat session', e);
    }
  }

  function clearPersistedChat(brand) {
    try {
      localStorage.removeItem(chatStorageKey());
    } catch (e) {
      // ignore
    }
  }

  // Returns the persisted session for `brand`, or null if there isn't one
  // or it's past CHAT_PERSIST_STALE_AFTER_MS (in which case it's cleared
  // here too, so a stale entry doesn't linger and get rechecked forever).
  function getResumableSession(brand) {
    var raw;
    try {
      raw = localStorage.getItem(chatStorageKey());
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    var persisted;
    try {
      persisted = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (!persisted || !persisted.chatDetails || !persisted.startedAt) return null;
    if (Date.now() - persisted.startedAt > CHAT_PERSIST_STALE_AFTER_MS) {
      clearPersistedChat(brand);
      return null;
    }
    return persisted;
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
    var launcherHover = brandColors.primary900 || launcherDefault;
    if (launcherDefault) {
      document.documentElement.style.setProperty('--launcher-color-default', launcherDefault);
      var shadow = hexToRgba(launcherDefault, 0.4);
      if (shadow) document.documentElement.style.setProperty('--launcher-shadow', '0 4px 16px ' + shadow);
    }
    if (launcherActive) {
      document.documentElement.style.setProperty('--launcher-color-active', launcherActive);
    }
    if (launcherHover) {
      document.documentElement.style.setProperty('--launcher-color-hover', launcherHover);
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

  function getLauncherText(utagData) {
    var locale = (utagData && utagData.locale) || 'en_US';
    var chatInterface = window.connect && window.connect.ChatInterface;
    var text = chatInterface && typeof chatInterface.getLocalizedString === 'function'
      ? chatInterface.getLocalizedString('Chat.LauncherButtonText', locale)
      : null;
    return text || 'Chat now';
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

    // Update launcher button text based on locale
    var launcherText = getLauncherText(utagDataStore);
    var btnTextSpan = btn.querySelector('.btn-text');
    if (btnTextSpan) {
      btnTextSpan.textContent = launcherText;
    }

    window.connect.ChatInterface.init({
      containerId: CHAT_PANEL_ID,
      headerConfig: brandConfig.header,
      logoConfig: brandInfo.assets && brandInfo.assets.logo
        ? { sourceUrl: brandInfo.assets.logo, altText: (brandInfo.brand || 'Brand') + ' logo' }
        : undefined,
        forceAttachmentStepActive: false,
    });

    var hasActiveChat = false;
    var resolvedBrand = brandInfo.brand;
    var resolvedEnv = brandInfo.environment;

    // ─── New-message notifications while minimized ───
    // "Minimized" here means the user hit the cross button but the chat is
    // still active (hasActiveChat) - the panel is closed, not the session.
    // Each incoming message then bumps an unread badge on the launcher,
    // blinks it twice and plays a chime. The badge stays until the panel is
    // opened and the messages are seen.
    var notificationBadge = btn.querySelector('.notification-badge');
    var unreadCount = 0;
    var notificationAudioCtx = null;

    // Served alongside launcher.js itself (not from src/assets/ - that tree
    // only feeds the webpack-bundled React app; this plain script has no
    // bundler and resolves everything relative to its own <script src>, same
    // as amazon-connect-chat-interface.js/brand-assets elsewhere in this file).
    var NOTIFICATION_SOUND_URL = absoluteUrl('./notification-chime.mp3');
    var notificationSoundBufferPromise = null;

    function ensureAudioContext() {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!notificationAudioCtx) notificationAudioCtx = new AudioCtx();
        // Browsers start the context suspended until a user gesture; the
        // launcher click that starts/opens the chat unlocks it (see below).
        if (notificationAudioCtx.state === 'suspended') notificationAudioCtx.resume();
      } catch (e) {
        notificationAudioCtx = null;
      }
      return notificationAudioCtx;
    }

    // Fetching + decoding an MP3 takes real time (network + CPU) - doing
    // that on-demand inside playNotificationChime() would mean the very
    // first chime of the session lags noticeably behind the message that
    // triggered it. Decoding doesn't need an unlocked/running context (only
    // actually starting playback does), so this is kicked off once, eagerly,
    // as soon as a context exists (see the call right after setupWidget's
    // click listener below) - by the time a real notification needs to play,
    // the buffer is almost always already sitting decoded in memory, so
    // playback below is effectively instant. Cached as a promise so every
    // caller (there's only ever one chime sound) shares the same in-flight
    // fetch instead of re-requesting it.
    function loadNotificationSoundBuffer(ctx) {
      if (!ctx) return Promise.resolve(null);
      if (!notificationSoundBufferPromise) {
        notificationSoundBufferPromise = fetch(NOTIFICATION_SOUND_URL)
          .then(function (res) {
            if (!res.ok) throw new Error('notification sound fetch failed with status ' + res.status);
            return res.arrayBuffer();
          })
          .then(function (arrayBuffer) {
            return ctx.decodeAudioData(arrayBuffer);
          })
          .catch(function (err) {
            console.warn('[chat-widget] failed to load notification sound', err);
            notificationSoundBufferPromise = null; // allow a retry on the next chime attempt
            return null;
          });
      }
      return notificationSoundBufferPromise;
    }

    // Cross-tab dedupe: every open tab holds its OWN independent websocket
    // connection to the same Connect contact, so one agent message makes
    // EVERY tab's notifyNewMessageWhileMinimized() fire at roughly the same
    // instant - without this, all of them would play the chime at once.
    //
    // A plain "read lastPlayedAt, then write it" check isn't quite enough:
    // if two tabs' messages land in the same tick, both can read the OLD
    // (stale) value before either one's write becomes visible to the
    // other, so both still decide to play. Fixed with a claim-and-recheck
    // step instead: each tab writes its OWN uniquely-identifiable claim,
    // waits a short grace period (CHIME_CLAIM_GRACE_MS), then only plays if
    // ITS claim is still the one on record. localStorage.setItem is
    // last-write-wins, so whichever tab wrote last is the only one that
    // still finds its own id after the grace period - every earlier racer
    // sees a mismatch and backs off. This resolves deterministically
    // regardless of how close the race is, as long as every racing tab's
    // write happens within the grace window of each other, which 75ms
    // comfortably covers for tabs on the same machine/network.
    var CHIME_DEDUPE_STORAGE_KEY = 'ac_last_chime_at';
    var CHIME_CLAIM_STORAGE_KEY = 'ac_chime_claim';
    var CHIME_DEDUPE_WINDOW_MS = 1500;
    var CHIME_CLAIM_GRACE_MS = 75;

    function playChimeBuffer(ctx, buffer) {
      if (!buffer) return;
      try {
        var source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch (e) {
        // Audio is best-effort - never let it break message handling.
      }
    }

    function playNotificationChime() {
      var ctx = ensureAudioContext();
      if (!ctx) return;
      var now = Date.now();
      var myClaimId = now + '-' + Math.random().toString(36).slice(2);
      try {
        var lastPlayedAt = Number(localStorage.getItem(CHIME_DEDUPE_STORAGE_KEY)) || 0;
        if (now - lastPlayedAt < CHIME_DEDUPE_WINDOW_MS) {
          return; // a chime for this same burst of messages already played (or is about to)
        }
        localStorage.setItem(CHIME_CLAIM_STORAGE_KEY, myClaimId);
      } catch (e) {
        // localStorage unavailable - no way to coordinate across tabs;
        // just play rather than silencing the sound entirely.
        loadNotificationSoundBuffer(ctx).then(function (buffer) { playChimeBuffer(ctx, buffer); });
        return;
      }
      setTimeout(function () {
        var wonClaim;
        try {
          wonClaim = localStorage.getItem(CHIME_CLAIM_STORAGE_KEY) === myClaimId;
          if (wonClaim) localStorage.setItem(CHIME_DEDUPE_STORAGE_KEY, String(Date.now()));
        } catch (e) {
          wonClaim = true;
        }
        if (!wonClaim) return;
        loadNotificationSoundBuffer(ctx).then(function (buffer) { playChimeBuffer(ctx, buffer); });
      }, CHIME_CLAIM_GRACE_MS);
    }

    // Kick the fetch+decode off now, well before the first real
    // notification is likely to fire, rather than waiting for
    // playNotificationChime()'s first call to discover it isn't ready yet.
    loadNotificationSoundBuffer(ensureAudioContext());
 
    function renderUnreadBadge() {
      if (!notificationBadge) return;
      if (unreadCount > 0) {
        notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        notificationBadge.classList.add('visible');
        btn.setAttribute('aria-label', 'Open chat, ' + unreadCount + ' unread message' + (unreadCount === 1 ? '' : 's'));
      } else {
        notificationBadge.classList.remove('visible');
        notificationBadge.textContent = '';
        btn.setAttribute('aria-label', 'Open chat');
      }
    }
 
    function blinkUnreadBadge() {
      if (!notificationBadge) return;
      notificationBadge.classList.remove('blink');
      // Force reflow so the animation restarts on every subsequent message.
      void notificationBadge.offsetWidth;
      notificationBadge.classList.add('blink');
    }
 
    function clearUnread() {
      if (unreadCount === 0) return;
      unreadCount = 0;
      renderUnreadBadge();
    }
 
    function notifyNewMessageWhileMinimized() {
      // An open panel means the user is already looking at the conversation.
      if (panel.classList.contains('open')) return;
      unreadCount += 1;
      renderUnreadBadge();
      blinkUnreadBadge();
      playNotificationChime();
    }

    // Keep the flag and the launcher's text visibility in sync: an active
    // chat hides the "Chat now" label, leaving just the icon. Also mirrored
    // onto the public API (see window.connect.ChatWidget.hasActiveChat
    // above) so a brand's own script - e.g. on a brand-new tab - can check
    // whether there's an active chat to restore, without this script ever
    // deciding on its own to open/resume anything visually.
    // The piece that actually applies a new hasActiveChat value to THIS
    // tab's own state/UI/public-API/notifications. Split out from
    // setHasActiveChat() below so the cross-tab listener further down can
    // reuse it WITHOUT re-broadcasting what it just received - calling
    // setHasActiveChat() from that listener would re-write
    // ACTIVE_CHAT_STATE_STORAGE_KEY on every receipt, which every other
    // tab (including the original sender) would then receive again,
    // forever.
    // `options.silent` exists for exactly one caller: bootstrap's
    // auto-resume on page load (see "Deliberately never calls openPanel()"
    // below). On a fresh page load, the local hasActiveChat variable always
    // restarts false, then flips true the instant a resumable session is
    // found - that flip LOOKS like a real "became active" transition in
    // this execution context, but it isn't one: the chat was already
    // active before this reload too, so notifying/broadcasting it would
    // fire elc:chatActiveChanged/onChatActiveChanged on every single
    // refresh of an already-active chat, with no real state change behind
    // it - exactly the false-positive brand devs reported. Every other
    // caller leaves this unset, since for them the local variable's old
    // value genuinely does reflect the last known state.
    function applyActiveChatState(active, options) {
      var silent = !!(options && options.silent);
      var changed = active !== hasActiveChat;
      hasActiveChat = active;
      btn.classList.toggle('chat-active', active);
      window.connect.ChatWidget.hasActiveChat = active;
      if (changed && !silent) {
        notifyActiveChatState(active);
      }
      return changed;
    }

    function setHasActiveChat(active, options) {
      var changed = applyActiveChatState(active, options);
      // Only ever broadcast a REAL change - a same-value call (e.g.
      // resumeChat()'s onSuccess setting true right after bootstrap's
      // silent pre-set already did) is a no-op here too, not just locally.
      if (changed && !(options && options.silent)) {
        broadcastActiveChatState(active);
      }
    }

    // Per the brand dev's own integration request: since the widget is the
    // source of truth for hasActiveChat, notify ELC's own site code every
    // time it changes - true on a brand-new chat AND on a resume, false
    // whenever the customer ends the chat (see wireChatEndCleanup's
    // onChatClose) - and do so in EVERY open tab for this site, not just
    // the one where the change happened (see ACTIVE_CHAT_STATE_STORAGE_KEY
    // below). Two notification styles, mirroring notifyChatMinimizedState()
    // below, since different integration code may want one or the other:
    //   - a custom DOM event, listened for via document.addEventListener
    //   - a named hook function, if the brand site has defined one
    function notifyActiveChatState(isActive) {
      try {
        document.dispatchEvent(new CustomEvent('elc:chatActiveChanged', {detail: {active: isActive}}));
      } catch (e) {
        // CustomEvent unsupported/blocked - never let this break open/close.
      }
      try {
        if (window.ElcAmazonConnect && typeof window.ElcAmazonConnect.onChatActiveChanged === 'function') {
          window.ElcAmazonConnect.onChatActiveChanged(isActive);
        }
      } catch (e) {
        // The brand's own hook threw - never let that break open/close either.
      }
    }

    // Cross-tab delivery for hasActiveChat itself (both true AND false),
    // separate from - and in addition to - the first-conversation-only
    // cross-tab OPEN further below. That mechanism only ever fires on a
    // brand-new chat starting, and only tells other tabs to visually join
    // when they're idle; it never fires on chat END, so it can't be reused
    // here. This one's only job is making sure every open tab's own
    // hasActiveChat flag (and therefore its elc:chatActiveChanged event /
    // onChatActiveChanged hook) stays correct and gets notified, regardless
    // of whether that tab also does anything visually about it.
    var ACTIVE_CHAT_STATE_STORAGE_KEY = 'ac_active_chat_state';

    function broadcastActiveChatState(active) {
      try {
        localStorage.setItem(ACTIVE_CHAT_STATE_STORAGE_KEY, (active ? 'true' : 'false') + ':' + Date.now());
      } catch (e) {
        // localStorage unavailable - other tabs just won't hear about this
        // change; never let that affect applying it in this tab.
      }
    }

    // The browser only fires "storage" in tabs OTHER than the one that
    // wrote it, so this can't loop back on its own sender. Calls
    // applyActiveChatState() directly (never setHasActiveChat()) so
    // receiving a broadcast never re-broadcasts it.
    window.addEventListener('storage', function (e) {
      if (e.key !== ACTIVE_CHAT_STATE_STORAGE_KEY || !e.newValue) return;
      // applyActiveChatState() itself now no-ops when the value hasn't
      // actually changed, so no need to check that here too.
      applyActiveChatState(e.newValue.indexOf('true') === 0);
    });

    // Tab-local record for a same-tab reload/navigation - see
    // PANEL_VISIBILITY_SESSION_KEY/wasOpenBeforeReload above. sessionStorage,
    // tab-local, purely informational for whatever reads
    // window.connect.ChatWidget.wasOpenBeforeReload on the next load - NOT
    // a cross-tab mechanism (see the removed general open/close sync below).
    function persistPanelVisibilityForReload(isOpen) {
      try {
        sessionStorage.setItem(PANEL_VISIBILITY_SESSION_KEY, isOpen ? 'open' : 'closed');
      } catch (e) {
        // sessionStorage unavailable - nothing to restore on a future
        // reload; never let this affect opening/closing the panel now.
      }
      window.connect.ChatWidget.wasOpenBeforeReload = isOpen;
    }

    // Per the brand dev's own integration request: notify ELC's own site
    // code whenever THIS tab's panel is minimized or expanded (e.g. so a
    // checkout page can hide the launcher while minimized). This is
    // deliberately tab-local, not a cross-tab broadcast like
    // notifyActiveChatState() can be - the storage event brand devs already
    // tried for this doesn't fire in the tab that made the write, only in
    // OTHER tabs, so it can't be used to detect a minimize/expand in the
    // same tab it happened in. Calling this directly from openPanel()/
    // closePanel() covers every way the panel can toggle - the launcher
    // button, startChat()/resumeChat()/startOrResumeChat(), and the public
    // window.connect.ChatWidget.open()/close() API - since all of them
    // call openPanel()/closePanel() themselves.
    function notifyChatMinimizedState(isMinimized) {
      window.connect.ChatWidget.isMinimized = isMinimized;
      try {
        document.dispatchEvent(new CustomEvent('elc:chatMinimizedChanged', {detail: {minimized: isMinimized}}));
      } catch (e) {
        // CustomEvent unsupported/blocked - never let this break open/close.
      }
      try {
        if (window.ElcAmazonConnect && typeof window.ElcAmazonConnect.onChatMinimized === 'function') {
          window.ElcAmazonConnect.onChatMinimized(isMinimized);
        }
      } catch (e) {
        // The brand's own hook threw - never let that break open/close either.
      }
    }

    function openPanel() {
      panel.classList.add('open');
      btn.classList.add('widget-open');
      // The user is now viewing the conversation - drop any unread badge.
      clearUnread();
      persistPanelVisibilityForReload(true);
      notifyChatMinimizedState(false);
    }

    function closePanel() {
      panel.classList.remove('open');
      btn.classList.remove('widget-open');
      persistPanelVisibilityForReload(false);
      notifyChatMinimizedState(true);
    }

    // ─── First-conversation-only cross-tab open ───
    // The general "mirror every open/close toggle across tabs" sync has
    // been removed per product decision - toggling the panel in one tab no
    // longer affects any other tab, ever. The ONE exception that stays: the
    // very first time a BRAND NEW conversation is started (never a resume,
    // never a later open/close), every other currently-open tab should join
    // it too, since they'd otherwise have no way to know a conversation
    // just began. This fires exactly once per new conversation - see
    // broadcastNewChatStarted(), called only from startChat()'s onSuccess,
    // never from resumeChat()'s.
    var NEW_CHAT_STARTED_STORAGE_KEY = 'ac_new_chat_started';

    function broadcastNewChatStarted() {
      try {
        localStorage.setItem(NEW_CHAT_STARTED_STORAGE_KEY, String(Date.now()));
      } catch (e) {
        // localStorage unavailable - other tabs just won't auto-join this
        // new conversation; never let this affect starting it in this tab.
      }
    }

    // The browser only fires "storage" in tabs OTHER than the one that made
    // the write, so this never re-triggers itself. Guarded on !hasActiveChat
    // and the panel not already being open so it never disrupts a tab that's
    // independently already showing something of its own. When this does
    // resume into an open panel, resumeChat()'s onSuccess calls
    // setHasActiveChat(true), which notifies ELC's own code (see
    // notifyActiveChatState above) in THIS tab too - no separate call
    // needed here.
    window.addEventListener('storage', function (e) {
      if (e.key !== NEW_CHAT_STARTED_STORAGE_KEY) return;
      if (hasActiveChat || panel.classList.contains('open')) return;
      var resumable = getResumableSession(resolvedBrand);
      if (resumable) {
        openPanel();
        resumeChat(resumable);
      }
    });

    // Shared by both startChat() and resumeChat() below - a chat ending
    // for ANY reason (customer clicks the in-panel end-chat button, or
    // Connect/the agent ends it server-side) must stop this widget from
    // trying to resume it on the next page/tab.
    function wireChatEndCleanup(chatSession) {

      // Every incoming message (bot/agent/system) notifies the launcher
      // while minimized - notifyNewMessageWhileMinimized() itself no-ops
      // when the panel is already open, so it's safe to wire here for both
      // newly-started and resumed sessions.
      chatSession.onIncoming(function () {
        notifyNewMessageWhileMinimized();
      });

      // Only ever fires from the customer's OWN "End chat" button
      // (ChatSession.js's endChat() is the only thing that triggers both
      // "chat-closed" and "chat-disconnected" together) - closePanel()/
      // setHasActiveChat(false) here are deliberately scoped to that
      // explicit customer action only.
      chatSession.onChatClose(function () {
        setHasActiveChat(false);
        clearPersistedChat(resolvedBrand);
        closePanel();
      });
      // Fires for EVERY way a chat can end, including a server/agent-
      // initiated one (ChatSession.js's _handleEndedEvent, reached via
      // ChatJS's onEnded) - which deliberately never also triggers
      // "chat-closed", precisely so the onChatClose handler above is never
      // reached for it.
      //
      // Per the product requirement: the panel must stay exactly as it was
      // (open showing the now-ended conversation, or still minimized), AND
      // the launcher icon/button must NOT revert to its default look
      // either - both must stay frozen as they were until the customer
      // actually refreshes the page. That means setHasActiveChat(false) is
      // deliberately NOT called here (unlike onChatClose above): flipping
      // it would both strip the "chat-active" icon styling immediately AND
      // make a click on the minimized button start a BRAND NEW chat
      // (startOrResumeChat()'s `if (hasActiveChat)` check) instead of just
      // revealing the now-ended conversation, which is exactly the
      // behavior the requirement asks for when the customer clicks it.
      //
      // clearPersistedChat() still runs though - that's a separate
      // concern, purely about what the NEXT page load should do (point 4:
      // a refresh must reset to "no conversation active", so the ended
      // session is never offered for resume again). hasActiveChat/the icon
      // naturally reset to their defaults on that next load anyway, simply
      // because nothing will exist to resume - there's no need to force it
      // early within this same page view.
      chatSession.onChatDisconnected(function () {
        clearPersistedChat(resolvedBrand);
      });
    }

    async function startChat() {
      var contactAttributes = await buildContactAttributes(brandInfo, window.utag_data);
      var language = (contactAttributes.language_code || 'en-US').replace('-', '_');
      window.connect.ChatInterface.initiateChat({
        name: contactAttributes.customerName,
        region: brandConfig.region,
        featurePermissions: { "ATTACHMENTS": true }, //This is needs to be removed once this flag will come from connect/VA.
        apiGatewayEndpoint: brandConfig.apiGatewayEndpoint,
        contactAttributes: JSON.stringify(contactAttributes),
        supportedMessagingContentTypes: 'text/plain,text/markdown,application/vnd.amazonaws.connect.message.interactive,application/vnd.amazonaws.connect.message.interactive.response',
        language: language
      }, function onSuccess(chatSession) {
        if (chatSession.rawChatDetails) {
          persistActiveChat(resolvedBrand, resolvedEnv, chatSession.rawChatDetails, contactAttributes.customerName, language);
        }
        wireChatEndCleanup(chatSession);
        // Deliberately broadcast BEFORE setHasActiveChat(true) below, not
        // after - setHasActiveChat() broadcasts its own
        // ACTIVE_CHAT_STATE_STORAGE_KEY change, and the storage listener
        // for THAT key (see applyActiveChatState above) sets this flag's
        // cross-tab counterpart directly. If that arrived first, every
        // other open tab's NEW_CHAT_STARTED_STORAGE_KEY listener below
        // would see hasActiveChat already true and skip resumeChat()
        // entirely via its own `if (hasActiveChat ...) return` guard -
        // leaving that tab's panel opened (by the brand's own
        // onChatActiveChanged hook) but never actually resumed, stuck on
        // its loading spinner until a manual refresh. Broadcasting this
        // first guarantees every other tab still has hasActiveChat===false
        // when it handles this event, so the guard passes and it resumes
        // for real.
        broadcastNewChatStarted();
        setHasActiveChat(true);
      }, function onFailure(error) {
        console.error('[chat-widget] Failed to start chat:', error);
        closePanel();
      });
    }

    function resumeChat(persisted) {
      var language = persisted.language || 'en_US';
      window.connect.ChatInterface.resumeChat({
        chatDetails: persisted.chatDetails,
        name: persisted.name,
        region: brandConfig.region,
        // Needed so ChatSession.js can sync authenticated-customer
        // attributes mid-chat even after a reload/new tab resumes this
        // same session - see ChatContainer.js's submitChatResume.
        apiGatewayEndpoint: brandConfig.apiGatewayEndpoint,
        language: language
      }, function onSuccess(chatSession) {
        setHasActiveChat(true);
        persistActiveChat(resolvedBrand, resolvedEnv, chatSession.rawChatDetails || persisted.chatDetails, persisted.name, language);
        wireChatEndCleanup(chatSession);
      }, function onFailure(error) {
        console.warn('[chat-widget] failed to resume previous chat session', error);
        clearPersistedChat(resolvedBrand);
        setHasActiveChat(false);
      });
    }

    function startOrResumeChat() {
      var resumable = getResumableSession(resolvedBrand);
      if (resumable) {
        openPanel();
        resumeChat(resumable);
        return;
      }
      // Nothing to resume (never chatted, or the previous chat already
      // ended - e.g. via the 90s+30s inactivity auto-disconnect while
      // minimized). resetChatUI() forces the widget back to its blank/
      // loading render SYNCHRONOUSLY, with no network round trip (see
      // ChatInterface.js) - so opening the panel right after it, instantly,
      // shows a loading spinner instead of whatever stale content is still
      // mounted from the previous, now-dead chatSession. startChat() then
      // does its real work (customer-context lookup, StartChatContact)
      // behind that already-visible loading state, exactly like a brand
      // new page load already looks while it connects.
      if (window.connect.ChatInterface && typeof window.connect.ChatInterface.resetChatUI === 'function') {
        window.connect.ChatInterface.resetChatUI();
      }
      openPanel();
      startChat();
    }

    btn.addEventListener('click', function () {
      // This click is a user gesture - use it to unlock the audio context
      // so later chimes (which fire without a gesture) are allowed to play.
      ensureAudioContext();
      if (panel.classList.contains('open')) {
        closePanel();
        return;
      }
      if (hasActiveChat) {
        openPanel();
        return;
      }
      startOrResumeChat();
    });

    function openWidget() {
      if (panel.classList.contains('open')) return;
      if (hasActiveChat) {
        openPanel();
        return;
      }
      startOrResumeChat();
    }

    realOpenWidget = openWidget;
    realCloseWidget = closePanel;
    if (pendingOpenRequest) {
      pendingOpenRequest = false;
      openWidget();
    }

    // Auto-resume: if a chat was already active before this page/tab
    // loaded, reconnect immediately IN THE BACKGROUND, so notification
    // badges/chimes for new messages keep working and the panel (once
    // revealed) has full history ready with no extra wait. Does nothing at
    // all if there's no resumable session - pages/brands that never had an
    // active chat behave exactly as before this feature existed. Safe to
    // run synchronously here (not via setTimeout) - by the time
    // setupWidget() runs, bootstrap() has already awaited scriptLoaded
    // (Promise.all above), so window.connect.ChatInterface.resumeChat is
    // guaranteed to exist.
    //
    // Deliberately never calls openPanel() here - panel VISIBILITY on
    // reload/navigation is the brand developer's own call
    // (window.connect.ChatWidget.open()), not something this script
    // decides on its own. The widget always comes back minimized
    // regardless of how it was left before; the brand developer's own
    // open() call is what reveals it (already-connected, with history
    // loaded) when they decide to.
    if (!hasActiveChat) { // already resumed/started via a click before this ran
      var resumable = getResumableSession(resolvedBrand);
      if (resumable) {
        // Set this synchronously, before the actual reconnect below even
        // starts - resumeChat()'s own onSuccess also sets this, but that
        // only fires once the reconnect's network round-trip resolves.
        // Waiting for that would render the launcher in its default
        // full-text "Chat now" state for a moment first (since revealLauncher
        // below shows the button as soon as its icon is ready, independent
        // of this), then flash to the icon-only chat-active look once
        // resumed - exactly the stale flash this is avoiding. We already
        // know a persisted session exists here, so there's no reason to
        // wait for the round-trip just to decide how the button should look.
        // Silent: this chat was already active before this reload - see
        // applyActiveChatState's comment above for why this specific call
        // must not notify/broadcast.
        setHasActiveChat(true, {silent: true});
        resumeChat(resumable);
      }
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
          window.connect.ChatWidget.launcherElement = dom.btn;
          window.connect.ChatWidget.panelElement = dom.panel;
          document.dispatchEvent(new CustomEvent('elc:chatWidgetReady', {
            detail: {
              brand: brandInfo.brand,
              env: brandInfo.environment,
              launcherElement: dom.btn,
              panelElement: dom.panel,
              // Same values already readable from window.connect.ChatWidget
              // at this point - included here too so a brand script that's
              // only listening for this event (rather than polling the
              // object) has everything it needs in one place to decide
              // whether/how to call open() itself.
              hasActiveChat: window.connect.ChatWidget.hasActiveChat,
              wasOpenBeforeReload: window.connect.ChatWidget.wasOpenBeforeReload
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
