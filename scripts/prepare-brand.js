#!/usr/bin/env node

/**
 * Brand Environment Preparation Script
 *
 * This script prepares the local-testing environment for a specific brand and environment.
 * It copies brand-specific assets, themes, and configurations to the runtime folder.
 *
 * Usage: node scripts/prepare-brand.js --brand=abc-corp --env=dev
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value === undefined ? true : value;
    }
  });
  return args;
}

// Validate brand and environment exist
function validateBrandEnv(brandName, envName) {
  const brandPath = path.join(__dirname, '..', 'brands', brandName);
  const envFile = path.join(brandPath, 'config', `env.${envName}.json`);

  if (!fs.existsSync(brandPath)) {
    console.error(`❌ Brand "${brandName}" not found in brands/ folder`);
    console.log('\nAvailable brands:');
    listBrands();
    process.exit(1);
  }

  if (!fs.existsSync(envFile)) {
    console.error(`❌ Environment "${envName}" not found for brand "${brandName}"`);
    console.log('\nAvailable environments:');
    listEnvironments(brandName);
    process.exit(1);
  }

  return {brandPath, envFile};
}

// List available brands
function listBrands() {
  const brandsDir = path.join(__dirname, '..', 'brands');
  const brands = fs.readdirSync(brandsDir)
    .filter(name => {
      const fullPath = path.join(brandsDir, name);
      return fs.statSync(fullPath).isDirectory() && !name.startsWith('_');
    });

  if (brands.length === 0) {
    console.log('  No brands configured yet. Use "npm run create-brand" to create one.');
  } else {
    brands.forEach(brand => console.log(`  - ${brand}`));
  }
}

// List available environments for a brand
function listEnvironments(brandName) {
  const configDir = path.join(__dirname, '..', 'brands', brandName, 'config');
  if (!fs.existsSync(configDir)) {
    console.log('  No configurations found');
    return;
  }

  const envFiles = fs.readdirSync(configDir)
    .filter(name => name.startsWith('env.') && name.endsWith('.json'))
    .map(name => name.replace('env.', '').replace('.json', ''));

  envFiles.forEach(env => console.log(`  - ${env}`));
}

// Copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, {recursive: true});

  const entries = fs.readdirSync(src, {withFileTypes: true});

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getFontFamilyName(fontFamilyString) {
  if (!fontFamilyString) return 'CustomFont';
  const family = fontFamilyString.split(',')[0].trim();
  return family.replace(/^['"]|['"]$/g, '') || 'CustomFont';
}

function getFontFamilyFromPath(relativePath) {
  const formatDirs = ['ttf', 'otf', 'woff', 'woff2'];
  const ignoredDirs = ['assets', 'fonts'];
  const parts = relativePath.split('/').filter(Boolean);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    const lowerPart = part.toLowerCase();

    if (!part || part.includes('.')) {
      continue;
    }

    if (formatDirs.includes(lowerPart) || ignoredDirs.includes(lowerPart)) {
      continue;
    }

    return part.replace(/_/g, ' ').trim() || 'CustomFont';
  }

  return 'CustomFont';
}

function inferFontFamilyFromBrandPath(brandPath, fallback = 'CustomFont') {
  const candidateDirs = [
    path.join(brandPath, 'assets', 'fonts'),
    path.join(brandPath, 'Fonts')
  ];

  for (const fontDir of candidateDirs) {
    if (!fs.existsSync(fontDir)) {
      continue;
    }

    const childNames = fs.readdirSync(fontDir).filter(name => {
      const childPath = path.join(fontDir, name);
      return fs.existsSync(childPath) && fs.statSync(childPath).isDirectory() && !['TTF', 'OTF', 'WOFF', 'WOFF2', 'ttf', 'otf', 'woff', 'woff2'].includes(name);
    });

    if (childNames.length > 0) {
      return childNames[0].replace(/_/g, ' ').trim();
    }
  }

  return fallback;
}

function getResolvedFontFamily(fontFamilyString, fontFiles, brandPath = null) {
  const detectedFamily = Array.isArray(fontFiles)
    ? fontFiles.find(file => file.familyName && file.familyName !== 'CustomFont')?.familyName
    : null;

  if (detectedFamily) {
    return detectedFamily;
  }

  if (brandPath) {
    const inferredFamily = inferFontFamilyFromBrandPath(brandPath);
    if (inferredFamily && inferredFamily !== 'CustomFont') {
      return inferredFamily;
    }
  }

  if (fontFamilyString && fontFamilyString !== 'TTF' && fontFamilyString !== 'OTF' && fontFamilyString !== 'WOFF' && fontFamilyString !== 'WOFF2') {
    return getFontFamilyName(fontFamilyString);
  }

  return 'CustomFont';
}

const FONT_FORMAT_MAP = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype'
};

// Preferred src ordering within a single @font-face block (browsers use the
// first source they can load, so list the most efficient formats first).
const FONT_FORMAT_PRIORITY = ['woff2', 'woff', 'otf', 'ttf'];

const FONT_WEIGHT_MAP = {
  thin: 100, th: 100, hairline: 100,
  extralight: 200, ultralight: 200,
  light: 300, lt: 300,
  regular: 400, roman: 400, rg: 400, book: 400, normal: 400,
  medium: 500, md: 500,
  semibold: 600, demibold: 600, sb: 600,
  bold: 700, bd: 700,
  extrabold: 800, ultrabold: 800,
  black: 900, blk: 900, heavy: 900
};

// Derives font-weight/font-style from a filename's trailing token, e.g.
// "HelveticaNeueLTPro-BdIt.ttf" -> {weight: 700, style: 'italic'},
// "HelveticaNeueLTPro-Roman.ttf" -> {weight: 400, style: 'normal'}.
// Font files that don't distinguish weight in the filename all resolve to
// the same {400, normal}, which is intentional since we can't tell them apart.
function parseFontWeightStyle(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const parts = base.split(/[-_\s]+/).filter(Boolean);
  const last = (parts[parts.length - 1] || '').toLowerCase();

  let style = 'normal';
  let weightToken = last;
  const italicMatch = last.match(/(italic|oblique|it)$/);
  if (italicMatch) {
    style = italicMatch[1] === 'oblique' ? 'oblique' : 'italic';
    weightToken = last.slice(0, -italicMatch[1].length);
  }

  const weight = FONT_WEIGHT_MAP[weightToken] || 400;
  return {weight, style};
}

// Descriptors describing where each brand font file lives, used both to
// emit the @font-face CSS block and to hand the same data to the runtime
// (via brandInfo.js) so the widget can inject its own @font-face rules
// when it's rendered inside a cross-document iframe that never loads
// brand-theme.css.
// Font files are scanned from either brands/<brand>/Fonts or
// brands/<brand>/assets/fonts, but prepare-brand.js copies both of those
// source folders' *contents* into local-testing/brand-assets/Fonts. Strip
// the source-root prefix so served URLs match where files actually land.
function stripFontsSourcePrefix(relativePath) {
  const parts = relativePath.split('/').filter(Boolean);
  while (parts.length && ['fonts', 'assets'].includes(parts[0].toLowerCase())) {
    parts.shift();
  }
  return parts.join('/');
}

function getFontFaceDescriptors(fontFiles, resolvedFontFamily, assetsBasePath = './brand-assets') {
  if (!fontFiles || fontFiles.length === 0) {
    return [];
  }

  return [].concat(fontFiles)
    .sort((a, b) => a.ext.localeCompare(b.ext))
    .map(font => {
      const {weight, style} = parseFontWeightStyle(font.name);
      return {
        family: resolvedFontFamily,
        format: FONT_FORMAT_MAP[font.ext] || 'truetype',
        ext: font.ext,
        url: assetsBasePath + '/Fonts/' + stripFontsSourcePrefix(font.relativePath),
        weight,
        style
      };
    });
}

function generateFontFaceCss(fontFamilyString, fontFiles, resolvedFontFamily = null) {
  const fontFamily = resolvedFontFamily || getResolvedFontFamily(fontFamilyString, fontFiles);
  const descriptors = getFontFaceDescriptors(fontFiles, fontFamily);
  if (!descriptors.length) {
    return '';
  }

  // Group by weight/style so each distinct font file (Bold, Light, Medium, ...)
  // gets its own @font-face rule instead of being squashed into a single
  // normal-weight rule where the browser silently picks just one file.
  const byWeightStyle = descriptors.reduce((acc, font) => {
    const key = font.weight + '|' + font.style;
    acc[key] = acc[key] || [];
    acc[key].push(font);
    return acc;
  }, {});

  return Object.keys(byWeightStyle).map(key => {
    const group = byWeightStyle[key];
    const {weight, style} = group[0];
    const sources = [].concat(group)
      .sort((a, b) => FONT_FORMAT_PRIORITY.indexOf(a.ext) - FONT_FORMAT_PRIORITY.indexOf(b.ext))
      .map(font => "url('" + font.url + "') format('" + font.format + "')")
      .join(',\n       ');
    return "@font-face {\n  font-family: '" + fontFamily + "';\n  src: " + sources + ";\n  font-weight: " + weight + ";\n  font-style: " + style + ";\n}\n";
  }).join('\n') + '\n';
}

function getBrandFontFiles(brandPath) {
  const supported = ['.ttf', '.woff', '.woff2', '.otf'];
  const candidateDirs = [
    path.join(brandPath, 'Fonts'),
    path.join(brandPath, 'assets', 'fonts')
  ];

  const files = [];
  const seen = new Set();

  function scanDir(directory, parentRelative = '') {
    if (!fs.existsSync(directory)) {
      return [];
    }

    const entries = fs.readdirSync(directory, {withFileTypes: true});
    const scannedFiles = [];
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      const relativePath = path.join(parentRelative, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        scannedFiles.push(...scanDir(entryPath, relativePath));
      } else if (supported.includes(path.extname(entry.name).toLowerCase())) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        const familyName = getFontFamilyFromPath(relativePath);
        scannedFiles.push({
          name: entry.name,
          relativePath,
          ext,
          familyName
        });
      }
    }
    return scannedFiles;
  }

  candidateDirs.forEach(fontsDir => {
    const scanned = scanDir(fontsDir, path.relative(brandPath, fontsDir).replace(/\\/g, '/'));
    scanned.forEach(file => {
      const key = `${file.relativePath}:${file.ext}`;
      if (!seen.has(key)) {
        seen.add(key);
        files.push(file);
      }
    });
  });

  return files;
}

// Reads brands/<brand>/theme/colors.json - the single source of truth for
// brand color tokens (Primary500/Primary800, matching the design spec's
// naming) - and falls back to widget.primaryColor / a hardcoded default so
// brands that haven't set up colors.json yet still render something sane.
function getBrandColorPalette(brandThemeDir, widgetConfig = {}) {
  const colorsPath = path.join(brandThemeDir, 'colors.json');
  let colors = {};
  if (fs.existsSync(colorsPath)) {
    try {
      colors = JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
    } catch (e) {
      console.warn('  ⚠️ Failed to parse colors.json:', e.message);
    }
  }
  const primary = colors.primary || {};
  const primary500 = primary['500'] || widgetConfig.primaryColor || '#3F5773';
  const primary800 = primary['800'] || primary500;
  return {primary500, primary800};
}

function generateBrandThemeCss(widgetConfig, headerConfig, outputPath, fontFiles = [], resolvedFontFamily = null, colorPalette = {}) {
  const primaryColor = colorPalette.primary500 || widgetConfig.primaryColor || '#3F51B5';
  const primary800 = colorPalette.primary800 || primaryColor;
  const secondaryColor = widgetConfig.secondaryColor || '#FF4081';
  const headerTextColor = widgetConfig.headerTextColor || '#FFFFFF';
  const fontFamily = resolvedFontFamily || getResolvedFontFamily(widgetConfig.fontFamily, fontFiles);

  // Header background is driven entirely by the brand's Primary500 token so
  // it can never drift out of sync with the rest of the brand's theme.
  const headerBg = primaryColor;
  const headerTitleColor = (headerConfig && headerConfig.textColor) || headerTextColor;
  const headerSubtitleColor = (headerConfig && headerConfig.subtitleColor) || 'rgba(255,255,255,0.70)';

  const fontFaceCss = generateFontFaceCss(fontFamily, fontFiles, fontFamily);
  const content = fontFaceCss + ':root {\n' +
    '  --ac-widget-color-primary-500: ' + primaryColor + ';\n' +
    '  --ac-widget-color-primary-800: ' + primary800 + ';\n' +
    '  --ac-widget-header-backgroundcolor: ' + primaryColor + ';\n' +
    '  --ac-widget-header-textcolor: ' + headerTextColor + ';\n' +
    '  --ac-widget-footer-backgroundcolor: ' + secondaryColor + ';\n' +
    '  --ac-widget-footer-button-backgroundcolor: ' + secondaryColor + ';\n' +
    '  --ac-widget-footer-button-textcolor: ' + headerTextColor + ';\n' +
    '  --ac-widget-global-typeface: ' + fontFamily + ';\n' +
    '  --ac-widget-transcript-customer-bubble-color: ' + primaryColor + ';\n' +
    '  --ac-widget-transcript-customer-textcolor: ' + headerTextColor + ';\n' +
    '  --ac-widget-transcript-agent-bubble-color: #F5F5F5;\n' +
    '  --ac-widget-transcript-agent-textcolor: #333333;\n\n' +
    '  /* ── Chat Header ── */\n' +
    '  --header-bg:             ' + headerBg + ';\n' +
    '  --header-text-color:     ' + headerTitleColor + ';\n' +
    '  --header-subtitle-color: ' + headerSubtitleColor + ';\n' +
    '  --header-padding:        14px 16px;\n' +
    '  --header-logo-size:      40px;\n' +
    '  --header-title-size:     13px;\n' +
    '  --header-title-weight:   600;\n' +
    '  --header-title-spacing:  0.08em;\n' +
    '  --header-subtitle-size:  11px;\n' +
    '  --header-subtitle-maxw:  260px;\n' +
    '  --header-close-size:     22px;\n' +
    '}\n';

  fs.writeFileSync(outputPath, content);
  console.log('  ✅ Generated brand-theme.css');
}

// Looks inside brands/<brand>/assets - the same folder copyDirSync() publishes
// to local-testing/brand-assets - so the returned URL always matches where the
// file actually lands. images/logo.svg is checked first since brand marks are
// supplied as SVG; logo.png stays supported as a fallback for older brands.
function getBrandLogoUrl(brandPath, assetsBasePath = './brand-assets') {
  const assetsDir = path.join(brandPath, 'assets');
  const candidates = ['images/logo.svg', 'images/logo.png', 'logo.svg', 'logo.png'];
  for (const relativePath of candidates) {
    if (fs.existsSync(path.join(assetsDir, relativePath))) {
      return `${assetsBasePath}/${relativePath}`;
    }
  }
  return null;
}

// Same resolution strategy as getBrandLogoUrl(), but for the small
// virtual-assistant avatar shown next to incoming chat messages. Kept as a
// distinct asset (not a fallback to the header logo) so brands opt in
// explicitly by dropping an avatar file in - clients without one render no
// avatar at all, leaving their transcript UI unchanged.
function getClientAvatarUrl(clientPath, assetsBasePath = './brand-assets') {
  const assetsDir = path.join(clientPath, 'assets');
  const candidates = ['images/avatar.svg', 'images/avatar.png', 'avatar.svg', 'avatar.png'];
  for (const relativePath of candidates) {
    if (fs.existsSync(path.join(assetsDir, relativePath))) {
      return `${assetsBasePath}/${relativePath}`;
    }
  }
  return null;
}

// Same resolution strategy as getClientAvatarUrl(), but for the composer's
// send-message button icon. Brands that don't supply one keep the default
// inline SVG (which supports CSS-driven active/inactive recoloring); a
// supplied file's own color is used as-is since external images can't be
// recolored via CSS fill.
function getClientSendIconUrl(clientPath, assetsBasePath = './brand-assets') {
  const assetsDir = path.join(clientPath, 'assets');
  const candidates = ['images/send-icon.svg', 'images/send-icon.png', 'send-icon.svg', 'send-icon.png'];
  for (const relativePath of candidates) {
    if (fs.existsSync(path.join(assetsDir, relativePath))) {
      return `${assetsBasePath}/${relativePath}`;
    }
  }
  return null;
}

// Builds the plain brand-info object shared by both output modes: the
// single-brand mode below serializes this into a `window.X = {...}` script,
// while --all mode (prepareAllBrands) writes it straight to a fetchable
// brandInfo.json - same shape either way, so src/index.js's getBrandInfo()
// consumer doesn't need to care which mode produced it.
function buildBrandInfoData(brandName, envName, config, logoUrl, fontFiles = [], resolvedFontFamily = null, colorPalette = {}, avatarUrl = null, sendIconUrl = null, assetsBasePath = './brand-assets') {
  const finalFontFamily = resolvedFontFamily || getResolvedFontFamily(config.widget?.fontFamily, fontFiles);
  const info = {
    brand: brandName,
    environment: envName,
    generatedAt: new Date().toISOString(),
    config: {
      ...config.widget,
      fontFamily: finalFontFamily,
      fontFaces:           getFontFaceDescriptors(fontFiles, finalFontFamily, assetsBasePath),
      header:              config.header || {},
      colors:              colorPalette,
      apiGatewayEndpoint:  config.aws?.apiGatewayEndpoint || '',
      instanceId:          config.aws?.instanceId || '',
      contactFlowId:       config.aws?.contactFlowId || '',
    },
  };

  if (logoUrl || avatarUrl || sendIconUrl) {
    info.assets = {};
    if (logoUrl) info.assets.logo = logoUrl;
    if (avatarUrl) info.assets.avatar = avatarUrl;
    if (sendIconUrl) info.assets.sendIcon = sendIconUrl;
  }

  return info;
}

// Generate brand info file for runtime reference (single-brand mode)
function generateBrandInfo(brandName, envName, config, outputPath, logoUrl, fontFiles = [], resolvedFontFamily = null, colorPalette = {}, avatarUrl = null, sendIconUrl = null) {
  const info = buildBrandInfoData(brandName, envName, config, logoUrl, fontFiles, resolvedFontFamily, colorPalette, avatarUrl, sendIconUrl);

  const content = `/**
 * Current Brand Configuration
 * Auto-generated - Do not edit manually
 */
window.__CHAT_BRAND_INFO__ = ${JSON.stringify(info, null, 2)};
`;

  fs.writeFileSync(outputPath, content);
  console.log(`  ✅ Generated brandInfo.js`);
}

// List every real brand folder name under brands/ (skips _template etc.)
function getAllBrandNames() {
  const brandsDir = path.join(__dirname, '..', 'brands');
  return fs.readdirSync(brandsDir).filter(name => {
    const fullPath = path.join(brandsDir, name);
    return fs.statSync(fullPath).isDirectory() && !name.startsWith('_');
  });
}

// List every env name a brand has a config/env.<env>.json for.
function getBrandEnvNames(brandPath) {
  const configDir = path.join(brandPath, 'config');
  if (!fs.existsSync(configDir)) return [];
  return fs.readdirSync(configDir)
    .filter(name => name.startsWith('env.') && name.endsWith('.json'))
    .map(name => name.replace(/^env\./, '').replace(/\.json$/, ''));
}

// Prepares runtime-resolvable, brand-namespaced output for EVERY brand/env
// combination - the single-build-multi-brand deployment model: one JS bundle
// is deployed everywhere, and the host page (local-testing/hostedWidget.html)
// fetches `brand-assets/<brand>/<env>/brandInfo.json` at runtime once it
// knows which brand it's on (from window.utag_data), instead of a single
// brand's data being baked in ahead of time by the --brand=/--env= mode.
function prepareAllBrands() {
  const localTestingDir = path.join(__dirname, '..', 'local-testing');
  const brandAssetsRoot = path.join(localTestingDir, 'brand-assets');

  console.log('\n🚀 Preparing ALL brands for runtime brand resolution\n');

  const brandNames = getAllBrandNames();
  let brandCount = 0;
  let envCount = 0;

  brandNames.forEach(brandName => {
    const brandPath = path.join(__dirname, '..', 'brands', brandName);
    const envNames = getBrandEnvNames(brandPath);
    if (!envNames.length) {
      console.warn(`  ⚠️ Skipping "${brandName}" - no env.*.json config files found`);
      return;
    }

    const brandOutDir = path.join(brandAssetsRoot, brandName);
    const assetsBasePath = `./brand-assets/${brandName}`;
    const brandThemeSrcDir = path.join(brandPath, 'theme');
    const brandFontsDir = path.join(brandPath, 'Fonts');
    const brandAssetsFontsDir = path.join(brandPath, 'assets', 'fonts');
    const brandAssetsSrcDir = path.join(brandPath, 'assets');

    // Env-independent outputs: brand assets (logo etc.), theme tokens, fonts.
    if (fs.existsSync(brandAssetsSrcDir)) {
      copyDirSync(brandAssetsSrcDir, brandOutDir);
    }
    if (fs.existsSync(brandThemeSrcDir)) {
      copyDirSync(brandThemeSrcDir, path.join(brandOutDir, 'theme'));
    }
    if (fs.existsSync(brandFontsDir)) {
      copyDirSync(brandFontsDir, path.join(brandOutDir, 'Fonts'));
    }
    if (fs.existsSync(brandAssetsFontsDir)) {
      copyDirSync(brandAssetsFontsDir, path.join(brandOutDir, 'Fonts'));
    }

    const fontFiles = getBrandFontFiles(brandPath);
    const logoUrl = getBrandLogoUrl(brandPath, assetsBasePath);
    const avatarUrl = getClientAvatarUrl(brandPath, assetsBasePath);
    const sendIconUrl = getClientSendIconUrl(brandPath, assetsBasePath);
    const colorPalette = getBrandColorPalette(brandThemeSrcDir, {});

    envNames.forEach(envName => {
      const envFile = path.join(brandPath, 'config', `env.${envName}.json`);
      const config = JSON.parse(fs.readFileSync(envFile, 'utf8'));

      const resolvedFontFamily = getResolvedFontFamily(config.widget.fontFamily, fontFiles, brandPath);
      config.widget.fontFamily = resolvedFontFamily;

      const envOutDir = path.join(brandOutDir, envName);
      fs.mkdirSync(envOutDir, {recursive: true});

      const info = buildBrandInfoData(brandName, envName, config, logoUrl, fontFiles, resolvedFontFamily, colorPalette, avatarUrl, sendIconUrl, assetsBasePath);
      fs.writeFileSync(path.join(envOutDir, 'brandInfo.json'), JSON.stringify(info, null, 2));
      envCount += 1;
    });

    console.log(`  ✅ ${brandName} (${envNames.join(', ')})`);
    brandCount += 1;
  });

  console.log(`\n✨ Prepared ${brandCount} brand(s), ${envCount} brand/env combination(s)`);
  console.log('   Output: local-testing/brand-assets/<brand>/<env>/brandInfo.json');
  console.log('   Run "npm run dev" and open local-testing/hostedWidget.html to test\n');
}

// Main execution
function main() {
  const args = parseArgs();

  // Check for help flag
  if (args.help || args.h) {
    console.log(`
Brand Environment Preparation Script

Usage:
  npm run prepare-brand -- --brand=<brand-name> --env=<environment>
  node scripts/prepare-brand.js --brand=<brand-name> --env=<environment>

Options:
  --brand     Brand folder name (required unless --all/--list)
  --env       Environment name: dev, qa, prod, etc. (required unless --all/--list)
  --all       Prepare EVERY brand/env into brand-namespaced output, for the
              single-build runtime-resolution deployment model (see
              local-testing/hostedWidget.html's utag_data bootstrap)
  --list      List all available brands
  --help, -h  Show this help message

Examples:
  npm run prepare-brand -- --brand=abc-corp --env=dev
  npm run prepare-brand -- --brand=xyz-bank --env=prod
  npm run prepare-brand -- --all
  npm run prepare-brand -- --list
`);
    process.exit(0);
  }

  // List brands if requested
  if (args.list) {
    console.log('\n📁 Available Brands:\n');
    listBrands();
    console.log('');
    process.exit(0);
  }

  // Prepare every brand/env into brand-namespaced runtime output
  if (args.all) {
    prepareAllBrands();
    process.exit(0);
  }

  // Validate required arguments
  if (!args.brand || !args.env) {
    console.error('❌ Missing required arguments: --brand and --env\n');
    console.log('Usage: npm run prepare-brand -- --brand=<brand-name> --env=<environment>');
    console.log('Example: npm run prepare-brand -- --brand=abc-corp --env=dev');
    console.log('\nRun with --help for more options');
    process.exit(1);
  }

  const brandName = args.brand;
  const envName = args.env;

  console.log(`\n🚀 Preparing environment for brand: ${brandName} (${envName})\n`);

  // Validate brand and environment
  const {brandPath, envFile} = validateBrandEnv(brandName, envName);

  // Read environment configuration
  const config = JSON.parse(fs.readFileSync(envFile, 'utf8'));

  // Define paths
  const localTestingDir = path.join(__dirname, '..', 'local-testing');
  const brandAssetsDir = path.join(brandPath, 'assets');
  const brandThemeDir = path.join(brandPath, 'theme');
  const brandFontsDir = path.join(brandPath, 'Fonts');
  const brandAssetsFontsDir = path.join(brandPath, 'assets', 'fonts');
  const outputAssetsDir = path.join(localTestingDir, 'brand-assets');

  // Clean previous (flat, single-brand-mode) assets, but preserve any
  // brand-namespaced subdirectories produced by `--all` mode
  // (prepareAllBrands) - both modes share the same output root.
  if (fs.existsSync(outputAssetsDir)) {
    const knownBrandNames = new Set(getAllBrandNames());
    fs.readdirSync(outputAssetsDir, {withFileTypes: true}).forEach(entry => {
      if (knownBrandNames.has(entry.name)) return;
      fs.rmSync(path.join(outputAssetsDir, entry.name), {recursive: true, force: true});
    });
    console.log('  🧹 Cleaned previous brand assets');
  }

  // Copy brand assets
  if (fs.existsSync(brandAssetsDir)) {
    copyDirSync(brandAssetsDir, outputAssetsDir);
    console.log('  ✅ Copied brand assets');
  }

  // Allow overriding colors via CLI (--colorsFile or --primaryColor)
  if (args.colorsFile) {
    const source = path.resolve(args.colorsFile);
    if (fs.existsSync(source)) {
      try {
        fs.mkdirSync(brandThemeDir, {recursive: true});
        fs.copyFileSync(source, path.join(brandThemeDir, 'colors.json'));
        console.log('  ✅ Applied colors file to brand theme');
      } catch (e) {
        console.warn('  ⚠️ Failed to apply colors file:', e.message);
      }
    } else {
      console.warn('  ⚠️ colors file not found:', source);
    }
  } else if (args.primaryColor) {
    const colorsPath = path.join(brandThemeDir, 'colors.json');
    try {
      let colors = {};
      if (fs.existsSync(colorsPath)) colors = JSON.parse(fs.readFileSync(colorsPath,'utf8'));
      colors.primary = colors.primary || {};
      colors.primary['500'] = args.primaryColor;
      fs.mkdirSync(brandThemeDir, {recursive:true});
      fs.writeFileSync(colorsPath, JSON.stringify(colors, null, 2));
      console.log('  ✅ Updated brand primary color to', args.primaryColor);
    } catch (e) {
      console.warn('  ⚠️ Failed to update colors.json', e.message);
    }
  }

  // Copy theme files
  if (fs.existsSync(brandThemeDir)) {
    copyDirSync(brandThemeDir, path.join(outputAssetsDir, 'theme'));
    console.log('  ✅ Copied theme files');
  }

  // Copy font files for brand-specific font families
  if (fs.existsSync(brandFontsDir)) {
    copyDirSync(brandFontsDir, path.join(outputAssetsDir, 'Fonts'));
  }
  if (fs.existsSync(brandAssetsFontsDir)) {
    copyDirSync(brandAssetsFontsDir, path.join(outputAssetsDir, 'Fonts'));
  }
  if (fs.existsSync(brandFontsDir) || fs.existsSync(brandAssetsFontsDir)) {
    console.log('  ✅ Copied font assets');
  }

  const fontFiles = getBrandFontFiles(brandPath);
  let resolvedFontFamily = getResolvedFontFamily(config.widget.fontFamily, fontFiles, brandPath);

  config.widget.fontFamily = resolvedFontFamily;
  console.log('  🔎 Detected font files:', fontFiles.length);
  console.log('  🔎 Font file samples:', fontFiles.slice(0, 4).map(file => file.relativePath).join(', '));
  console.log('  🔎 Resolved font family:', resolvedFontFamily);

  // Generate configuration files
  const logoUrl = getBrandLogoUrl(brandPath);
  const avatarUrl = getClientAvatarUrl(brandPath);
  const sendIconUrl = getClientSendIconUrl(brandPath);
  const colorPalette = getBrandColorPalette(brandThemeDir, config.widget);
  console.log('  🔎 Resolved color palette:', colorPalette);
  generateBrandInfo(brandName, envName, config, path.join(localTestingDir, 'brandInfo.js'), logoUrl, fontFiles, resolvedFontFamily, colorPalette, avatarUrl, sendIconUrl);
  generateBrandThemeCss(config.widget, config.header || {}, path.join(localTestingDir, 'brand-theme.css'), fontFiles, resolvedFontFamily, colorPalette);
  const envStateFile = path.join(__dirname, '..', '.brand-env');
  fs.writeFileSync(envStateFile, JSON.stringify({brand: brandName, env: envName}, null, 2));
  console.log('  ✅ Saved current brand/env state');

  console.log(`\n✨ Environment ready! Brand: ${brandName}, Env: ${envName}`);
  console.log(`   Run "npm run dev" to start the development server\n`);
}

// Run
main();
