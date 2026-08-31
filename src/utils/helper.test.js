import {
  createInteractiveMessagePayload,
  INTERACTIVE_MESSAGE_CONSTRAINTS,
  truncateElementFromLimit,
  truncateStrFromCharLimit,
  constructGuidesRendererUrl,
  setupGuidesRenderer,
  safeParseInteractiveMessageJSON,
  isRatingQuickReply,
  isFeedbackFlowQuickReply,
  getQuickReplyElementRatingValue,
  flattenFeedbackQuickReplyResponse,
} from "./helper";
import {ContentType, InteractiveMessageType, QuickReplyDisplayStyle} from "../components/Chat/datamodel/Model";

describe("createInteractiveMessagePayload addMessage helper", () => {
  const MOCK_TEMPLATE_IDENTIFIER = "pickerList001";
  const MOCK_PICKER_TITLE = "Hotels";
  const MOCK_PICKER_SELECTION = "Learn More";

  it("should format Panel message response", () => {
    const IS_PICKER_IN_CAROUSEL = false;

    const interactiveMessagePayload = createInteractiveMessagePayload(
      {title: MOCK_PICKER_SELECTION},
      "preIndex",
      "nextIndex",
      MOCK_TEMPLATE_IDENTIFIER,
      "referenceId",
      "Panel",
      IS_PICKER_IN_CAROUSEL,
      MOCK_TEMPLATE_IDENTIFIER,
      MOCK_PICKER_TITLE,
      undefined
    );
    expect(interactiveMessagePayload).toEqual({
      text: MOCK_PICKER_SELECTION,
    });
  });

  it("should format Carousel message response", () => {
    const IS_PICKER_IN_CAROUSEL = true;

    const interactiveMessagePayload = createInteractiveMessagePayload(
      {title: MOCK_PICKER_SELECTION},
      "preIndex",
      "nextIndex",
      "listId",
      "Panel",
      "referenceId",
      IS_PICKER_IN_CAROUSEL,
      MOCK_PICKER_TITLE,
      MOCK_TEMPLATE_IDENTIFIER
    );
    expect(interactiveMessagePayload).toEqual({
      text: JSON.stringify({
        templateIdentifier: MOCK_TEMPLATE_IDENTIFIER,
        listTitle: MOCK_PICKER_TITLE,
        selectionText: MOCK_PICKER_SELECTION,
      }),
    });
  });
});

/**
 * Assert expected frontend limits for interactive message fields
 * 
 * Assure that future changes will also follow documentation 
 * 
 * Documentation: https://docs.aws.amazon.com/connect/latest/adminguide/interactive-messages.html
 */
describe("Interactive Message Constraints", () => {
  describe(InteractiveMessageType.PANEL, () => {
    const PANEL_CONSTRAINTS = INTERACTIVE_MESSAGE_CONSTRAINTS[InteractiveMessageType.PANEL];

    it("should include constraints matching public documentation", () => {
      expect(PANEL_CONSTRAINTS).toHaveProperty("titleCharLimit", 400);
      expect(PANEL_CONSTRAINTS).toHaveProperty("subtitleCharLimit", 400);
      expect(PANEL_CONSTRAINTS).toHaveProperty("elementTitleCharLimit", 400);
    });
  });

  describe(InteractiveMessageType.LIST_PICKER, () => {
    const LIST_PICKER_CONSTRAINTS = INTERACTIVE_MESSAGE_CONSTRAINTS[InteractiveMessageType.LIST_PICKER];

    it("should include constraints matching public documentation", () => {
      expect(LIST_PICKER_CONSTRAINTS).toHaveProperty("titleCharLimit", 400);
      expect(LIST_PICKER_CONSTRAINTS).toHaveProperty("subtitleCharLimit", 400);
      expect(LIST_PICKER_CONSTRAINTS).toHaveProperty("elementTitleCharLimit", 400);
      expect(LIST_PICKER_CONSTRAINTS).toHaveProperty("elementSubtitleCharLimit", 400);
    });
  });

  describe(InteractiveMessageType.TIME_PICKER, () => {
    const TIME_PICKER_CONSTRAINTS = INTERACTIVE_MESSAGE_CONSTRAINTS[InteractiveMessageType.TIME_PICKER];

    it("should include constraints matching public documentation", () => {
      expect(TIME_PICKER_CONSTRAINTS).toHaveProperty("titleCharLimit", 400);
      expect(TIME_PICKER_CONSTRAINTS).toHaveProperty("subtitleCharLimit", 400);
    });
  });

  describe(InteractiveMessageType.CAROUSEL, () => {
    const CAROUSEL_CONSTRAINTS = INTERACTIVE_MESSAGE_CONSTRAINTS[InteractiveMessageType.CAROUSEL];

    it("should include constraints matching public documentation", () => {
      expect(CAROUSEL_CONSTRAINTS).toHaveProperty("titleCharLimit", 400);
    });
  });

  describe(InteractiveMessageType.QUICK_REPLY, () => {
    const QUICK_REPLY_CONSTRAINTS = INTERACTIVE_MESSAGE_CONSTRAINTS[InteractiveMessageType.QUICK_REPLY];

    it("should include constraints matching public documentation", () => {
      expect(QUICK_REPLY_CONSTRAINTS).toHaveProperty("titleCharLimit", 400);
      expect(QUICK_REPLY_CONSTRAINTS).toHaveProperty("replyOptionCharLimit", 200);
    });
  });
});

describe("truncateStrFromCharLimit util", () => {
  it("should truncate the string if it exceeds the maximum length", () => {
    const longTitle = "LongTitle".repeat(99);
    const expectedTruncatedTitle = longTitle.substring(0, 400) + "...";
    expect(
      truncateStrFromCharLimit(
        longTitle,
        InteractiveMessageType.PANEL,
        "titleCharLimit"
      )
    ).toBe(expectedTruncatedTitle);
  });

  it("should not truncate the string if it does not exceed the maximum length", () => {
    const longTitle = "LongTitle".repeat(10);
    expect(
      truncateStrFromCharLimit(
        longTitle,
        InteractiveMessageType.PANEL,
        "titleCharLimit"
      )
    ).toBe(longTitle);
  });

  it("should return an empty string if the input string is invalid", () => {
    expect(
      truncateStrFromCharLimit("Title", InteractiveMessageType.PANEL, undefined)
    ).toEqual("");
    expect(
      truncateStrFromCharLimit("Title", undefined, "titleCharLimit")
    ).toEqual("");
    expect(
      truncateStrFromCharLimit(
        undefined,
        InteractiveMessageType.PANEL,
        "titleCharLimit"
      )
    ).toEqual("");
    expect(
      truncateStrFromCharLimit(
        null,
        InteractiveMessageType.PANEL,
        "titleCharLimit"
      )
    ).toEqual("");
    expect(
      truncateStrFromCharLimit(
        [],
        InteractiveMessageType.PANEL,
        "titleCharLimit"
      )
    ).toEqual("");
    expect(
      truncateStrFromCharLimit(
        "",
        InteractiveMessageType.PANEL,
        "titleCharLimit"
      )
    ).toEqual("");
  });

  it.each([
    ["Title with script <script>alert(\"XSS attack!\");</script>", "Title with script "],
    ["<img src=\"x\" onerror=\"alert(\'XSS attack!\');\">", "<img src=\"x\">"],
    ["<a href=\"javascript:alert(\'XSS attack!\')\">Click me</a>", "<a>Click me</a>"],
    ["<input type=\"text\" value=\"XSS attack!\" onfocus=\"alert(\'XSS attack!\');\">", "<input value=\"XSS attack!\" type=\"text\">"],
    ["<div data-value=\"<img src=x onerror=alert(\'XSS attack!\')>\"></div>", "<div data-value=\"<img src=x onerror=alert('XSS attack!')>\"></div>"],
    ["<div style=\"background-image: url(\'javascript:alert(\'XSS attack!\');\')\"></div>", "<div style=\"background-image: url('javascript:alert('XSS attack!');')\"></div>"],
  ])("should detect and remove any malicious XSS attack snippets", (rawStr, expectedCleanStr) => {
    expect(truncateStrFromCharLimit(rawStr, InteractiveMessageType.PANEL, "titleCharLimit")).toEqual(expectedCleanStr);
  });
});

/**
 * Covers the parsing boundary used by ChatMessage.js's isInteractiveMessagePayload
 * and renderContent - message.content.data must resolve to an object.
 */
describe("safeParseInteractiveMessageJSON", () => {
  it("parses a valid JSON interactive message", () => {
    const validJson = '{"templateType":"QuickReply","version":"1.0","data":{"content":{"title":"Hi","elements":[{"title":"Yes"},{"title":"No"}]}}}';
    expect(safeParseInteractiveMessageJSON(validJson)).toEqual(JSON.parse(validJson));
  });

  it("does not corrupt an apostrophe inside message text (no blind ' -> \" replace)", () => {
    // Python's repr() switches a string's own delimiter to " whenever its
    // content contains an apostrophe - e.g. "don't" - rather than escaping
    // it, so the converter has to track quote type per-string, not replace
    // every ' globally.
    const withApostrophe = "{'templateType': 'QuickReply', 'data': {'content': {'title': \"Don't worry, I can help\", 'elements': [{'title': 'Yes'}]}}}";
    const parsed = safeParseInteractiveMessageJSON(withApostrophe);
    expect(parsed.data.content.title).toEqual("Don't worry, I can help");
  });

  it("repairs the current backend's Python-style QuickReply payload", () => {
    // Exact shape currently sent by the backend: single-quoted dict/string
    // literals, result-wrapper already removed on their side.
    const currentBackendPayload =
      "{'templateType': 'QuickReply', 'version': '1.0', 'data': {'content': {'title': 'To assist you further, please confirm if you would like me to check the status of your order?\\n\\n**Yes** | **No**\\n', 'elements': [{'title': 'Yes'}, {'title': 'No'}]}}, 'metadata': {}}";

    const parsed = safeParseInteractiveMessageJSON(currentBackendPayload);

    expect(parsed.templateType).toEqual("QuickReply");
    expect(parsed.data.content.title).toEqual(
      "To assist you further, please confirm if you would like me to check the status of your order?\n\n**Yes** | **No**\n"
    );
    expect(parsed.data.content.elements).toEqual([{ title: "Yes" }, { title: "No" }]);
  });

  it("returns undefined for an invalid/unrecognized payload instead of guessing", () => {
    expect(safeParseInteractiveMessageJSON("{not valid json at all}")).toBeUndefined();
    expect(safeParseInteractiveMessageJSON("also not json")).toBeUndefined();
    expect(safeParseInteractiveMessageJSON(null)).toBeUndefined();
  });

  it("returns undefined for an existing plain-text/system message, unaffected by the repair path", () => {
    const plainText = "I'm a generative AI virtual assistant.\nThis chat may be recorded and shared with our service providers.";
    expect(safeParseInteractiveMessageJSON(plainText)).toBeUndefined();
  });
});

describe("QuickReply rating detection & response payload", () => {
  const ratingElements = [
    {title: "1 Very Dissatisfied"},
    {title: "2 Dissatisfied"},
    {title: "3 Neutral"},
    {title: "4 Satisfied"},
    {title: "5 Very Satisfied"},
  ];
  const nonRatingContent = {
    title: "How was your experience?",
    elements: [{title: "Great!"}, {title: "Good"}, {title: "Ok"}, {title: "Poor"}, {title: "Terrible!"}],
  };

  describe("getQuickReplyElementRatingValue", () => {
    it("uses element.value when present", () => {
      expect(getQuickReplyElementRatingValue({value: 3, title: "whatever"})).toBe("3");
    });
    it("falls back to the leading digit of the title", () => {
      expect(getQuickReplyElementRatingValue({title: "2 Dissatisfied"})).toBe("2");
    });
    it("returns undefined when neither yields a 1-5 value", () => {
      expect(getQuickReplyElementRatingValue({title: "Good"})).toBeUndefined();
      expect(getQuickReplyElementRatingValue({})).toBeUndefined();
    });
  });

  describe("isRatingQuickReply (render-path, looser)", () => {
    it("is true when displayStyle is 'rating'", () => {
      expect(isRatingQuickReply({displayStyle: QuickReplyDisplayStyle.RATING, elements: []})).toBe(true);
    });
    it("is true when elements are the 1-5 scale (any order, no displayStyle)", () => {
      expect(isRatingQuickReply({elements: [...ratingElements].reverse()})).toBe(true);
    });
    it("is false for a regular QuickReply", () => {
      expect(isRatingQuickReply(nonRatingContent)).toBe(false);
    });
    it("is false for non-object input", () => {
      expect(isRatingQuickReply(undefined)).toBe(false);
      expect(isRatingQuickReply(null)).toBe(false);
    });
  });

  describe("isFeedbackFlowQuickReply (send-path)", () => {
    it("is true when the payload carries a metadata marker (nucId / actionExpected)", () => {
      expect(isFeedbackFlowQuickReply({elements: [{title: "Yes"}, {title: "No"}]}, {nucId: "NUC17", actionExpected: "resolution_feedback"})).toBe(true);
      expect(isFeedbackFlowQuickReply(nonRatingContent, {actionExpected: "resolution_feedback"})).toBe(true);
    });
    it("is true for the explicit displayStyle 'rating' marker even with no metadata", () => {
      expect(isFeedbackFlowQuickReply({displayStyle: QuickReplyDisplayStyle.RATING, elements: ratingElements})).toBe(true);
    });
    it("is false for an auto-detected 1-5 scale with neither signal", () => {
      expect(isFeedbackFlowQuickReply({elements: ratingElements})).toBe(false);
    });
    it("is false for a regular QuickReply / empty metadata / non-object input", () => {
      expect(isFeedbackFlowQuickReply(nonRatingContent)).toBe(false);
      expect(isFeedbackFlowQuickReply(nonRatingContent, {})).toBe(false);
      expect(isFeedbackFlowQuickReply(undefined)).toBe(false);
    });
  });

  describe("flattenFeedbackQuickReplyResponse", () => {
    const qrResponse = (action) => ({
      text: JSON.stringify({templateType: InteractiveMessageType.QUICK_REPLY, version: "1.0", action}),
      type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE,
    });
    const ratingPrompt = {
      templateType: InteractiveMessageType.QUICK_REPLY,
      version: "1.0",
      data: {content: {title: "Rate us", displayStyle: "rating", elements: ratingElements}},
      metadata: {nucId: "NUC17", actionExpected: "rating_selection"},
    };
    const yesNoPrompt = {
      templateType: InteractiveMessageType.QUICK_REPLY,
      version: "1.0",
      data: {content: {title: "Resolved on first contact?", elements: [{title: "Yes"}, {title: "No"}]}},
      metadata: {nucId: "NUC17", actionExpected: "resolution_feedback"},
    };
    const plainPrompt = {
      templateType: InteractiveMessageType.QUICK_REPLY,
      version: "1.0",
      data: {content: nonRatingContent},
    };

    it("flattens a rating answer to plain text (the action value)", () => {
      expect(flattenFeedbackQuickReplyResponse(qrResponse("2 Dissatisfied"), ratingPrompt)).toEqual({
        text: "2 Dissatisfied",
        type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
      });
    });

    it("flattens the Yes/No resolution answer (metadata marker, no displayStyle)", () => {
      expect(flattenFeedbackQuickReplyResponse(qrResponse("Yes"), yesNoPrompt)).toEqual({
        text: "Yes",
        type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN,
      });
    });

    it("leaves a non-feedback QuickReply response untouched", () => {
      const out = qrResponse("Great!");
      expect(flattenFeedbackQuickReplyResponse(out, plainPrompt)).toBe(out);
    });

    it("leaves a plain-text outgoing message untouched", () => {
      const out = {text: "just typing", type: ContentType.MESSAGE_CONTENT_TYPE.TEXT_PLAIN};
      expect(flattenFeedbackQuickReplyResponse(out, ratingPrompt)).toBe(out);
    });

    it("leaves a non-QuickReply interactive.response untouched", () => {
      const out = {
        text: JSON.stringify({templateType: InteractiveMessageType.VIEW_RESOURCE, action: "x"}),
        type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE,
      };
      expect(flattenFeedbackQuickReplyResponse(out, ratingPrompt)).toBe(out);
    });

    it("leaves the response untouched when there is no last incoming interactive payload", () => {
      const out = qrResponse("2 Dissatisfied");
      expect(flattenFeedbackQuickReplyResponse(out, undefined)).toBe(out);
    });
  });
});

describe("Guides in Chat", () => {
  it("should be able to generate guides url", () => {
    let url = constructGuidesRendererUrl('test-instance', 'latest');
    expect(url).toEqual('https://test-instance.my.connect.aws/connectwidget/static/views/renderer/latest/index.js');

    url = constructGuidesRendererUrl('test-instance', '2.3.4');
    expect(url).toEqual('https://test-instance.my.connect.aws/connectwidget/static/views/renderer/2.3.4/index.js');
  });

  it("should not be able to generate guides renderer url", () => {
    let url = constructGuidesRendererUrl('test-instance', '');
    expect(url).toEqual('');

    url = constructGuidesRendererUrl();
    expect(url).toEqual('');
  });

  it("should not be able to insert guides renderer script in head when guidesInChat is not provided", () => {
    window.connect = {};
    let props = {};
    setupGuidesRenderer(props);
    expect(document.head.innerHTML).not.toContain('connectwidget/static/views/renderer');
  });

  it("should not be able to insert guides renderer script in head when invalid config is provided", () => {
    window.connect = {};
    let props = {guidesInChat: { version: 'latest'} };
    setupGuidesRenderer(props);
    expect(document.head.innerHTML).not.toContain('connectwidget/static/views/renderer');

    props = {guidesInChat: { instanceAlias: undefined, version: undefined} };
    setupGuidesRenderer(props);
    expect(document.head.innerHTML).not.toContain('connectwidget/static/views/renderer');
  });

  it("should insert guides renderer script in head", () => {
    window.connect = {};
    let props = {guidesInChat: { instanceAlias: 'test-instance'} };
    setupGuidesRenderer(props);
    expect(document.head.innerHTML).toContain('<script src="https://test-instance.my.connect.aws/connectwidget/static/views/renderer/latest/index.js"></script>');
    
    props = {guidesInChat: { instanceAlias: 'test-instance', version: 'abcd'}};
    setupGuidesRenderer(props);
    expect(document.head.innerHTML).toContain('<script src="https://test-instance.my.connect.aws/connectwidget/static/views/renderer/abcd/index.js"></script>');
  });

  afterAll(() => {
    delete window.connect;
  });

});
