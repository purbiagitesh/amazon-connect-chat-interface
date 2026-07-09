import {createGlobalStyle} from 'styled-components'

// Browsers use the first src they can load, not the smallest, so list
// formats in size-preference order regardless of the order they arrive in.
const FONT_FORMAT_PRIORITY = ['woff2', 'woff', 'opentype', 'truetype'];

/**
 * Builds @font-face rules from the brand's font descriptors
 * (brands/<brand>/assets/fonts/..., resolved by scripts/prepare-brand.js).
 * Rendered via styled-components so the rules land in whichever document
 * the widget is mounted in, since the widget's iframe never loads the host
 * page's brand-theme.css.
 */
export function buildFontFaceCss(fontFaces) {
  if (!Array.isArray(fontFaces) || !fontFaces.length) {
    return '';
  }

  // Group by family + weight + style so each distinct font file (Bold,
  // Light, Medium, ...) gets its own @font-face rule. Squashing every weight
  // into one rule makes the browser silently pick just one file for all text.
  const byGroup = fontFaces.reduce((acc, face) => {
    if (!face || !face.family || !face.url) {
      return acc;
    }
    const weight = face.weight || 'normal';
    const style = face.style || 'normal';
    const key = `${face.family}|${weight}|${style}`;
    acc[key] = acc[key] || {family: face.family, weight, style, faces: []};
    acc[key].faces.push(face);
    return acc;
  }, {});

  return Object.keys(byGroup).map(key => {
    const {family, weight, style, faces} = byGroup[key];
    const sources = [...faces]
      .sort((a, b) => FONT_FORMAT_PRIORITY.indexOf(a.format) - FONT_FORMAT_PRIORITY.indexOf(b.format))
      .map(face => `url('${face.url}') format('${face.format || 'truetype'}')`)
      .join(',\n       ');
    return `@font-face {\n  font-family: '${family}';\n  src: ${sources};\n  font-weight: ${weight};\n  font-style: ${style};\n}`;
  }).join('\n\n');
}

const Fonts = createGlobalStyle`
  ${props => buildFontFaceCss(props.fontFaces)}
`;

export default Fonts;
