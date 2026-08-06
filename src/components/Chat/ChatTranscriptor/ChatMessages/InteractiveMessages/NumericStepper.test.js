import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import NumericStepper from "./NumericStepper";

function renderStepper(props = {}) {
  const onChange = jest.fn();
  render(
    <ThemeProvider>
      <NumericStepper value={1} max={3} onChange={onChange} testId="stepper" label="Damaged" {...props} />
    </ThemeProvider>
  );
  return { onChange };
}

describe("NumericStepper", () => {
  it("renders the current value and max in the label", () => {
    renderStepper();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/of 3 Damaged/)).toBeInTheDocument();
  });

  it("disables decrement at the floor and increments/decrements within range", () => {
    const { onChange } = renderStepper({ value: 1 });
    expect(screen.getByTestId("stepper-decrement")).toBeDisabled();
    expect(screen.getByTestId("stepper-increment")).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("stepper-increment"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("disables increment at the ceiling", () => {
    renderStepper({ value: 3, max: 3 });
    expect(screen.getByTestId("stepper-increment")).toBeDisabled();
    expect(screen.getByTestId("stepper-decrement")).not.toBeDisabled();
  });

  it("locks both directions when max equals min (purchased qty of 1)", () => {
    renderStepper({ value: 1, max: 1 });
    expect(screen.getByTestId("stepper-decrement")).toBeDisabled();
    expect(screen.getByTestId("stepper-increment")).toBeDisabled();
  });
});
