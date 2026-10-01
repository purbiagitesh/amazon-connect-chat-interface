/**
 * Simple utitlity for for Event subscription
 */
import EventBus from "./eventbus"

class ChatInterface {

  clientConfig = {
    region: "",
    stage: "prod",
    contactAttributes: {},
    featurePermissions: {}
  }

  initiateChat(input, success, failure) {
    let chatInput  = Object.assign({}, this.clientConfig, input);
    EventBus.trigger("initChat", chatInput, success, failure);
  }

  // Reconnects to an already-active chat contact using StartChatContact
  // credentials an earlier initiateChat() call already returned
  // (input.chatDetails), instead of starting a brand new contact. Used to
  // resume a chat across a full page reload or a new tab on a multi-page
  // (non-SPA) site - see ChatContainer.js's resumeChatSession/
  // submitChatResume for the handler, and launcher.js's
  // persistActiveChat()/getResumableSession() for how those credentials
  // survive the reload.
  resumeChat(input, success, failure) {
    let chatInput = Object.assign({}, this.clientConfig, input);
    EventBus.trigger("resumeChat", chatInput, success, failure);
  }

  // Forces ChatContainer back to its blank/loading render (see
  // ChatContainer.js's resetState/EventBus.on("resetChatUI", ...)) -
  // synchronously, with no network round trip. Used by launcher.js right
  // before it reveals the panel for a brand new chat (no active/resumable
  // session): without this, the panel would instantly show whatever is
  // STILL mounted from a previous, now-ended chatSession - stale content -
  // for as long as initiateChat() below takes to actually resolve. This
  // swaps that stale render for the same loading spinner a fresh page load
  // already shows, so the panel opening feels instant either way, and
  // never displays a dead conversation while the new one starts.
  resetChatUI() {
    EventBus.trigger("resetChatUI");
  }
}


window.connect = window.connect || {};
window.connect.ChatInterface = window.connect.ChatInterface || new ChatInterface();


window.addEventListener("message", function(data){
  if(data.initChat){
    window.connect.ChatInterface.initiateChat(data);
  }
})

