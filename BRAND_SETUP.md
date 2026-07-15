Brand setup and running (per-brand)
====================================

This document explains how to configure brand-specific builds and run the app for a given brand and environment.

Files referenced
- Package config: package.json
- Brand configs: brands/<brand>/config/env.<env>.json
- Brand theme: brands/<brand>/theme/colors.json, brands/<brand>/theme/variables.css
- Brand assets: brands/<brand>/assets/ (logo, fonts)
- Hosted preview: local-testing/hostedWidget.html

1) Add a brand
---------------
Scaffold a new brand folder from the template:

```bash
npm run create-brand -- --name=my-brand
```

This creates:
- brands/my-brand/config/env.dev.json, env.qa.json, env.prod.json
- brands/my-brand/theme/colors.json, variables.css
- brands/my-brand/assets/ (fonts/, images/)

Fill in the AWS connection details in `brands/my-brand/config/env.<env>.json`:

```json
{
  "aws": {
    "region": "us-west-2",
    "instanceId": "YOUR_CONNECT_INSTANCE_ID",
    "contactFlowId": "YOUR_CONTACT_FLOW_ID",
    "snippetId": "YOUR_SNIPPET_ID",
    "apiGatewayEndpoint": "https://YOUR_INSTANCE.my.connect.aws/connectwidget/api/YOUR_WIDGET_ID/start"
  },
  "widget": {
    "title": "Chat Support",
    "primaryColor": "#123456",
    "fontFamily": "Arial, sans-serif"
  }
}
```

2) Prepare a brand/environment for local testing
--------------------------------------------------
```bash
npm run prepare-brand -- --brand=my-brand --env=dev
```

This copies the brand's assets/theme into `local-testing/brand-assets/` and generates:
- `local-testing/brandInfo.js` (sets `window.__CHAT_BRAND_INFO__`)
- `local-testing/brand-theme.css`
- `.brand-env` (remembers the last-prepared brand/env at the repo root)

List available brands at any time:

```bash
npm run list-brands
```

3) Run for development (local preview)
----------------------------------------
```bash
npm run dev
```

This will:
- re-run `prepare-brand` for whichever brand/env is recorded in `.brand-env` (so asset/theme edits are picked up on every restart)
- start a static file server on port 3000 serving `local-testing/`
- open `http://localhost:3000/hostedWidget.html` in your browser

You can also prepare and start in one step:

```bash
npm run dev -- --brand=my-brand --env=dev
```

4) Build for production
-------------------------
```bash
npm run build
```

The build script (`scripts/build.js`) re-runs `prepare-brand.js` for whatever brand/env is recorded in `.brand-env` before invoking webpack, so the production bundle picks up the currently selected brand's assets.

5) Preview the built bundle locally
--------------------------------------
```bash
npm run debug
# debug runs the dev-build and copies the generated amazon-connect-chat-interface.js to local-testing/
# then open http://localhost:3000/hostedWidget.html
```

6) Troubleshooting
--------------------
- If `hostedWidget.html` loads a different page or returns an HTML error, make sure the dev server is running and serving `local-testing/` (the dev server maps extensionless routes such as `/hostedWidget` to `hostedWidget.html`).
- If the browser doesn't open automatically, navigate to `http://localhost:3000/hostedWidget.html` manually.
- To change brand-specific assets, edit files in `brands/<brand>/` and re-run `npm run prepare-brand -- --brand=<brand> --env=<env>` (or just restart `npm run dev`, which refreshes automatically).

7) Notes for contributors
----------------------------
- Keep per-brand configuration isolated under `brands/<brand>/`.
- `brands/_template/` is the scaffold `create-brand.js` copies from when adding a new brand.
