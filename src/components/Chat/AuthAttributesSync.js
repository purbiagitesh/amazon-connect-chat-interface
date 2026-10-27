import request from "../../utils/fetchRequest";

/**
 * Pushes newly-known customer attributes onto an already-live contact.
 *
 * Routed through the SAME combined Lambda/URL as StartChatContact
 * (ChatInitiator.js) - that Lambda distinguishes the two by request body
 * shape alone (contactId + attributes => UpdateContactAttributes), not by a
 * separate path. Deliberately no explicit Content-Type header, same reason
 * as ChatInitiator.js: an unset header lets the browser default the string
 * body to text/plain, which is CORS-safelisted (no preflight) - the shared
 * API Gateway resource behind this endpoint isn't configured to answer one.
 *
 * @param {Object} input
 * @param {string} input.apiGatewayEndpoint
 * @param {string} input.contactId
 * @param {Object} input.attributes
 * @returns {Promise}
 */
export function updateContactAttributes({apiGatewayEndpoint, contactId, attributes}) {
  return request(apiGatewayEndpoint, {
    method: "post",
    body: JSON.stringify({contactId, attributes}),
  });
}
