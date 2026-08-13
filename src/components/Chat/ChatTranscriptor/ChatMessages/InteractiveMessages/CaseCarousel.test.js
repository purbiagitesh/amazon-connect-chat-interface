import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import CaseCarousel from "./CaseCarousel";

function renderCarousel(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <CaseCarousel addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("CaseCarousel", () => {
  it("renders a case card per element with a parseable date | type subtitle", () => {
    renderCarousel();

    expect(screen.getByTestId("case-card-16153037")).toBeInTheDocument();
    expect(screen.getByTestId("case-card-16153036")).toBeInTheDocument();
    expect(screen.getByText("Case No. 16153037")).toBeInTheDocument();
    expect(screen.getAllByText("Date: July 24, 2026").length).toBe(2);
    expect(screen.getByText("Change Order")).toBeInTheDocument();
    expect(screen.getByText("Cancel Order")).toBeInTheDocument();
    expect(screen.getAllByText("Related to:").length).toBe(2);
  });

  it("shows a single Select this Case button with no expand toggle", () => {
    renderCarousel();
    const card = screen.getByTestId("case-card-16153037");

    expect(within(card).getByTestId("case-card-16153037-select")).toHaveTextContent("Select this Case");
    expect(within(card).queryByTestId("case-card-16153037-toggle")).not.toBeInTheDocument();
  });

  it("renders elements without a parseable subtitle as a fallback CTA showing a shortened label, not a case card", () => {
    renderCarousel();

    expect(screen.getByTestId("case-card-empty")).toBeInTheDocument();
    expect(screen.getByText("Something else")).toBeInTheDocument();
    expect(screen.queryByText("Help With Something Else")).not.toBeInTheDocument();
  });

  it("still sends the VA's original element title as the reply when the fallback CTA is clicked", () => {
    const { addMessage } = renderCarousel();

    fireEvent.click(screen.getByText("Something else"));

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Help With Something Else" })
    );
  });

  it("sends the element title back as plain text on select, matching ListPicker's own reply shape", () => {
    const { addMessage } = renderCarousel();

    fireEvent.click(screen.getByTestId("case-card-16153037-select"));

    expect(addMessage).toHaveBeenCalledWith(expect.objectContaining({ text: "16153037" }));
    expect(screen.getByTestId("case-card-16153036-select")).toBeDisabled();
  });

  it("keeps the previous-card nav button disabled at the start of the carousel", () => {
    renderCarousel();

    expect(screen.getByTestId("case-carousel-prev")).toBeDisabled();
    expect(screen.getByTestId("case-carousel-next")).not.toBeDisabled();
  });

  it("falls back to runtime content.elements instead of mock data when provided", () => {
    renderCarousel({
      content: {
        elements: [{ title: "99999", subtitle: "2026-06-01T10:00:00.000+0000 | return item" }],
      },
    });

    expect(screen.getByText("Case No. 99999")).toBeInTheDocument();
    expect(screen.getByText("Return Item")).toBeInTheDocument();
    expect(screen.queryByText("Case No. 16153037")).not.toBeInTheDocument();
  });
});
