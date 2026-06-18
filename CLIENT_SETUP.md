Client setup and running (per-client)
=====================================

This document explains how to configure client-specific builds and run the app for a given client and environment.

Files referenced
- Package config: package.json
- Client configs: src/clients/<client>/config.js
- Hosted preview: local-testing/hostedWidget.html

1) Add a client
----------------
Create a new folder for the client:

- src/clients/<your-client>/config.js
- src/clients/<your-client>/logo.svg (optional)

Example minimal `config.js`:

```
module.exports = {
  brand: {
    name: 'My Client',
    logo: '/connect-images/logo.svg',
  },
  theme: {
    primaryColor: '#123456',
  },
  api: {
    customerChatInterfaceUrl: '/amazon-connect-chat-interface.js',
  },
};
```

The build uses a webpack alias `client-config` that resolves to `src/clients/<client>/config.js`.

2) Select client and env (recommended)
--------------------------------------
The simplest way to choose a client and environment is to set `config.client` and `config.env` in `package.json`.

Example (in `package.json`):

```
"config": {
  "client": "default",
  "env": "qa"
}
```

3) Run for development (local preview)
--------------------------------------
This repo provides a helper script which reads `package.json.config` and starts the dev server with the correct environment.

- Start dev server and open the preview page:

```bash
npm run dev
```

This will:
- start `webpack-dev-server` on port 3000
- serve `local-testing/` static files (including `hostedWidget.html`)
- open `http://localhost:3000/hostedWidget.html` in your browser

If you prefer to avoid editing `package.json`, you can run webpack-dev-server directly and provide env vars (POSIX example):

```bash
REACT_APP_CLIENT=myclient REACT_APP_ENV=qa npx webpack-dev-server --config configuration/webpack.config.dev.js
```

On Windows (PowerShell):

```powershell
$env:REACT_APP_CLIENT = 'myclient'; $env:REACT_APP_ENV = 'qa'; npx webpack-dev-server --config configuration/webpack.config.dev.js
```

Note: the repository's `scripts/client-env.js` favors `package.json.config` values. Using the direct `npx` approach sets environment variables for webpack directly.

4) Build for a client (production)
----------------------------------
Update `package.json` `config.client` and `config.env` and run:

```bash
npm run build
```

The build script uses the helper `scripts/client-env.js build` so it will pick up the `package.json.config` values and inject `REACT_APP_CLIENT` and `REACT_APP_ENV` into the build.

5) Preview the built bundle locally
----------------------------------
The built bundle is produced under `build/dist`. To preview the built bundle files using the hosted widget html:

```bash
# after build
npm run debug
# debug runs the dev-build and copies generated amazon-connect-chat-interface.js to local-testing/
# then open the file in a browser:
open http://localhost:3000/hostedWidget.html
```

(Alternatively copy `build/dist/static/js/amazon-connect-chat-interface.js` manually into `local-testing/`.)

6) Troubleshooting
------------------
- If `hostedWidget.html` loads a different page or returns an HTML error, make sure the dev server is running and serving `local-testing/` (the dev server setup maps extensionless routes such as `/hostedWidget` to `hostedWidget.html`).
- If the browser doesn't open automatically, navigate to `http://localhost:3000/hostedWidget.html` manually.
- To change client-specific assets, edit files in `src/clients/<client>/` and restart the dev server if necessary.

7) Notes for contributors
-------------------------
- Keep per-client configuration isolated in `src/clients/<client>/config.js`.
- Prefer changing `package.json.config.client` for reproducible builds across the team.
- The dev server middleware in `configuration/webpack.config.dev.js` maps extensionless routes to `.html` to match hosted widget expectations.

If you want, I can add a `npm run preview` script that always opens the preview page for the current package.json config.
