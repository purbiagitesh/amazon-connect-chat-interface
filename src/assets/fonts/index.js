import {createGlobalStyle} from 'styled-components'

/**
 * Builds @font-face rules from the client's font descriptors
 * (clients/<brand>/assets/fonts/..., resolved by scripts/prepare-client.js).
 * Rendered via styled-components so the rules land in whichever document
 * the widget is mounted in, since the widget's iframe never loads the host
 * page's client-theme.css.
 */
export function buildFontFaceCss(fontFaces) {
  if (!Array.isArray(fontFaces) || !fontFaces.length) {
    return '';
  }

  const byFamily = fontFaces.reduce((acc, face) => {
    if (!face || !face.family || !face.url) {
      return acc;
    }
    acc[face.family] = acc[face.family] || [];
    acc[face.family].push(face);
    return acc;
  }, {});

  return Object.keys(byFamily).map(family => {
    const sources = byFamily[family]
      .map(face => `url('${face.url}') format('${face.format || 'truetype'}')`)
      .join(',\n       ');
    return `@font-face {\n  font-family: '${family}';\n  src: ${sources};\n  font-weight: normal;\n  font-style: normal;\n}`;
  }).join('\n\n');
}

const Fonts = createGlobalStyle`
  ${props => buildFontFaceCss(props.fontFaces)}
`;

export default Fonts;
