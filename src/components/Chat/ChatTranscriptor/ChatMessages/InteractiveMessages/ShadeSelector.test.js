import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import ShadeSelector from "./ShadeSelector";

function renderCard(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <ShadeSelector addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("ShadeSelector", () => {
  it("renders the header and pre-selects the first shade in the trigger", () => {
    renderCard();

    expect(screen.getByText("Which shade are you looking for?")).toBeInTheDocument();
    expect(screen.getByText("Select one of the options.")).toBeInTheDocument();
    expect(screen.getByTestId("shade-selector-trigger")).toHaveTextContent("812 Change the World");
    expect(screen.queryByTestId("shade-selector-listbox")).not.toBeInTheDocument();
  });

  it("expands the dropdown to show every shade option when the trigger is clicked", () => {
    renderCard();

    fireEvent.click(screen.getByTestId("shade-selector-trigger"));

    expect(screen.getByTestId("shade-selector-listbox")).toBeInTheDocument();
    expect(screen.getByTestId("shade-selector-trigger")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("shade-selector-option-s2")).toHaveTextContent("333 Persuasive");
    expect(screen.getByTestId("shade-selector-option-s6")).toHaveTextContent("620 Ecru Beige");
  });

  it("updates the trigger and closes the dropdown when a different shade is selected", () => {
    renderCard();

    fireEvent.click(screen.getByTestId("shade-selector-trigger"));
    fireEvent.click(screen.getByTestId("shade-selector-option-s3"));

    expect(screen.getByTestId("shade-selector-trigger")).toHaveTextContent("421 Stay Neutral");
    expect(screen.queryByTestId("shade-selector-listbox")).not.toBeInTheDocument();
  });

  it("submits the pre-selected shade's name when Confirm is clicked without changing the selection", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("shade-selector-confirm"));

    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ text: "812 Change the World" }));
  });

  it("submits the newly selected shade's name when Confirm is clicked", () => {
    const { addMessage } = renderCard();

    fireEvent.click(screen.getByTestId("shade-selector-trigger"));
    fireEvent.click(screen.getByTestId("shade-selector-option-s4"));
    fireEvent.click(screen.getByTestId("shade-selector-confirm"));

    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ text: "220 Wheat" }));
  });

  it("closes the dropdown when Escape is pressed on the trigger", () => {
    renderCard();

    fireEvent.click(screen.getByTestId("shade-selector-trigger"));
    expect(screen.getByTestId("shade-selector-listbox")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId("shade-selector-trigger"), { key: "Escape" });

    expect(screen.queryByTestId("shade-selector-listbox")).not.toBeInTheDocument();
  });

  it("closes the dropdown when clicking outside of it", () => {
    renderCard();

    fireEvent.click(screen.getByTestId("shade-selector-trigger"));
    expect(screen.getByTestId("shade-selector-listbox")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId("shade-selector-listbox")).not.toBeInTheDocument();
  });

  it("omits the swatch for a shade with no color data, showing the name only", () => {
    renderCard({
      content: {
        title: "Which shade are you looking for?",
        subtitle: "Select one of the options.",
        shades: [{ id: "r1", name: "No Swatch Shade" }],
      },
    });

    expect(screen.getByTestId("shade-selector-trigger")).toHaveTextContent("No Swatch Shade");
  });

  it("falls back to runtime content instead of mock data when provided", () => {
    renderCard({
      content: {
        title: "Runtime title",
        subtitle: "Runtime subtitle",
        shades: [{ id: "r1", name: "Runtime Shade", color: "#000000" }],
      },
    });

    expect(screen.getByText("Runtime title")).toBeInTheDocument();
    expect(screen.getByTestId("shade-selector-trigger")).toHaveTextContent("Runtime Shade");
    expect(screen.queryByText("Which shade are you looking for?")).not.toBeInTheDocument();
  });
});
