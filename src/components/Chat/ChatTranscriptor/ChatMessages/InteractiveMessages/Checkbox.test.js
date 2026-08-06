import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "../../../../../theme";
import Checkbox from "./Checkbox";

function renderCheckbox(props = {}) {
  const onChange = jest.fn();
  render(
    <ThemeProvider>
      <Checkbox checked={false} onChange={onChange} testId="cb" {...props} />
    </ThemeProvider>
  );
  return { onChange };
}

describe("Checkbox", () => {
  it("renders unchecked by default and toggles onChange when clicked", () => {
    const { onChange } = renderCheckbox();

    const input = screen.getByTestId("cb");
    expect(input).not.toBeChecked();

    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reflects a checked prop", () => {
    renderCheckbox({ checked: true });
    expect(screen.getByTestId("cb")).toBeChecked();
  });

  it("does not fire onChange when disabled", () => {
    // userEvent (not fireEvent) is required here: it replicates the browser's
    // real disabled-element activation suppression, which fireEvent's raw
    // dispatchEvent bypasses in jsdom.
    const { onChange } = renderCheckbox({ disabled: true });
    userEvent.click(screen.getByTestId("cb"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
