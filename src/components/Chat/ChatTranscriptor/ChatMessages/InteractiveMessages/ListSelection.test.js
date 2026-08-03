import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import ListSelection from "./ListSelection";

function renderCard(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <ListSelection addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("ListSelection", () => {
  it("renders the title, subtitle, and a checkbox per product", () => {
    renderCard();

    expect(screen.getByText("Which items are missing?")).toBeInTheDocument();
    expect(screen.getByText("Select all that apply.")).toBeInTheDocument();
    expect(screen.getByTestId("list-selection-checkbox-p1")).toBeInTheDocument();
    expect(screen.getByTestId("list-selection-checkbox-p5")).toBeInTheDocument();
  });

  it("keeps Confirm disabled until at least one item is checked", () => {
    renderCard();

    expect(screen.getByTestId("list-selection-confirm")).toBeDisabled();

    fireEvent.click(screen.getByTestId("list-selection-checkbox-p1"));
    expect(screen.getByTestId("list-selection-confirm")).not.toBeDisabled();
  });

  it("submits the checked product names, comma-joined, on Confirm", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("list-selection-checkbox-p1"));
    fireEvent.click(screen.getByTestId("list-selection-checkbox-p2"));
    fireEvent.click(screen.getByTestId("list-selection-confirm"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Product Name, Product Name" })
    );
  });

  it("'All of it' checks every box but requires an explicit Confirm click to submit", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("list-selection-secondary"));
    expect(addMessage).not.toHaveBeenCalled();
    expect(screen.getByTestId("list-selection-confirm")).not.toBeDisabled();
    expect(screen.getByTestId("list-selection-checkbox-p1")).toBeChecked();
    expect(screen.getByTestId("list-selection-checkbox-p5")).toBeChecked();
  });

  it("'None of it' submits immediately when configured as the secondary CTA", () => {
    const { addMessage } = renderCard({
      content: {
        title: "Which items are damaged?",
        subtitle: "Select all that apply.",
        products: [{ id: "p1", name: "Product Name", size: "1.7 oz", qty: 1 }],
        secondaryCta: { type: "none", label: "None of it" },
      },
    });

    fireEvent.click(screen.getByTestId("list-selection-secondary"));

    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ text: "None of it" }));
  });
});
