import React, {Component} from "react";
import styled from "styled-components";
import {Button, Loader} from "connect-core";
import Chat from "./Chat";
import ChatSession, {setCurrentChatSessionInstance} from "./ChatSession";
import {initiateChat} from "./ChatInitiator";
import EventBus from "./eventbus";
import "./ChatInterface";
import './ChatEvents';
import {defaultTheme} from "connect-theme";
import {FlexRowContainer} from "connect-theme/Helpers";
import {CHAT_FEATURE_TYPES} from "./constants";
import {ContentType} from "./datamodel/Model";
import {LanguageProvider, LanguageContext} from "../../context/LanguageContext";

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 10px;
  > button {
    min-width: 85px;
  }
`;

const MessageBoxFail = styled.div`
  padding: 10;
  background-color: red;
`;

const LoadingWrapper = styled(FlexRowContainer)`
  padding: ${({ theme}) => theme.globals.basePadding};
  height: 100%;
`;

const Wrapper = styled.div`
  padding: ${({ theme}) => theme.globals.basePadding};
  height: 100%;
`;

class ChatContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      chatSession: null,
      composerConfig: {},
      status: "NotInitiated",
      language: 'en_US'
    };

    this.submitChatInitiationHandler = this.initiateChatSession.bind(this);
    EventBus.on("initChat", this.initiateChatSession.bind(this));
    this.resumeChatHandler = this.resumeChatSession.bind(this);
    EventBus.on("resumeChat", this.resumeChatHandler);
    if (window.connect && window.connect.LogManager) {
      this.logger = window.connect.LogManager.getLogger({
        prefix: "ChatInterface-ChatContainer",
      });
    }
  }

  componentWillUnmount() {
    EventBus.off(this.submitChatInitiationHandler);
    EventBus.off("resumeChat", this.resumeChatHandler);
  }

  initiateChatSession(chatDetails, success, failure) {
    const logContent = {
      contactFlowId: chatDetails.contactFlowId ? chatDetails.contactFlowId : null,
      instanceId: chatDetails.instanceId ? chatDetails.instanceId : null,
      region: chatDetails.region ? chatDetails.region : null,
      stage: chatDetails.stage ? chatDetails.stage : null,
      featurePermissions: chatDetails.featurePermissions ? chatDetails.featurePermissions : null,
      apiGatewayEndpoint: chatDetails.apiGatewayEndpoint ? chatDetails.apiGatewayEndpoint : null,
    };
    this.logger && this.logger.info("Chat session meta data:", logContent);
    this.submitChatInitiation(chatDetails, success, failure);
  }

  /**
   * Initiate a chat in 2 steps.
   *
   * Step 1: Create a chat session within Amazon Connect (more details in ChatInitiator.js)
   * This step provides us with a 'chatDetails' object that contains among others:
   * - Auth Token
   * - Websocket endpoint
   * - ContactId
   * - ConnectionId
   *
   * Step 2: Connect to created chat session.
   * Open a websocket connection via Chat.JS (more details in ChatSession.js)
   *
   * @param {*} input
   * @param {*} success
   * @param {*} failure
   */
  async submitChatInitiation(input, success, failure) {
    this.setState({status: "Initiating"});
    const customizationParams = {
      authenticationRedirectUri: input.authenticationRedirectUri || '',
      authenticationIdentityProvider: input.authenticationIdentityProvider || ''
    }
    try {
      const chatDetails = await initiateChat(input);
      const chatSession = await this.openChatSession(chatDetails, input.name, input.region, input.stage, customizationParams);
      setCurrentChatSessionInstance(chatSession);
      const attachmentsEnabled =
        (input.featurePermissions && input.featurePermissions[CHAT_FEATURE_TYPES.ATTACHMENTS]) ||
        (chatDetails.featurePermissions && chatDetails.featurePermissions[CHAT_FEATURE_TYPES.ATTACHMENTS]);
      const richMessagingEnabled = typeof input.supportedMessagingContentTypes === "string" ? input.supportedMessagingContentTypes.split(",").includes(ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN) : false;
      const language = input.language || "en_US";

      this.setState({
        status: "Initiated",
        chatSession: chatSession,
        composerConfig: {
          attachmentsEnabled,
          richMessagingEnabled,
        },
        language
      });
      success && success(chatSession);
    } catch (error) {
      this.setState({status: "InitiateFailed"});
      failure && failure(error);
    }
  }

  resumeChatSession(input, success, failure) {
    this.logger && this.logger.info("Resuming existing chat session (page reload/new tab) - skipping StartChatContact.");
    this.submitChatResume(input, success, failure);
  }

  /**
   * Reconnects to an already-active chat, instead of the 2-step
   * initiate-then-connect flow submitChatInitiation() above performs.
   * input.chatDetails are the SAME credentials an earlier
   * submitChatInitiation() call already obtained from StartChatContact -
   * calling openChatSession() directly with them re-attaches to that exact
   * same contact rather than creating a new one. Past transcript messages
   * reload automatically once connected - existing ChatSession.js behavior
   * (onConnectionEstablished), unrelated to this method.
   *
   * @param {*} input - must include chatDetails (the persisted
   *   StartChatContact response), plus name/region/stage as normal.
   * @param {*} success
   * @param {*} failure
   */
  async submitChatResume(input, success, failure) {
    this.setState({status: "Initiating"});
    const customizationParams = {
      authenticationRedirectUri: input.authenticationRedirectUri || '',
      authenticationIdentityProvider: input.authenticationIdentityProvider || ''
    }
    try {
      const chatSession = await this.openChatSession(input.chatDetails, input.name, input.region, input.stage, customizationParams);
      setCurrentChatSessionInstance(chatSession);
      const attachmentsEnabled =
        (input.featurePermissions && input.featurePermissions[CHAT_FEATURE_TYPES.ATTACHMENTS]) ||
        (input.chatDetails && input.chatDetails.featurePermissions && input.chatDetails.featurePermissions[CHAT_FEATURE_TYPES.ATTACHMENTS]);
      const richMessagingEnabled = typeof input.supportedMessagingContentTypes === "string" ? input.supportedMessagingContentTypes.split(",").includes(ContentType.MESSAGE_CONTENT_TYPE.TEXT_MARKDOWN) : false;
      const language = input.language || "en_US";

      this.setState({
        status: "Initiated",
        chatSession: chatSession,
        composerConfig: {
          attachmentsEnabled,
          richMessagingEnabled,
        },
        language
      });
      success && success(chatSession);
    } catch (error) {
      this.setState({status: "InitiateFailed"});
      failure && failure(error);
    }
  }

  openChatSession(chatDetails, name, region, stage, customizationParams) {
    const chatSession = new ChatSession(chatDetails, name, region, stage, customizationParams);
    // Exposes the raw StartChatContact credentials on the returned session
    // so a caller (launcher.js) can persist them for cross-page/cross-tab
    // chat resumption - see resumeChatSession()/submitChatResume() below,
    // which feeds a PERSISTED chatDetails object back into this same
    // method to reconnect, rather than calling initiateChat() again.
    chatSession.rawChatDetails = chatDetails;
    chatSession.onChatClose(() => {
      EventBus.trigger("endChat", {});
    });
    return chatSession.openChatSession().then(() => {
      return chatSession;
    });
  }

  resetState = () => {
    this.setState({status: "NotInitiated", chatSession: null});
    this.logger && this.logger.info("Chat session is reset");
  };

  render() {
    if ("NotInitiated" === this.state.status || "Initiating" === this.state.status) {
      return (
        <LoadingWrapper center={true}>
          <Loader color={defaultTheme.color.primary} size={30} />
        </LoadingWrapper>
      );
    }

    if ("InitiateFailed" === this.state.status) {
      return (
        <Wrapper>
          <MessageBoxFail>Initialization failed</MessageBoxFail>
          <ButtonWrapper>
            <Button col="2" type="tertiary" onClick={this.resetState}>
              <span>Go Back</span>
            </Button>
          </ButtonWrapper>
        </Wrapper>
      );
    }
    return (
        <LanguageProvider>
          <LanguageContext.Consumer>
            {({changeLanguage}) => (<>
              <Chat
                  chatSession={this.state.chatSession}
                  composerConfig={this.state.composerConfig}
                  onEnded={this.resetState}
                  changeLanguage={changeLanguage}
                  language={this.state.language}
                  {...this.props} />
            </>)}
          </LanguageContext.Consumer>
        </LanguageProvider>
    );
  }
}

export default ChatContainer;
