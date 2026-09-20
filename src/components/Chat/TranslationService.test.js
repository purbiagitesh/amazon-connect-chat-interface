import {translateMessage} from "./TranslationService";
import {TRANSLATE_CLIENT_TIMEOUT_MS} from "../../constants/http";
import request from "../../utils/fetchRequest";

jest.mock("../../utils/fetchRequest");

const input = {
  apiEndpoint: "https://jgnx26szub.execute-api.eu-west-2.amazonaws.com/dev/translate",
  contactId: "contact-123",
  direction: "CUSTOMER_TO_AGENT",
  message: "Bonjour, j'ai besoin d'aide concernant ma commande.",
  agentLanguage: "en",
};

const resolvedRes = {
  json: {
    contactId: input.contactId,
    direction: input.direction,
    translatedMessage: "Hello, I need help regarding my order.",
    sourceLanguage: "fr",
    targetLanguage: "en",
    translationApplied: true,
  },
};

afterEach(() => {
  jest.resetAllMocks();
  jest.useRealTimers();
});

it("POSTs the expected request body, including agentLanguage when supplied", async () => {
  request.mockResolvedValue(resolvedRes);

  await translateMessage(input);

  expect(request).toHaveBeenCalledTimes(1);
  const [calledUrl, calledOptions] = request.mock.calls[0];
  expect(calledUrl).toEqual(input.apiEndpoint);
  expect(calledOptions.method).toEqual("post");
  expect(JSON.parse(calledOptions.body)).toEqual({
    contactId: input.contactId,
    direction: input.direction,
    message: input.message,
    agentLanguage: input.agentLanguage,
  });
});

it("omits agentLanguage from the body when not supplied", async () => {
  request.mockResolvedValue(resolvedRes);

  const {agentLanguage, ...inputWithoutAgentLanguage} = input;
  await translateMessage(inputWithoutAgentLanguage);

  const calledOptions = request.mock.calls[0][1];
  expect(JSON.parse(calledOptions.body)).toEqual({
    contactId: input.contactId,
    direction: input.direction,
    message: input.message,
  });
});

it("resolves with the response json (the translated payload)", async () => {
  request.mockResolvedValue(resolvedRes);

  const result = await translateMessage(input);

  expect(result).toEqual(resolvedRes.json);
});

it("rejects when the underlying request rejects (non-2xx or network error)", async () => {
  const rejection = {networkError: "boom"};
  request.mockRejectedValue(rejection);

  await expect(translateMessage(input)).rejects.toEqual(rejection);
});

it("rejects if the request never settles within TRANSLATE_CLIENT_TIMEOUT_MS", async () => {
  jest.useFakeTimers();
  request.mockReturnValue(new Promise(() => {})); // never resolves

  const resultPromise = translateMessage(input);
  const assertion = expect(resultPromise).rejects.toThrow(/timed out/);

  jest.advanceTimersByTime(TRANSLATE_CLIENT_TIMEOUT_MS);

  await assertion;
});
