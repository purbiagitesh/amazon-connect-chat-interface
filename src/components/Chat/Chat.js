import PT from "prop-types";
import {FormattedMessage} from "react-intl";
import {CONTACT_STATUS} from "../../constants/global";
import ChatTranscriptor from "./ChatTranscriptor";
import ChatComposer from "./ChatComposer";
import React, {Component} from "react";
import {Text} from "connect-core";
import styled from "styled-components";
import renderHTML from 'react-render-html';

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

    // Use inline styles for colors since CSS vars don't cross iframe boundary.
    // Header background is the brand's Primary500 token - same source the
    // launcher icon uses - so it can't drift out of sync with the brand theme.
    const bgColor = colors.primary500 || hc.backgroundColor || '#3F5773';
    const textColor = hc.textColor || '#ffffff';
    const subtitleColor = hc.subtitleColor || 'rgba(255,255,255,0.70)';

    return (
      <HeaderWrapper style={{ background: bgColor}}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px'}}>
            {hc.logoUrl && (
              <img
                src={hc.logoUrl}
                alt=""
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            )}
            <div>
              <div style={{
                color: textColor,
                fontSize: '16px',
                lineHeight: '20px',
                fontWeight: 700,
                letterSpacing: 'normal',
              }}>
                {hc.title || ''}
              </div>
              {hc.subtitle && (
                <div style={{
                  color: subtitleColor,
                  fontSize: '10px',
                  lineHeight: '12px',
                  fontWeight: 'normal',
                  marginTop: '4px',
                  maxWidth: '260px',
                }}>
                  {hc.subtitle}
                </div>
              )}
            </div>
          </div>
          {hc.showCloseButton && (
            <button
              onClick={() => config.onEndChat && config.onEndChat()}
              style={{
                background: 'transparent',
                border: 'none',
                color: textColor,
                fontSize: '22px',
                lineHeight: 1,
                cursor: 'pointer',
                padding: '0 0 0 8px',
                flexShrink: 0,
              }}
              aria-label="Close chat"
            >
              ×
            </button>
          )}
        </div>
      </HeaderWrapper>
    );
  }
};

Header.defaultProps = {
  headerConfig: {},
  logoConfig: {}
};

function Header({headerConfig, logoConfig, onEndChat}) {
  const config = Object.assign({}, defaultHeaderConfig, headerConfig, logoConfig, {onEndChat});
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
    onEnded: PT.func,
  };

  static defaultProps = {
    onEnded: () => {},
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

  render() {
    const {chatSession, headerConfig, transcriptConfig, composerConfig, logoConfig} = this.props;
    console.log('MESSAGES', this.state.transcript);
    return (
      <ChatWrapper data-testid="amazon-connect-chat-wrapper">
        {(this.state.contactStatus === CONTACT_STATUS.CONNECTED ||
          this.state.contactStatus === CONTACT_STATUS.CONNECTING || this.state.contactStatus === CONTACT_STATUS.ENDED) &&
          <ParentHeaderWrapper className="header">
            <Header headerConfig={headerConfig} logoConfig={logoConfig} onEndChat={() => this.endChat()}/>
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
            textInputRef={textInputRef}
          />
        </ChatComposerWrapper>
      </ChatWrapper>
    );
  }
}
