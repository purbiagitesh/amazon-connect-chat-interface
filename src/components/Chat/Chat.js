import PT from "prop-types";
import {FormattedMessage} from "react-intl";
import {CONTACT_STATUS} from "../../constants/global";
import ChatTranscriptor from "./ChatTranscriptor";
import ChatComposer from "./ChatComposer";
import {modelUtils} from "./datamodel/Utils";
import React, {Component} from "react";
import {Text} from "connect-core";
import styled from "styled-components";
import renderHTML from 'react-render-html';

// After an upload is rejected on content-guideline grounds, the customer is
// let back in to swap in a compliant file this many times before the
// paperclip closes for good (see modelUtils.shouldAllowAttachmentReupload).
const MAX_ATTACHMENT_REUPLOAD_ATTEMPTS = 2;

const ChatWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 24px; // to match the border with figma frame
  overflow: hidden;
`;

const ParentHeaderWrapper = styled.div`
  margin: 0;
  padding: 0;
  order: 1;
  height: var(--ac-widget-global-headerheight, auto);
  max-height: min(115px, 21.2%);
  border-radius: 12px 12px 0 0;
  overflow: hidden;
  flex-shrink: 0;
`;

const ChatComposerWrapper = styled.div`
  order: 2;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
`;

const HeaderWrapper = styled.div`
  padding: 0;
  border-radius: 24px 24px 0 0;
  overflow: hidden;
`;

const BrandIconWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 0;
  flex-shrink: 0;
`;

const BrandIcon = styled.img`
  max-height: var(--ac-widget-logo-max-height, 61px);
  max-width: var(--ac-widget-logo-max-width, 99%);
`;

const WelcomeText = styled(Text)`
  padding-bottom: 10px;
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px;
`;
 
const HeaderLeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;
 
const HeaderLogo = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
`;
 
const HeaderAgentName = styled.div`
  color: ${props => props.textColor};
  font-size: 14px;
  line-height: 16px;
  font-weight: 700;
  letter-spacing: 0;
`;
 
const HeaderTitle = styled.div`
  color: ${props => props.textColor};
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  letter-spacing: normal;
`;
 
const HeaderSubtitle = styled.div`
  color: ${props => props.subtitleColor};
  font-size: 10px;
  line-height: 12px;
  font-weight: normal;
  margin-top: 4px;
  max-width: 260px;
`;
 
const Separator = styled.span`
  display: inline-flex;
  align-items: center;
  margin: 0 8px;
`;
 
const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${props => props.textColor};
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 0 0 8px;
  flex-shrink: 0;
  width: auto;
  font-family: inherit;
`;

const defaultHeaderConfig = {
  isHTML: false,
  render: (config) => {
    const brandInfo = (
      (window.__CHAT_BRAND_INFO__ && window.__CHAT_BRAND_INFO__.config) ||
      (window.parent && window.parent.__CHAT_BRAND_INFO__ && window.parent.__CHAT_BRAND_INFO__.config) ||
      {}
    );
    const hc = brandInfo.header || {};
    const colors = brandInfo.colors || {};

    // Use CSS vars for colors since styled-components cross iframe boundary.
    // Header background is the brand's Primary500 token - same source the
    // launcher icon uses - so it can't drift out of sync with the brand theme.
    const bgColor = colors.primary500 || hc.backgroundColor || '#3F5773';
    const textColor = hc.textColor || '#ffffff';
    const subtitleColor = hc.subtitleColor || 'rgba(255,255,255,0.70)';

    return (
      <HeaderWrapper style={{ background: bgColor}}>
        <HeaderContent>
          <HeaderLeftSection>
            {hc.logoUrl && (
              <HeaderLogo
                src={hc.logoUrl}
                alt=""
              />
            )}
            <div>
              {config.lastTranscriptItem?.participantRole === 'AGENT' ? (
                <HeaderAgentName textColor={textColor}>
                  {config.lastTranscriptItem.displayName || ''}<Separator>{' •'}</Separator>{`Consumer Care Advisor`}
                </HeaderAgentName>
              ) : (
                <HeaderTitle textColor={textColor}>
                  {hc.title || ''}
                </HeaderTitle>
              )}
              {hc.subtitle && (
                <HeaderSubtitle subtitleColor={subtitleColor}>
                  {hc.subtitle}
                </HeaderSubtitle>
              )}
            </div>
          </HeaderLeftSection>
          {hc.showCloseButton && (
            <CloseButton
              onClick={() => config.onEndChat && config.onEndChat()}
              textColor={textColor}
              aria-label="Close chat"
            >
              ×
            </CloseButton>
          )}
        </HeaderContent>
      </HeaderWrapper>
    );
  }
};

Header.defaultProps = {
  headerConfig: {},
  logoConfig: {}
};

function Header({headerConfig, logoConfig, lastTranscriptItem, onEndChat}) {
  const config = Object.assign({}, defaultHeaderConfig, headerConfig, logoConfig, {lastTranscriptItem, onEndChat});
  if (config.isHTML) {
    return renderHTML(config.render());
  } else {
    return config.render(config);
  }
}

const textInputRef = React.createRef();

export default class Chat extends Component {

  constructor(props) {
    super(props);
    this.state = {
      transcript: [],
      typingParticipants: [],
      contactStatus: CONTACT_STATUS.DISCONNECTED,
    };
    this.updateTranscript = transcript => this.setState({transcript: [...transcript]});
    this.updateTypingParticipants = typingParticipants => this.setState({typingParticipants});
    this.updateContactStatus = contactStatus => this.setState({contactStatus});
    if(window.connect && window.connect.LogManager) {
      this.logger = window.connect.LogManager.getLogger({prefix: "ChatInterface-Chat"});
    }
  }

  static propTypes = {
    chatSession: PT.object.isRequired,
    composerConfig: PT.object,
    disclaimerConfig: PT.object,
    onEnded: PT.func,
    forceAttachmentStepActive: PT.bool,
  };

  static defaultProps = {
    onEnded: () => {},
    forceAttachmentStepActive: false,
  };

  componentDidMount() {
    this.init(this.props.chatSession);
    if (typeof this.props.changeLanguage === "function") {
      this.props.changeLanguage(this.props.language);
    }
    this.logger && this.logger.info("Component mounted.")
  }

  componentDidUpdate(prevProps) {
    if (prevProps.chatSession !== this.props.chatSession) {
      this.cleanUp(prevProps.chatSession);
      this.init(this.props.chatSession);
    }
    if (prevProps.language !== this.props.language &&
      typeof this.props.changeLanguage === "function") {
      this.props.changeLanguage(this.props.language);
    }
  }

  componentWillUnmount() {
    this.cleanUp(this.props.chatSession);
  }

  init(chatSession) {
    this.setState({contactStatus: chatSession.contactStatus});
    chatSession.on('transcript-changed', this.updateTranscript);
    chatSession.on('typing-participants-changed', this.updateTypingParticipants);
    chatSession.on('contact-status-changed', this.updateContactStatus);
  }

  cleanUp(chatSession) {
    chatSession.off('transcript-changed', this.updateTranscript);
    chatSession.off('typing-participants-changed', this.updateTypingParticipants);
    chatSession.off('contact-status-changed', this.updateContactStatus);
  }

  endChat() {
    this.props.chatSession.endChat();
    this.props.onEnded();
  }

  // The header's close ("x") button used to call endChat() above, which
  // both disconnected the live Connect contact AND reset ChatContainer's
  // state (destroying this chatSession) - so reopening the widget always
  // started a brand new conversation. Per the persistence feature, closing
  // via the header should only hide the panel: the chatSession stays fully
  // connected and this component tree stays mounted, so the transcript is
  // still sitting in state the moment the panel is shown again - no
  // separate "restore" step needed. Actually ending the chat is still
  // possible via ChatActionBar's "End chat" button (chatSession.endChat()),
  // this only changes what the header's "x" does.
  // window.connect.ChatWidget.close() is the same function launcher.js
  // wires up for host-page/programmatic close calls - reusing it here
  // keeps a single source of truth for "hide the panel" instead of
  // duplicating that DOM logic. Guarded because this component can also be
  // mounted without launcher.js (e.g. a vendor's own iframe embed), where
  // there's nothing to call.
  minimizeChat() {
    if (window.connect && window.connect.ChatWidget && typeof window.connect.ChatWidget.close === 'function') {
      window.connect.ChatWidget.close();
    }
  }

  render() {
    const {chatSession, headerConfig, transcriptConfig, composerConfig, disclaimerConfig, logoConfig} = this.props;
    console.log('MESSAGES', this.state.transcript);
    // A QuickReply message awaiting a response locks the free-text input -
    // once the customer answers (or a new bot message arrives), that
    // response becomes the latest transcript item and the composer
    // re-enables itself automatically.
    const lastTranscriptItem = this.state.transcript[this.state.transcript.length - 1];
    const isComposerLocked = !!lastTranscriptItem && modelUtils.isPendingQuickReplyMessage(lastTranscriptItem);
    // The attach icon stays hidden until the bot's current step explicitly
    // asks for a file (attachmentExpected: true on the latest interactive
    // message) - see modelUtils.isAttachmentExpectedMessage.
    //const isAttachmentStepActive = !!lastTranscriptItem && modelUtils.isAttachmentExpectedMessage(lastTranscriptItem);
    //
    // Also keep the paperclip available after a rejected upload so the
    // customer can re-upload a compliant file - capped at
    // MAX_ATTACHMENT_REUPLOAD_ATTEMPTS re-tries, and closing itself once a
    // compliant file goes through (see modelUtils.shouldAllowAttachmentReupload).
    const isAttachmentStepActive = (!!lastTranscriptItem && modelUtils.isAttachmentExpectedMessage(lastTranscriptItem))
      || this.props.forceAttachmentStepActive
      || modelUtils.shouldAllowAttachmentReupload(this.state.transcript, MAX_ATTACHMENT_REUPLOAD_ATTEMPTS);
    //const isAttachmentStepActive = !!lastTranscriptItem && modelUtils.isAttachmentExpectedMessage(lastTranscriptItem);
    return (
      <ChatWrapper data-testid="amazon-connect-chat-wrapper">
        {(this.state.contactStatus === CONTACT_STATUS.CONNECTED ||
          this.state.contactStatus === CONTACT_STATUS.CONNECTING ||
          this.state.contactStatus === CONTACT_STATUS.ENDED ||
          // DISCONNECTED is what endChat() (ChatSession.js) transitions to
          // once the contact actually ends - the header stays visible here
          // too (matches ChatTranscriptor.js's same DISCONNECTED addition),
          // so the panel doesn't lose its title bar the moment the chat ends.
          this.state.contactStatus === CONTACT_STATUS.DISCONNECTED) &&
          <ParentHeaderWrapper className="header">
            <Header headerConfig={headerConfig} logoConfig={logoConfig} lastTranscriptItem={lastTranscriptItem} onEndChat={() => this.minimizeChat()}/>
          </ParentHeaderWrapper>
        }
        <ChatComposerWrapper>
          {(this.state.contactStatus === CONTACT_STATUS.CONNECTED ||
            this.state.contactStatus === CONTACT_STATUS.ACW ||
            this.state.contactStatus === CONTACT_STATUS.ENDED) && logoConfig && logoConfig.sourceUrl &&
            <BrandIconWrapper>
              <BrandIcon src={logoConfig.sourceUrl} alt={logoConfig.altText || ''}/>
            </BrandIconWrapper>
          }
          <ChatTranscriptor
            loadPreviousTranscript={() => chatSession.loadPreviousTranscript()}
            addMessage={(data) => chatSession.addOutgoingMessage(data)}
            downloadAttachment={(attachmentId) => chatSession.downloadAttachment(attachmentId)}
            transcript={this.state.transcript}
            typingParticipants={this.state.typingParticipants}
            contactStatus={this.state.contactStatus}
            contactId={chatSession.contactId}
            transcriptConfig={transcriptConfig}
            textInputRef={textInputRef}
            sendReadReceipt={(...inputParams) => chatSession.sendReadReceipt(...inputParams)}
          />
          <ChatComposer
            contactStatus={this.state.contactStatus}
            contactId={chatSession.contactId}
            addMessage={(contactId, data) => chatSession.addOutgoingMessage(data)}
            addAttachment={(contactId, attachment) => chatSession.addOutgoingAttachment(attachment)}
            onTyping={() => chatSession.sendTypingEvent()}
            composerConfig={composerConfig}
            disclaimerConfig={disclaimerConfig}
            textInputRef={textInputRef}
            disabled={isComposerLocked}
            attachmentStepActive={isAttachmentStepActive}
          />
        </ChatComposerWrapper>
      </ChatWrapper>
    );
  }
}
