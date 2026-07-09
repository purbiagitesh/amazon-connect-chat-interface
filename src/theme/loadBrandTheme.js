import fs from 'fs';
import path from 'path';
import merge from 'lodash/merge';

function mergeBrandColors(defaultTheme, colors) {
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

// Try to load a brand's colors synchronously at build-time (Node).
function loadBrandThemeSync(defaultTheme, brandName) {
  if (!brandName) return defaultTheme;

  try {
    const colorsPath = path.join(process.cwd(), 'brands', brandName, 'theme', 'colors.json');
    if (fs.existsSync(colorsPath)) {
      const colors = JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
      return mergeBrandColors(defaultTheme, colors);
    }
  } catch (e) {
    // swallow errors and return default
  }

  return defaultTheme;
}

// Browser runtime helper: fetch colors from prepared brand assets (if present)
async function loadBrandThemeBrowser(defaultTheme, url = '/brand-assets/theme/colors.json') {
  try {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return defaultTheme;
    const res = await fetch(url, {cache: 'no-store'});
    if (!res.ok) return defaultTheme;
    const colors = await res.json();
    return mergeBrandColors(defaultTheme, colors);
  } catch (e) {
    return defaultTheme;
  }
}

export {
  mergeBrandColors,
  loadBrandThemeSync,
  loadBrandThemeBrowser
};
