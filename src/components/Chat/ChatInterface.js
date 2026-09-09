/**
 * Simple utitlity for for Event subscription
 */
import EventBus from "./eventbus"

class ChatInterface {

  clientConfig = {
    contactFlowId: "",
    instanceId: "",
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
}


window.connect = window.connect || {};
window.connect.ChatInterface = window.connect.ChatInterface || new ChatInterface();


window.addEventListener("message", function(data){
  if(data.initChat){
    window.connect.ChatInterface.initiateChat(data);
  }
})

