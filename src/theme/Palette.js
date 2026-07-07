import defaultTheme from './defaultTheme';

const Palette = {
  colors: {},
  palette: {},
  globals: {},
  color: {},
  theme: {},
  setTheme(nextTheme) {
    const theme = Object.assign({}, defaultTheme, nextTheme || {});

    // Preserve references for imported usage
    Object.keys(this.colors).forEach(key => delete this.colors[key]);
    Object.keys(this.palette).forEach(key => delete this.palette[key]);
    Object.keys(this.globals).forEach(key => delete this.globals[key]);
    Object.keys(this.color).forEach(key => delete this.color[key]);
    Object.keys(this.theme).forEach(key => delete this.theme[key]);

    Object.assign(this.colors, theme.colors || {});
    Object.assign(this.palette, theme.palette || {});
    Object.assign(this.globals, theme.globals || {});
    Object.assign(this.color, theme.color || {});
    Object.assign(this.theme, theme);
  }
};

Palette.setTheme(defaultTheme);

export default Palette;
