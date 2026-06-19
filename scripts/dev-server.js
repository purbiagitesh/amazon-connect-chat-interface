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
const { exec, spawn } = require('child_process');

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

// Create HTTP server
function createServer() {
  return http.createServer((req, res) => {
    // Parse URL
    let urlPath = req.url.split('?')[0];
    
    // Default to index or hostedWidget.html
    if (urlPath === '/' || urlPath === '') {
      urlPath = '/hostedWidget.html';
    }
    
    // Resolve file path
    const filePath = path.join(LOCAL_TESTING_DIR, urlPath);
    
    // Security check - prevent directory traversal
    if (!filePath.startsWith(LOCAL_TESTING_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
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
        'Cache-Control': 'no-cache',
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
  
  // Start server
  const server = createServer();
  
  server.listen(PORT, () => {
    console.log(`\n🚀 Development server running at http://localhost:${PORT}\n`);
    
    if (state) {
      console.log(`   📁 Client: ${state.client}`);
      console.log(`   🌍 Environment: ${state.env}`);
    } else {
      console.log('   ⚠️  No client configured. Run: npm run prepare -- --client=<name> --env=<env>');
    }
    
    console.log(`\n   Open http://localhost:${PORT}/hostedWidget.html in your browser`);
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
