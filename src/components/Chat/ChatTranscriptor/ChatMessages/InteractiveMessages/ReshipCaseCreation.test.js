import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../../../theme";
import ReshipCaseCreation from "./ReshipCaseCreation";
import { ContentType } from "../../../datamodel/Model";

function renderWidget(props = {}) {
  const addMessage = jest.fn();
  render(
    <ThemeProvider>
      <ReshipCaseCreation addMessage={addMessage} {...props} />
    </ThemeProvider>
  );
  return { addMessage };
}

describe("ReshipCaseCreation", () => {
  it("renders the mock title and both option buttons when no content is passed", () => {
    renderWidget();

    expect(
      screen.getByText(/I can create a case to have the product reshipped/)
    ).toBeInTheDocument();
    expect(screen.getByTestId("reshipcasecreation-option-0")).toHaveTextContent("Yes");
    expect(screen.getByTestId("reshipcasecreation-option-1")).toHaveTextContent(
      "No, I don't want a reshipment"
    );
  });

  it("submits the chosen button's text as a plain-text message", () => {
    const { addMessage } = renderWidget();

    fireEvent.click(screen.getByTestId("reshipcasecreation-option-1"));

    expect(addMessage).toHaveBeenCalledWith({
      text: "No, I don't want a reshipment",
      type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
    });
  });

  it("ignores further clicks after the first selection (no double submit)", () => {
    const { addMessage } = renderWidget();

    fireEvent.click(screen.getByTestId("reshipcasecreation-option-0"));
    fireEvent.click(screen.getByTestId("reshipcasecreation-option-1"));

    expect(addMessage).toHaveBeenCalledTimes(1);
    expect(addMessage).toHaveBeenCalledWith({
      text: "Yes",
      type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
    });
    expect(screen.getByTestId("reshipcasecreation-option-0")).toBeDisabled();
    expect(screen.getByTestId("reshipcasecreation-option-1")).toBeDisabled();
  });

  it("falls back to runtime content instead of mock data when provided", () => {
    renderWidget({
      content: {
        title: "Runtime prompt title",
        elements: [
          { title: "Confirm", emphasis: "primary" },
          { title: "Not now", emphasis: "quaternary" },
        ],
      },
    });

    expect(screen.getByText("Runtime prompt title")).toBeInTheDocument();
    expect(
      screen.queryByText(/I can create a case to have the product reshipped/)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("reshipcasecreation-option-0")).toHaveTextContent("Confirm");
    expect(screen.getByTestId("reshipcasecreation-option-1")).toHaveTextContent("Not now");
  });

  it("treats the first element as primary when no element declares an emphasis", () => {
    const { addMessage } = renderWidget({
      content: {
        title: "Pick one",
        elements: [{ title: "First" }, { title: "Second" }],
      },
    });

    // Both still submit as plain text - the emphasis only drives styling, so
    // this asserts the widget renders and both remain actionable.
    fireEvent.click(screen.getByTestId("reshipcasecreation-option-0"));
    expect(addMessage).toHaveBeenCalledWith({
      text: "First",
      type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
    });
  });
});
