#!/usr/bin/env node

/**
 * Development Server Script
 * 
 * Starts a local development server for the chat widget.
 * Automatically prepares the client environment if specified.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const {exec, spawn} = require('child_process');

// Configuration
const PORT = process.env.PORT || 3000;
const LOCAL_TESTING_DIR = path.join(__dirname, '..', 'local-testing');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Parse command line arguments
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value;
    }
  });
  return args;
}

function openBrowser(url) {
  let command;
  if (process.platform === 'win32') {
    command = `cmd.exe /c start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, err => {
    if (err) {
      console.error(`Unable to open browser automatically: ${err.message}`);
    }
  });
}

// Check current client state
function getCurrentClientState() {
  const stateFile = path.join(__dirname, '..', '.client-env');
  if (fs.existsSync(stateFile)) {
    try {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

// Prepare client environment
function prepareClient(client, env) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, 'prepare-client.js');
    const child = spawn('node', [script, `--client=${client}`, `--env=${env}`], {
      stdio: 'inherit'
    });
    
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`prepare-client.js exited with code ${code}`));
      }
    });
  });
}

function resolveFilePath(urlPath) {
  urlPath = decodeURIComponent(urlPath);

  if (urlPath === '/' || urlPath === '') {
    urlPath = '/hostedWidget.html';
  }

  let filePath = path.resolve(LOCAL_TESTING_DIR, `.${urlPath}`);
  const basePath = path.resolve(LOCAL_TESTING_DIR);

  if (!filePath.startsWith(basePath)) {
    return null;
  }

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  if (!path.extname(filePath)) {
    const htmlFilePath = `${filePath}.html`;
    if (htmlFilePath.startsWith(basePath) && fs.existsSync(htmlFilePath)) {
      return htmlFilePath;
    }
  }

  return null;
}

// Create HTTP server
function createServer() {
  return http.createServer((req, res) => {
    // Parse URL
    const urlPath = req.url.split('?')[0];

    // Resolve file path, including extensionless routes such as /hostedWidget
    const filePath = resolveFilePath(urlPath);

    if (!filePath) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // Get MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve file
    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });
}

// Main execution
async function main() {
  const args = parseArgs();
  
  // If client and env provided, prepare first
  if (args.client && args.env) {
    console.log(`\n🔧 Preparing client: ${args.client} (${args.env})\n`);
    try {
      await prepareClient(args.client, args.env);
    } catch (err) {
      console.error('Failed to prepare client:', err.message);
      process.exit(1);
    }
  }

  // Check current state
  const state = getCurrentClientState();

  // Re-run prepare for the already-selected client/env so font and theme
  // changes on disk are picked up on every `npm run dev`, not just when
  // --client/--env are passed explicitly.
  if (!(args.client && args.env) && state && state.client && state.env) {
    console.log(`\n🔄 Refreshing assets for client: ${state.client} (${state.env})\n`);
    try {
      await prepareClient(state.client, state.env);
    } catch (err) {
      console.error('Failed to refresh client assets:', err.message);
    }
  }

  // Start server
  const server = createServer();
  
  server.listen(PORT, () => {
    const serverUrl = `http://localhost:${PORT}/hostedWidget.html`;
    console.log(`\n🚀 Development server running at http://localhost:${PORT}\n`);
    
    if (state) {
      console.log(`   📁 Client: ${state.client}`);
      console.log(`   🌍 Environment: ${state.env}`);
    } else {
      console.log('   ⚠️  No client configured. Run: npm run prepare -- --client=<name> --env=<env>');
    }
    
    console.log(`\n   Opening ${serverUrl} in your browser...`);
    openBrowser(serverUrl);
    console.log('   Press Ctrl+C to stop\n');
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down server...\n');
    server.close();
    process.exit(0);
  });
}

// Run
main().catch(console.error);
