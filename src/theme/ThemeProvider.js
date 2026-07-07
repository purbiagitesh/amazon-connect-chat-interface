import React, {Component} from 'react';
import {ThemeProvider as StyledThemeProvider} from 'styled-components';
import defaultTheme from './defaultTheme';
import Palette from './Palette';
import PT from 'prop-types';
import {loadClientThemeBrowser} from './loadClientTheme';

export default class ThemeProvider extends Component {

  static propTypes = {
    children: PT.node.isRequired,
    theme: PT.objectOf(PT.object)
  }

  static defaultProps = {
    theme: defaultTheme
  }

  constructor(props) {
    super(props);
    const initialTheme = props.theme || defaultTheme;
    this.state = {
      theme: initialTheme
    };
    Palette.setTheme(initialTheme);
  }

  async componentDidMount() {
    // If a theme prop is explicitly provided, keep it and update global palette
    if (this.props.theme) {
      Palette.setTheme(this.props.theme);
      return;
    }

    try {
      const merged = await loadClientThemeBrowser(defaultTheme);
      this.setState({theme: merged});
      Palette.setTheme(merged);
    } catch (e) {
      // ignore and keep default theme
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.theme && this.props.theme !== prevProps.theme) {
      Palette.setTheme(this.props.theme);
    }
  }

  render() {
    const {children} = this.props;
    const theme = this.props.theme || this.state.theme;
    return (
      <StyledThemeProvider theme={theme}>
        {children}
      </StyledThemeProvider>
    )
  }
}