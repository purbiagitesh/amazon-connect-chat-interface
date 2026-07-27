import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import OrderCarousel from "./OrderCarousel";

function renderCarousel(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <OrderCarousel addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("OrderCarousel", () => {
  it("renders an order card per order plus a trailing empty card", () => {
    renderCarousel();

    expect(screen.getByTestId("order-card-order-00000")).toBeInTheDocument();
    expect(screen.getByTestId("order-card-order-11111")).toBeInTheDocument();
    expect(screen.getByTestId("order-card-empty")).toBeInTheDocument();
    expect(screen.getByText("Order No. 00000")).toBeInTheDocument();
    expect(screen.getByText("Placed on: May 5, 2026")).toBeInTheDocument();
    expect(screen.getByText("Can't find your order?")).toBeInTheDocument();
  });

  it("shows only the first two products until Show all items is toggled", () => {
    renderCarousel();
    const card = screen.getByTestId("order-card-order-00000");

    expect(within(card).getAllByText("Product Name").length).toBe(2);
    expect(within(card).queryByText("Sample of Long Product Name")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("order-card-order-00000-toggle"));

    expect(screen.getByText("Hide all items")).toBeInTheDocument();
    expect(within(card).getAllByText(/Product Name/).length).toBe(6);
  });

  it("disables the other cards once one order is selected", () => {
    const { addMessage } = renderCarousel();

    fireEvent.click(screen.getByTestId("order-card-order-00000-select"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Selected order 00000" })
    );
    expect(screen.getByTestId("order-card-order-11111-select")).toBeDisabled();
    expect(screen.getByTestId("order-card-empty-enter")).toBeDisabled();
    expect(screen.getByTestId("order-card-order-00000-select")).not.toBeDisabled();
  });

  it("keeps the previous-card nav button disabled at the start of the carousel", () => {
    renderCarousel();

    expect(screen.getByTestId("order-carousel-prev")).toBeDisabled();
    expect(screen.getByTestId("order-carousel-next")).not.toBeDisabled();
  });

  it("falls back to runtime content.orders instead of mock data when provided", () => {
    renderCarousel({
      content: {
        orders: [
          {
            id: "order-99999",
            orderNumber: "99999",
            orderDate: "June 1, 2026",
            products: [{ name: "Runtime Product", size: "1 oz", qty: 2 }],
          },
        ],
      },
    });

    expect(screen.getByText("Order No. 99999")).toBeInTheDocument();
    expect(screen.queryByText("Order No. 00000")).not.toBeInTheDocument();
  });
});
