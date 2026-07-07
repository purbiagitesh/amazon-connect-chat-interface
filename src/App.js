import React from "react";
import {ThemeProvider} from "./theme";
import styled from "styled-components";

import ChatContainer from "./components/Chat/ChatContainer";
import Fonts from "./assets/fonts";

import defaultTheme from './theme/defaultTheme';

const Page = styled.div`
  width: 300px;
  font-family: var(--ac-widget-global-typeface, ${props => props.theme.globals.bodyFontFamily});

  margin: ${props => props.theme.spacing.base};
  border-collapse: collapse;
  box-shadow: 0px 2px 3px ${props => props.theme.palette.alto};

  box-sizing: border-box;

  *, *:before, *:after {
    box-sizing: inherit;
  }
`;


const AppProvider = props => {
  const theme = props.themeConfig && Object.keys(props.themeConfig).length
    ? Object.assign({}, defaultTheme, props.themeConfig)
    : undefined;

  return (
    <ThemeProvider theme={theme}>
      {props.children}
    </ThemeProvider>
  );
};

App.defaultProps = {
  baseCssClass: "connect-customer-interface"
};

function App({baseCssClass, fontFaces, ...props}) {
  return (
    <AppProvider themeConfig={props.themeConfig || {}}>
      <Fonts fontFaces={fontFaces} />
      <Page className={baseCssClass}>
        <ChatContainer {...props}/>
      </Page>
    </AppProvider>
  );
}

export default App;
