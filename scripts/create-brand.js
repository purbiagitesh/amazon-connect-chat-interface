#!/usr/bin/env node

/**
 * Create New Brand Script
 *
 * Scaffolds a new brand folder from the template with all necessary files.
 *
 * Usage: node scripts/create-brand.js --name=new-brand-name
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

// Validate brand name
function validateBrandName(name) {
  if (!name) {
    return 'Brand name is required';
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'Brand name must contain only lowercase letters, numbers, and hyphens';
  }

  if (name.startsWith('-') || name.endsWith('-')) {
    return 'Brand name cannot start or end with a hyphen';
  }

  const brandPath = path.join(__dirname, '..', 'brands', name);
  if (fs.existsSync(brandPath)) {
    return `Brand "${name}" already exists`;
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

// Interactive brand creation
async function interactiveCreate() {
  const rl = createInterface();

  console.log('\n🆕 Create New Brand\n');

  let brandName;
  while (true) {
    brandName = await prompt(rl, 'Brand name (lowercase, hyphens allowed): ');
    const error = validateBrandName(brandName);
    if (!error) break;
    console.log(`❌ ${error}\n`);
  }

  const displayName = await prompt(rl, `Display name [${brandName}]: `) || brandName;
  const primaryColor = await prompt(rl, 'Primary brand color [#3F51B5]: ') || '#3F51B5';
  const region = await prompt(rl, 'AWS region [us-east-1]: ') || 'us-east-1';

  rl.close();

  return {
    name: brandName,
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
Create New Brand Script

Usage:
  npm run create-brand                          # Interactive mode
  npm run create-brand -- --name=<brand-name>   # Quick mode

Options:
  --name       Brand folder name (required in quick mode)
  --help, -h   Show this help message

Examples:
  npm run create-brand
  npm run create-brand -- --name=acme-corp
`);
    process.exit(0);
  }

  let brandConfig;

  if (args.name) {
    // Quick mode with just the name
    const error = validateBrandName(args.name);
    if (error) {
      console.error(`❌ ${error}`);
      process.exit(1);
    }
    brandConfig = {
      name: args.name,
      displayName: args.name,
      primaryColor: '#3F51B5',
      region: 'us-east-1'
    };
  } else {
    // Interactive mode
    brandConfig = await interactiveCreate();
  }

  const templateDir = path.join(__dirname, '..', 'brands', '_template');
  const brandDir = path.join(__dirname, '..', 'brands', brandConfig.name);

  // Check template exists
  if (!fs.existsSync(templateDir)) {
    console.error('❌ Template folder not found. Please ensure brands/_template exists.');
    process.exit(1);
  }

  console.log(`\n📁 Creating brand: ${brandConfig.name}\n`);

  // Define replacements
  const replacements = {
    '#3F51B5': brandConfig.primaryColor,
    'Chat Support': `${brandConfig.displayName} Support`,
    'us-east-1': brandConfig.region
  };

  // Copy template with replacements
  copyDirWithReplacements(templateDir, brandDir, replacements);

  // Create assets folders
  fs.mkdirSync(path.join(brandDir, 'assets', 'fonts'), {recursive: true});
  fs.mkdirSync(path.join(brandDir, 'assets', 'images'), {recursive: true});

  // Create placeholder logo
  const logoPlaceholder = path.join(brandDir, 'assets', 'logo.png');
  if (!fs.existsSync(logoPlaceholder)) {
    // Create a simple placeholder file
    fs.writeFileSync(path.join(brandDir, 'assets', '.gitkeep'), '');
  }

  console.log('  ✅ Created brand folder structure');
  console.log('  ✅ Created environment configs (dev, qa, prod)');
  console.log('  ✅ Created theme variables');
  console.log('  ✅ Created assets folders');

  console.log(`
✨ Brand "${brandConfig.name}" created successfully!

Next steps:
  1. Add your logo: brands/${brandConfig.name}/assets/logo.png
  2. Update AWS config: brands/${brandConfig.name}/config/env.*.json
  3. Customize theme: brands/${brandConfig.name}/theme/variables.css
  4. Run: npm run prepare-brand -- --brand=${brandConfig.name} --env=dev
  5. Start: npm run dev
`);
}

// Run
main().catch(console.error);
