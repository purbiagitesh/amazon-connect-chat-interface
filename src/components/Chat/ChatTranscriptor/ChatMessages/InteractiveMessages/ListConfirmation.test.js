import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import ListConfirmation from "./ListConfirmation";

function renderCard(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <ListConfirmation addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("ListConfirmation", () => {
  it("renders the order header, divider, and every product row", () => {
    renderCard();

    expect(screen.getByText("Order No. 00000")).toBeInTheDocument();
    expect(screen.getByText("Placed on: December 1, 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Product Name")).toHaveLength(5);
    expect(screen.getByText(/Shade: Rose/)).toBeInTheDocument();
  });

  it("submits a message when Yes is clicked", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("list-confirmation-yes"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Yes, order 00000 is correct" })
    );
  });

  it("submits a message when No is clicked", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("list-confirmation-no"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "No, order 00000 is not correct" })
    );
  });

  it("falls back to runtime content.order instead of mock data when provided", () => {
    renderCard({
      content: {
        order: {
          orderNumber: "99999",
          orderDate: "June 1, 2026",
          products: [{ name: "Runtime Product", size: "1 oz", qty: 2 }],
        },
      },
    });

    expect(screen.getByText("Order No. 99999")).toBeInTheDocument();
    expect(screen.queryByText("Order No. 00000")).not.toBeInTheDocument();
  });
});
