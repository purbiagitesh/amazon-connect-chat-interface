/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Self-mounting chat launcher - the single script Tealium injects on each
 * brand's real website.
 *
 * This is the production counterpart of local-testing/hostedWidget.html's
 * bootstrap script. hostedWidget.html was where this logic was built and
 * tested (fast to iterate against in a browser); this file is the same
 * logic made deployable on its own, with two differences required because
 * a brand's real website is not a page we control:
 *
 *   1. It creates its OWN DOM (the "Chat now" button, the chat panel
 *      container, and their <style>) instead of assuming that markup
 *      already exists in the page - a brand's site has its own HTML, not
 *      ours.
 *   2. Every asset URL (brandInfo.json, the launcher icon, the chat bundle)
 *      is resolved as an ABSOLUTE url against THIS SCRIPT's own location,
 *      not a relative path. A relative fetch would resolve against the
 *      brand's website origin (where this script is merely injected),
 *      not the CDN this script and its sibling brand-assets/ actually live
 *      on - those are two different origins in production.
 *
 * Self-hosted chat interface (not AWS's hosted Communications Widget):
 * this script loads our own amazon-connect-chat-interface.js bundle
 * directly and drives it via connect.ChatInterface.init()/.initiateChat().
 * There is no AWS-hosted widget snippet/iframe involved, and therefore no
 * competing "native" start-chat call - the Lambda behind apiGatewayEndpoint
 * is the only thing that ever creates the contact. (An earlier version of
 * this file loaded AWS's hosted Communications Widget instead; that widget
 * always ran its own native start-chat regardless of any customStartChat
 * override, so contact attributes and the actual live session never lined
 * up with what this script's own Lambda created - see git history for that
 * approach if it's ever needed for reference.)
 *
 * Deployment: this file, amazon-connect-chat-interface.js, and brand-assets/
 * all get served from the SAME host/CDN (see scripts/build.js, which copies
 * all three into build/dist/). Tealium's tag on each brand's site is then
 * just:
 *   <script src="https://<that-host>/launcher.js"></script>
 * Nothing brand-specific lives in the tag itself - brand is resolved here,
 * at runtime, from window.utag_data.
 */
(function () {
  'use strict';

  // ─── Resolve our own base URL (see file header) ───
  // Must be captured synchronously, at the top of the script's first
  // execution - document.currentScript is only reliable before any async
  // work (a Promise .then, a setTimeout, etc.) has run.
  var LAUNCHER_BASE_URL = (function () {
    var scriptUrl = null;
    if (document.currentScript && document.currentScript.src) {
      scriptUrl = document.currentScript.src;
    } else {
      // Fallback for environments where document.currentScript isn't
      // available (older browsers, or this script injected some other
      // way) - find our own <script src> tag by filename.
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
    // brandInfo.json's own fields (assets.logo, assets.icon, fontFaces[].url)
    // are relative paths like "./brand-assets/<brand>/images/logo.svg" -
    // resolve those (and our own fetch targets) against our base, not the
    // host page's location.
    return new URL(relativeOrAbsolute, LAUNCHER_BASE_URL).href;
  }

  var CHAT_PANEL_ID = 'amazon-connect-chat-panel';

  // ─── DOM: create the launcher's CSS + markup (no pre-existing HTML assumed) ───

  var LAUNCHER_CSS = ''
    + '#chat-now-btn {'
    + '  display: none;'
    + '  position: fixed;'
    + '  bottom: 24px;'
    + '  right: 24px;'
    + '  background-color: var(--launcher-color-default, #8B005D);'
    + '  color: #ffffff;'
    + '  border: none;'
    + '  border-radius: 50px;'
    + '  padding: 8px 15px;'
    + '  font-size: 14px;'
    + '  font-weight: 600;'
    + '  cursor: pointer;'
    + '  align-items: center;'
    + '  gap: 10px;'
    + '  box-shadow: var(--launcher-shadow, 0 4px 16px rgba(139, 0, 93, 0.4));'
    + '  z-index: 9999;'
    + '  font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif;'
    + '  transition: background-color 0.2s ease, transform 0.15s ease;'
    + '}'
    + '#chat-now-btn.ready { display: flex; }'
    + '#chat-now-btn:hover { background-color: var(--launcher-color-active, #a3006e); transform: scale(1.04); }'
    + '#chat-now-btn:active { background-color: var(--launcher-color-active, #a3006e); transform: scale(0.97); }'
    + '#chat-now-btn .btn-icon {'
    + '  display: flex;'
    + '  align-items: center;'
    + '  justify-content: center;'
    + '  background: rgba(255, 255, 255, 0.2);'
    + '  border-radius: 50%;'
    + '  width: 28px;'
    + '  height: 28px;'
    + '  flex-shrink: 0;'
    + '}'
    + '#chat-now-btn .btn-icon svg { width: 15px; height: 15px; }'
    // Icon colors are driven by CSS, not baked into each brand's SVG file -
    // every brand's launcher-icon.svg uses these same two class names with
    // no fill attribute of its own, so re-coloring the icon globally never
    // requires touching per-brand assets. The inner star (.chat-icon-fg)
    // stays in sync with the launcher button's own background color - same
    // --launcher-color-* variables, switching on hover/active exactly like
    // the button itself does.
    + '#chat-now-btn .btn-icon svg .chat-icon-bg { fill: #ffffff; }'
    + '#chat-now-btn .btn-icon svg .chat-icon-fg { fill: var(--launcher-color-default, #8B005D); }'
    + '#chat-now-btn:hover .btn-icon svg .chat-icon-fg,'
    + '#chat-now-btn:active .btn-icon svg .chat-icon-fg { fill: var(--launcher-color-active, #a3006e); }'
    + '#chat-now-btn .btn-icon img { width: 15px; height: 15px; object-fit: contain; }'
    + '#chat-now-btn.widget-open { display: none !important; }'
    // Chat panel: this is OUR OWN floating container (no AWS-managed iframe
    // to style anymore) - amazon-connect-chat-interface.js's React app
    // (App.js's "Page" element, className "connect-customer-interface")
    // mounts directly inside it. Page has its own fixed 300px width/margin/
    // shadow meant for being the sole content of an iframe document, so
    // those are neutralized here in favor of this container's own chrome.
    + '#' + CHAT_PANEL_ID + ' {'
    + '  display: none;'
    + '  position: fixed;'
    + '  bottom: 24px;'
    + '  right: 24px;'
    + '  width: 330px;'
    // Fixed pixel height, deliberately NOT a calc(100vh - ...) expression -
    // that dynamic form was the suspected cause of the panel only
    // rendering correctly while DevTools happened to be open: the bug
    // reproduced specifically when the viewport grew *after* the panel was
    // already open (DevTools closing), which a static bottom-anchored box
    // should never be sensitive to. A plain fixed height has no viewport
    // dependency to ever go stale on.
    + '  height: 520px;'
    + '  max-width: calc(100vw - 32px);'
    + '  background: #ffffff;'
    + '  border-radius: 24px;'
    + '  overflow: hidden;'
    + '  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);'
    + '  z-index: 9998;'
    + '}'
    + '#' + CHAT_PANEL_ID + '.open { display: block; }'
    + '#' + CHAT_PANEL_ID + ' .connect-customer-interface {'
    + '  width: 100% !important;'
    + '  height: 100% !important;'
    + '  margin: 0 !important;'
    + '  box-shadow: none !important;'
    + '}';

  // Fallback icon shown only until the resolved brand's own
  // assets/images/launcher-icon.svg has been fetched and inlined by
  // applyLauncherIcon() below - colors come purely from the CSS rules
  // above, not from attributes on the paths themselves.
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
    btn.id = 'chat-now-btn';
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = '<span class="btn-icon">' + FALLBACK_ICON_SVG + '</span>Chat now';
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = CHAT_PANEL_ID;
    document.body.appendChild(panel);

    return { btn: btn, panel: panel };
  }

  // ─── Runtime brand resolution (single build, all brands) ───
  // Brand is not baked in at build/deploy time. Instead we wait for
  // window.utag_data (Tealium's data-layer global, set on every brand's
  // site), resolve which brand/env it points to, fetch that brand's
  // brandInfo.json (generated for every brand by
  // `npm run prepare-brand -- --all`, see scripts/prepare-brand.js), and
  // only then apply theming and reveal the launcher. The launcher and the
  // chat window both carry brand styling, so nothing brand-specific may
  // render before this resolves.
  var UTAG_POLL_INTERVAL_MS = 100;
  var UTAG_TIMEOUT_MS = 10000;

  // Maps utag_data.ELC_ENV -> our brands/<brand>/config/env.<env>.json
  // naming. Unrecognized values fall back to "prod".
  var ENV_MAP = {
    PROD: 'prod', PRODUCTION: 'prod',
    QA: 'qa', STAGE: 'qa', STAGING: 'qa',
    DEV: 'dev', DEVELOPMENT: 'dev'
  };

  // Patch here if a brand's utag_data.brand value doesn't match its
  // brands/<brand>/ folder name (needs verifying per brand against live
  // utag_data - only "kilian" has been confirmed so far).
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

  // ─── Contact attributes for the Connect greeting flow ───
  // Maps window.utag_data (Tealium's data-layer, same global brand
  // resolution above reads from) to the contact attribute names the Connect
  // flow's "Play prompt"/greeting block references. Sent once, as part of
  // the StartChatContact request our own Lambda (apiGatewayEndpoint) makes -
  // Connect persists Attributes for the life of the contact, so the flow's
  // very first block already sees them.
  // customerEmail/customerName/customerPhone are static placeholders until
  // real utag_data keys for those are confirmed with the brand's site.
  // customerLoggedIn is temporarily hardcoded to 'Yes' for testing; restore
  // the utag_data.customer_state check once a real logged-in sample is
  // available to verify against.
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
      channel: 'Chat'
    };
  }

  function hexToRgba(hex, alpha) {
    var match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!match) return null;
    var r = parseInt(match[1], 16), g = parseInt(match[2], 16), b = parseInt(match[3], 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  // Launcher color (Default/Hover/Pressed) is driven by the brand's
  // Primary500/Primary800 tokens - same source the header background
  // uses - so switching brands updates it with no code changes.
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

  // Swaps in the resolved brand's own launcher icon
  // (config.launcherIconUrl or assets.icon, generated from
  // brands/<brand>/assets/images/launcher-icon.svg by prepare-brand.js).
  // SVGs are fetched and inlined (not used as an <img src>) so their
  // internal .chat-icon-bg/.chat-icon-fg classes stay reachable by our
  // CSS above - an <img> would treat the SVG as an opaque image with no
  // way to theme its colors. Returns a Promise so the caller can wait
  // for it before revealing the launcher (no flash of the fallback icon).
  function applyLauncherIcon(brandInfo, btn) {
    var brandConfig = (brandInfo && brandInfo.config) || {};
    var rawIconUrl = brandConfig.launcherIconUrl || (brandInfo.assets && brandInfo.assets.icon);
    var iconSlot = btn.querySelector('.btn-icon');
    if (!rawIconUrl || !iconSlot) return Promise.resolve();

    var iconUrl = absoluteUrl(rawIconUrl);

    if (!/\.svg(\?|$)/i.test(iconUrl)) {
      // Non-SVG (e.g. PNG) icons can't have internal colors themed -
      // just swap in an <img>.
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

  // Loads our own chat interface bundle (this repo's src/index.js output) -
  // attaches connect.ChatInterface.init/.initiateChat onto window.connect.
  // No AWS-hosted script/iframe is involved.
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
    window.__CHAT_BRAND_INFO__ = brandInfo;
    var brandConfig = brandInfo.config || {};
    var brandColors = brandConfig.colors || {};

    applyBrandColors(brandConfig);

    // Mount the (initially idle) chat React app into our own panel - no
    // network calls happen until initiateChat() is called below, so it's
    // safe to do this eagerly rather than on first click.
    window.connect.ChatInterface.init({
      containerId: CHAT_PANEL_ID,
      headerConfig: brandConfig.header,
      logoConfig: brandInfo.assets && brandInfo.assets.logo
        ? { sourceUrl: brandInfo.assets.logo, altText: (brandInfo.brand || 'Brand') + ' logo' }
        : undefined,
    });

    // Tracks whether a chat is currently active, so re-clicking the
    // launcher button while a session is live just toggles the panel
    // instead of starting a second, unrelated contact.
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
        // Fires when the chat truly ends (customer or agent closes it) -
        // reopening the panel afterward should start a fresh chat, not
        // silently show the now-disconnected transcript.
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
        // Minimize - does not end an active chat, so reopening resumes it.
        closePanel();
        return;
      }
      openPanel();
      if (!hasActiveChat) {
        startChat();
      }
    });

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
        return setupWidget(results[1], dom.btn, dom.panel);
      })
      .catch(function (err) {
        console.warn('[chat-widget] failed to initialize - launcher will remain hidden.', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    // DOMContentLoaded already fired by the time this script ran (e.g. it
    // was injected late by a tag manager) - document.body already exists,
    // so it's safe to run immediately instead of waiting for an event that
    // already happened.
    bootstrap();
  }
})();
