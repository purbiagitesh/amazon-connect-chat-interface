import renderer from 'react-test-renderer';
import React from 'react';
import "jest-styled-components"
import {ThemeProvider} from 'styled-components';
import {defaultTheme} from '../../src/theme';
import Enzyme, {shallow, render, mount} from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import regeneratorRuntime from "regenerator-runtime";
import '@testing-library/jest-dom'

Enzyme.configure({adapter: new Adapter()});

// jsdom has no ResizeObserver implementation, so any component using it
// (e.g. ChatTranscriptScroller.js) throws as soon as it mounts in tests.
// This stub never actually fires - it only lets those components render.
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function createNodeMock(element) {
  return {
    scrollTo: jest.fn()
  }
}

const createTree = (Component, themeOverride) => {
  const theme = themeOverride || defaultTheme;
  const ComponentWithTheme = React.cloneElement(
    Component,
    {theme},
  );
  return renderer.create(ComponentWithTheme, {createNodeMock}).toJSON();
};

global.createTree = createTree;
global.shallow = shallow;