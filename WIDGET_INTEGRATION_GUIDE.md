Chat Widget – Brand Website Integration Guide
================================================

This guide is for **brand website developers** who need to add the chat widget to a page, control where it appears, and react to what it's doing (open/closed, active chat, etc.).

It does not cover how the widget is built internally - just what you need to know to use it.

---

## 1. How the widget loads

Add **one script tag** to any page that should offer chat:

```html
<script src="https://<your-cdn-path>/launcher.js" async></script>
```

That's it. This single script:

- Creates its own floating chat button and chat panel, and appends them to `<body>` - you don't need to add any HTML yourself.
- Loads the rest of the chat UI (`amazon-connect-chat-interface.js`) automatically.
- Figures out which brand/environment it's running for and fetches that brand's config automatically.

The widget's button and panel use a very high `z-index`, so they float above normal page content without you needing to manage stacking.

---

## 2. What the widget needs from your page

Before the widget can start, it needs **`window.utag_data`** (Tealium) to already be available on the page, with at minimum:

```js
window.utag_data = {
  brand: "mybrand",      // required - which brand config to load
  ELC_ENV: "PROD"        // required - which environment (PROD, QA, DEV, etc.)
  // USER_ID, region_code, locale, country_code are also read if present
};
```

If `utag_data.brand` isn't available within **10 seconds** of the page loading, or the brand's config can't be fetched, **the widget simply stays hidden on that page** - no error shown to the customer, nothing breaks.

> This is also the main way the widget "disables" itself on a page - see [Section 5](#5-enabling--disabling-the-widget-on-specific-pages).

---

## 3. What the widget already handles for you

You don't need to write any code for the following - it's all built in:

- The floating chat button itself - clicking it opens/closes the panel, no setup needed. (Opening/closing from your **own** buttons or links is still up to you, via the `open()`/`close()` API in [Section 4](#4-the-public-api-windowconnectchatwidget).)
- Remembering whether the panel was open before a page reload, and keeping that in sync.
- Resuming an existing conversation automatically - same tab, new tab, or after a full page navigation (this is a traditional multi-page site, not a single-page app, so every navigation is a full reload).
- Keeping multiple open tabs in sync with each other: if a chat is started or ended in one tab, every other open tab knows about it.
- Notification sound and the unread-message badge, including making sure the customer only gets notified once even with multiple tabs open, and only when they're not already looking at the conversation.
- Automatic handling of a customer going quiet mid-conversation (follow-up prompts / session timeouts) - no action needed from your side.

---

## 4. The public API: `window.connect.ChatWidget`

Once the widget has initialized, this object is available on every page where it loaded:

| Property / Method | Type | Description |
|---|---|---|
| `ready` | `boolean` | `true` once the widget has finished initializing and is safe to interact with. |
| `launcherElement` | `HTMLElement` | The floating chat button element. |
| `panelElement` | `HTMLElement` | The chat panel element. |
| `hasActiveChat` | `boolean` | Whether a chat is currently active (started or resumed) - in **any** open tab, not just this one. |
| `isMinimized` | `boolean` | Whether **this tab's** panel is currently minimized. |
| `wasOpenBeforeReload` | `boolean` | Whether this tab's panel was open right before this page load (useful for restoring state after a reload). |
| `open()` | `function` | Opens the chat panel (starts a new chat, or resumes one if active). |
| `close()` | `function` | Minimizes the chat panel. |

**Important:** check `ready` (or wait for the `elc:chatWidgetReady` event below) before relying on `launcherElement`/`panelElement` - they're `null` until the widget has finished loading.

### Example - open chat from your own "Chat with us" button

```js
document.getElementById('my-custom-chat-link').addEventListener('click', function () {
  if (window.connect && window.connect.ChatWidget) {
    window.connect.ChatWidget.open();
  }
});
```

---

## 5. Enabling / disabling the widget on specific pages

There is no separate "allowed pages" config inside the widget - it's controlled entirely by **whether the script loads and whether `utag_data.brand` resolves on that page**. Two supported ways to control this:

1. **Don't load `launcher.js` on that page.** This is the simplest and recommended way - e.g. only include the script tag in your site template for pages where chat should be offered, or control it via your tag manager.
2. **Load it everywhere, but hide the button on specific pages.** If the script is already loaded sitewide, you can hide the launcher yourself once it's ready:

```js
document.addEventListener('elc:chatWidgetReady', function () {
  if (isCheckoutPage()) {
    window.connect.ChatWidget.launcherElement.style.display = 'none';
  }
});
```

> Hiding the button this way does **not** end an already-active chat - it only hides the floating button. If a chat is already active, `hasActiveChat` will still be `true` and the conversation keeps running in the background/other tabs.

---

## 6. Events you can listen for

The widget dispatches plain DOM `CustomEvent`s on `document`, so you can listen for them anywhere on your page:

| Event name | Fires when | `event.detail` |
|---|---|---|
| `elc:chatWidgetReady` | The widget has finished loading and is ready to use. | `{ brand, env, launcherElement, panelElement, hasActiveChat, wasOpenBeforeReload }` |
| `elc:chatActiveChanged` | A chat starts or ends (in any open tab). | `{ active: boolean }` |
| `elc:chatMinimizedChanged` | This tab's panel is opened or minimized. | `{ minimized: boolean }` |

### Example

```js
document.addEventListener('elc:chatWidgetReady', function (e) {
  console.log('Chat widget ready for brand:', e.detail.brand);
});

document.addEventListener('elc:chatActiveChanged', function (e) {
  console.log('Chat is now', e.detail.active ? 'active' : 'inactive');
});

document.addEventListener('elc:chatMinimizedChanged', function (e) {
  console.log('Chat panel is now', e.detail.minimized ? 'minimized' : 'open');
});
```

---

## 7. Hooks you can implement: `window.ElcAmazonConnect`

These are **optional**. If you define this object on your page **before** `launcher.js` loads, the widget will call into it. If it's missing, the widget just treats the customer as a guest and skips the notifications below - nothing breaks either way.

| Method | Called when | What to return / do |
|---|---|---|
| `getCustomerContext()` | The widget needs to know if the customer is signed in (chat start, and again mid-chat if they log in later). | Return a `Promise` resolving to `{ authenticated: boolean, firstName, lastName, email, customerId }`, or `{ authenticated: false }` for a guest. |
| `onChatActiveChanged(isActive)` | Same moment as the `elc:chatActiveChanged` event - just a direct function call instead of a DOM event, if that's easier for your code. | Nothing required - just react to it. |
| `onChatMinimized(isMinimized)` | Same moment as the `elc:chatMinimizedChanged` event. | Nothing required - just react to it. |

### Example

```js
window.ElcAmazonConnect = {
  getCustomerContext: async function () {
    if (!isUserLoggedIn()) {
      return { authenticated: false };
    }
    return {
      authenticated: true,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      email: currentUser.email,
      customerId: currentUser.id
    };
  },
  onChatActiveChanged: function (isActive) {
    // e.g. show/hide a "chat in progress" indicator elsewhere on the page
  },
  onChatMinimized: function (isMinimized) {
    // e.g. hide a sticky footer while the chat panel is open
  }
};
```

Define this **before** the `launcher.js` script tag on the page, so it's available by the time the widget looks for it.

---

## 8. Quick checklist for a new page/site

- [ ] `window.utag_data.brand` and `window.utag_data.ELC_ENV` are set before `launcher.js` loads.
- [ ] `launcher.js` script tag is included only on pages where chat should be offered.
- [ ] (Optional) `window.ElcAmazonConnect` is defined before `launcher.js`, if you need signed-in customer context or open/minimize notifications.
- [ ] (Optional) Listen for `elc:chatWidgetReady` / `elc:chatActiveChanged` / `elc:chatMinimizedChanged` if your page needs to react to chat state.
- [ ] Nothing else required - open/close, multi-tab sync, resume-on-reload, and notifications are all handled automatically.
