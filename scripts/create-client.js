#!/usr/bin/env node

/**
 * Create New Client Script
 * 
 * Scaffolds a new client folder from the template with all necessary files.
 * 
 * Usage: node scripts/create-client.js --name=new-client-name
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

// Copy directory recursively with content replacement
function copyDirWithReplacements(src, dest, replacements) {
  fs.mkdirSync(dest, {recursive: true});
  
  const entries = fs.readdirSync(src, {withFileTypes: true});
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirWithReplacements(srcPath, destPath, replacements);
    } else {
      let content = fs.readFileSync(srcPath, 'utf8');
      
      // Apply replacements for JSON and CSS files
      if (entry.name.endsWith('.json') || entry.name.endsWith('.css')) {
        for (const [search, replace] of Object.entries(replacements)) {
          content = content.replace(new RegExp(search, 'g'), replace);
        }
      }
      
      fs.writeFileSync(destPath, content);
    }
  }
}

// Validate client name
function validateClientName(name) {
  if (!name) {
    return 'Client name is required';
  }
  
  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'Client name must contain only lowercase letters, numbers, and hyphens';
  }
  
  if (name.startsWith('-') || name.endsWith('-')) {
    return 'Client name cannot start or end with a hyphen';
  }
  
  const clientPath = path.join(__dirname, '..', 'clients', name);
  if (fs.existsSync(clientPath)) {
    return `Client "${name}" already exists`;
  }
  
  return null;
}

// Create readline interface for interactive mode
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Prompt for input
function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

// Interactive client creation
async function interactiveCreate() {
  const rl = createInterface();
  
  console.log('\n🆕 Create New Client\n');
  
  let clientName;
  while (true) {
    clientName = await prompt(rl, 'Client name (lowercase, hyphens allowed): ');
    const error = validateClientName(clientName);
    if (!error) break;
    console.log(`❌ ${error}\n`);
  }
  
  const displayName = await prompt(rl, `Display name [${clientName}]: `) || clientName;
  const primaryColor = await prompt(rl, 'Primary brand color [#3F51B5]: ') || '#3F51B5';
  const region = await prompt(rl, 'AWS region [us-east-1]: ') || 'us-east-1';
  
  rl.close();
  
  return {
    name: clientName,
    displayName,
    primaryColor,
    region
  };
}

// Main execution
async function main() {
  const args = parseArgs();
  
  // Check for help flag
  if (args.help || args.h) {
    console.log(`
Create New Client Script

Usage:
  npm run create-client                           # Interactive mode
  npm run create-client -- --name=<client-name>   # Quick mode

Options:
  --name       Client folder name (required in quick mode)
  --help, -h   Show this help message

Examples:
  npm run create-client
  npm run create-client -- --name=acme-corp
`);
    process.exit(0);
  }
  
  let clientConfig;
  
  if (args.name) {
    // Quick mode with just the name
    const error = validateClientName(args.name);
    if (error) {
      console.error(`❌ ${error}`);
      process.exit(1);
    }
    clientConfig = {
      name: args.name,
      displayName: args.name,
      primaryColor: '#3F51B5',
      region: 'us-east-1'
    };
  } else {
    // Interactive mode
    clientConfig = await interactiveCreate();
  }
  
  const templateDir = path.join(__dirname, '..', 'clients', '_template');
  const clientDir = path.join(__dirname, '..', 'clients', clientConfig.name);
  
  // Check template exists
  if (!fs.existsSync(templateDir)) {
    console.error('❌ Template folder not found. Please ensure clients/_template exists.');
    process.exit(1);
  }
  
  console.log(`\n📁 Creating client: ${clientConfig.name}\n`);
  
  // Define replacements
  const replacements = {
    '#3F51B5': clientConfig.primaryColor,
    'Chat Support': `${clientConfig.displayName} Support`,
    'us-east-1': clientConfig.region
  };
  
  // Copy template with replacements
  copyDirWithReplacements(templateDir, clientDir, replacements);
  
  // Create assets folders
  fs.mkdirSync(path.join(clientDir, 'assets', 'fonts'), {recursive: true});
  fs.mkdirSync(path.join(clientDir, 'assets', 'images'), {recursive: true});
  
  // Create placeholder logo
  const logoPlaceholder = path.join(clientDir, 'assets', 'logo.png');
  if (!fs.existsSync(logoPlaceholder)) {
    // Create a simple placeholder file
    fs.writeFileSync(path.join(clientDir, 'assets', '.gitkeep'), '');
  }
  
  console.log('  ✅ Created client folder structure');
  console.log('  ✅ Created environment configs (dev, qa, prod)');
  console.log('  ✅ Created theme variables');
  console.log('  ✅ Created assets folders');
  
  console.log(`
✨ Client "${clientConfig.name}" created successfully!

Next steps:
  1. Add your logo: clients/${clientConfig.name}/assets/logo.png
  2. Update AWS config: clients/${clientConfig.name}/config/env.*.json
  3. Customize theme: clients/${clientConfig.name}/theme/variables.css
  4. Run: npm run prepare -- --client=${clientConfig.name} --env=dev
  5. Start: npm run dev
`);
}

// Run
main().catch(console.error);
