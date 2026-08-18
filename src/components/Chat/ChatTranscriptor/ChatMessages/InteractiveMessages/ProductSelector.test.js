import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import ProductSelector from "./ProductSelector";

function renderCard(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <ProductSelector addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("ProductSelector", () => {
  it("renders the header and every product's name, price, and shade/size count", () => {
    renderCard();

    expect(screen.getByText("Which product are you checking?")).toBeInTheDocument();
    expect(screen.getByText("Select one of the options.")).toBeInTheDocument();
    expect(screen.getAllByText("$52.00")).toHaveLength(2);
    expect(screen.getAllByText("$52.00 - $120.00")).toHaveLength(2);
    expect(screen.getAllByText("5 Shades")).toHaveLength(2);
    expect(screen.getByText("2 Sizes")).toBeInTheDocument();
  });

  it("renders product names as new-tab links to their product page", () => {
    renderCard();

    const link = screen.getByTestId("product-selector-link-p1");
    expect(link).toHaveTextContent("Double Wear Soft Glow Matte Cushion Makeup SPF 36 + Refill");
    expect(link).toHaveAttribute(
      "href",
      "https://www.esteelauder.com/product/double-wear-soft-glow-matte-cushion"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("disables Check availability until a product is selected", () => {
    renderCard();

    expect(screen.getByTestId("product-selector-check-availability")).toBeDisabled();

    fireEvent.click(screen.getByTestId("product-selector-radio-p2"));

    expect(screen.getByTestId("product-selector-check-availability")).toBeEnabled();
  });

  it("submits the selected product's name when Check availability is clicked", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("product-selector-radio-p3"));
    fireEvent.click(screen.getByTestId("product-selector-check-availability"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Double Wear Maximum Cover Camouflage Foundation for Face and Body SPF 15",
      })
    );
  });

  it("submits a message when Enter another product is clicked, regardless of selection", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("product-selector-enter-another"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Enter another product" })
    );
  });

  it("only allows one product selected at a time", () => {
    renderCard();

    fireEvent.click(screen.getByTestId("product-selector-radio-p1"));
    fireEvent.click(screen.getByTestId("product-selector-radio-p2"));

    expect(screen.getByTestId("product-selector-radio-p1")).not.toBeChecked();
    expect(screen.getByTestId("product-selector-radio-p2")).toBeChecked();
  });

  it("falls back to runtime content instead of mock data when provided", () => {
    renderCard({
      content: {
        title: "Runtime title",
        subtitle: "Runtime subtitle",
        products: [
          {
            id: "r1",
            name: "Runtime Product",
            url: "https://example.com/product",
            priceMin: 10,
            priceMax: 10,
            shadeCount: 1,
          },
        ],
      },
    });

    expect(screen.getByText("Runtime title")).toBeInTheDocument();
    expect(screen.getByText("Runtime Product")).toBeInTheDocument();
    expect(screen.queryByText("Which product are you checking?")).not.toBeInTheDocument();
  });
});
