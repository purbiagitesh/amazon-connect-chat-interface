import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import ListSelectionStepper from "./ListSelectionStepper";

function renderCard(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <ListSelectionStepper addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("ListSelectionStepper", () => {
  it("hides the stepper until its product is checked, then reveals it at qty 1", () => {
    renderCard();

    expect(screen.queryByTestId("list-selection-stepper-qty-p2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("list-selection-stepper-checkbox-p2"));

    expect(screen.getByTestId("list-selection-stepper-qty-p2")).toBeInTheDocument();
    expect(screen.getByText(/of 2 Damaged/)).toBeInTheDocument();
  });

  it("locks the stepper at 1 when purchased qty is 1", () => {
    renderCard();

    fireEvent.click(screen.getByTestId("list-selection-stepper-checkbox-p1"));

    expect(screen.getByTestId("list-selection-stepper-qty-p1-decrement")).toBeDisabled();
    expect(screen.getByTestId("list-selection-stepper-qty-p1-increment")).toBeDisabled();
  });

  it("keeps Confirm disabled until a product is selected", () => {
    renderCard();
    expect(screen.getByTestId("list-selection-stepper-confirm")).toBeDisabled();

    fireEvent.click(screen.getByTestId("list-selection-stepper-checkbox-p2"));
    expect(screen.getByTestId("list-selection-stepper-confirm")).not.toBeDisabled();
  });

  it("submits selected products with their quantities, all in one message", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("list-selection-stepper-checkbox-p2"));
    fireEvent.click(screen.getByTestId("list-selection-stepper-qty-p2-increment"));
    fireEvent.click(screen.getByTestId("list-selection-stepper-checkbox-p3"));
    fireEvent.click(screen.getByTestId("list-selection-stepper-confirm"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Sample of Long Product Name\nQty: 2\n\nProduct Name\nQty: 1",
      })
    );
  });

  it("submits immediately when None of it is clicked", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("list-selection-stepper-secondary"));

    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ text: "None of it" }));
  });
});
