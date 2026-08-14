import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import SingleProduct from "./SingleProduct";

function renderCard(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <SingleProduct addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("SingleProduct", () => {
  it("renders the product name link, price, and shade", () => {
    renderCard();

    const link = screen.getByTestId("single-product-link");
    expect(link).toHaveTextContent("Pure Color Melt-On Glosstick Lip Gloss");
    expect(link).toHaveAttribute(
      "href",
      "https://www.esteelauder.com/product/pure-color-melt-on-glosstick"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("$38.00")).toBeInTheDocument();
    expect(screen.getByText("890 Melted Tangerine")).toBeInTheDocument();
  });

  it("falls back to size when shade is not provided", () => {
    renderCard({
      content: {
        product: {
          name: "Runtime Product",
          url: "https://example.com/product",
          price: "$10.00",
          size: "1.7 oz",
        },
      },
    });

    expect(screen.getByText("1.7 oz")).toBeInTheDocument();
    expect(screen.queryByText("890 Melted Tangerine")).not.toBeInTheDocument();
  });

  it("submits a message when Yes is clicked", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("single-product-yes"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Yes, that's the product I'm looking for" })
    );
  });

  it("submits a message when No is clicked", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("single-product-no"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "No, that's not the product I'm looking for" })
    );
  });

  it("falls back to runtime content.product instead of mock data when provided", () => {
    renderCard({
      content: {
        product: {
          name: "Runtime Product",
          url: "https://example.com/product",
          price: "$10.00",
          shade: "Rose",
        },
      },
    });

    expect(screen.getByText("Runtime Product")).toBeInTheDocument();
    expect(screen.queryByText("Pure Color Melt-On Glosstick Lip Gloss")).not.toBeInTheDocument();
  });
});
