import fs from 'fs';
import path from 'path';
import merge from 'lodash/merge';

function mergeClientColors(defaultTheme, colors) {
  const theme = merge({}, defaultTheme, { colors });

  // Map useful aliases into theme.color for convenient access (shallow)
  try {
    if (colors && colors.primary && colors.primary['500']) {
      theme.color = Object.assign({}, defaultTheme.color, { primary: colors.primary['500'] });
    }

    if (colors && colors.secondary && colors.secondary['500']) {
      theme.color = Object.assign({}, theme.color || defaultTheme.color, { secondary: colors.secondary['500'] });
    }
  } catch (e) {
    // ignore mapping errors
  }

  return theme;
}

// Try to load a client's colors synchronously at build-time (Node).
function loadClientThemeSync(defaultTheme, clientName) {
  if (!clientName) return defaultTheme;

  try {
    const colorsPath = path.join(process.cwd(), 'clients', clientName, 'theme', 'colors.json');
    if (fs.existsSync(colorsPath)) {
      const colors = JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
      return mergeClientColors(defaultTheme, colors);
    }
  } catch (e) {
    // swallow errors and return default
  }

  return defaultTheme;
}

// Browser runtime helper: fetch colors from prepared client assets (if present)
async function loadClientThemeBrowser(defaultTheme, url = '/client-assets/theme/colors.json') {
  try {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return defaultTheme;
    const res = await fetch(url, {cache: 'no-store'});
    if (!res.ok) return defaultTheme;
    const colors = await res.json();
    return mergeClientColors(defaultTheme, colors);
  } catch (e) {
    return defaultTheme;
  }
}

export {
  mergeClientColors,
  loadClientThemeSync,
  loadClientThemeBrowser
};
