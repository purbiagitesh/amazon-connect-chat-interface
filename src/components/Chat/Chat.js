import PT from "prop-types";
import {FormattedMessage} from "react-intl";
import {CONTACT_STATUS} from "../../constants/global";
import ChatTranscriptor from "./ChatTranscriptor";
import ChatComposer from "./ChatComposer";
import React, {Component} from "react";
import {Text} from "connect-core";
import styled from "styled-components";
import renderHTML from 'react-render-html';
import Palette from '../../theme/Palette';

const ChatWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 24px 24px 0 0;
  overflow: hidden;
  @media (max-width:640px) {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
  }
`;

const ParentHeaderWrapper = styled.div`
  margin: 0;
  padding: 0;
  order: 1;
  height: var(--ac-widget-global-headerheight, auto);
  max-height: min(115px, 21.2%);
  border-radius: 12px 12px 0 0;
  overflow: hidden;
  @media (max-width: 640px) {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
  }
`;

const ChatComposerWrapper = styled.div`
  order: 2;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  @media (max-width:640px) {
    position: absolute;
    left: 0;
    bottom: 0;
    right: 0;
    top: ${props => props.parentHeaderWrapperHeight}px;
    min-height: auto;
  }
`;

const HeaderWrapper = styled.div`
  padding: 0;
  border-radius: 24px 24px 0 0;
  overflow: hidden;
  background: ${props => props.bgColor};
`;

const HeaderContentRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px;
`;

const HeaderBrandGroup = styled.div`
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

const HeaderTitle = styled.div`
  color: ${props => props.color};
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  letter-spacing: normal;
`;

const HeaderSubtitle = styled.div`
  color: ${props => props.color};
  font-size: 10px;
  line-height: 12px;
  font-weight: normal;
  margin-top: 4px;
  max-width: 260px;
`;

const HeaderCloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${props => props.color};
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 0 0 8px;
  flex-shrink: 0;
`;

const BrandIconWrapper = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px 0 4px;
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
    const textColor = hc.textColor || Palette.palette.white;
    const subtitleColor = hc.subtitleColor || 'rgba(255,255,255,0.70)';

    return (
      <HeaderWrapper bgColor={bgColor}>
        <HeaderContentRow>
          <HeaderBrandGroup>
            {hc.logoUrl && (
              <HeaderLogo src={hc.logoUrl} alt="" />
            )}
            <div>
              <HeaderTitle color={textColor}>
                {hc.title || ''}
              </HeaderTitle>
              {hc.subtitle && (
                <HeaderSubtitle color={subtitleColor}>
                  {hc.subtitle}
                </HeaderSubtitle>
              )}
            </div>
          </HeaderBrandGroup>
          {hc.showCloseButton && (
            <HeaderCloseButton
              onClick={() => config.onEndChat && config.onEndChat()}
              color={textColor}
              aria-label="Close chat"
            >
              ×
            </HeaderCloseButton>
          )}
        </HeaderContentRow>
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

const HEADER_HEIGHT = 115;

export default class Chat extends Component {

  constructor(props) {
    super(props);
    this.state = {
      transcript: [],
      typingParticipants: [],
      contactStatus: CONTACT_STATUS.DISCONNECTED,
      parentHeaderWrapperHeight: HEADER_HEIGHT,
    };
    this.parentHeaderRef = React.createRef();
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

  resetChatHeight() {
    this.setState({
      parentHeaderWrapperHeight: this.parentHeaderRef && this.parentHeaderRef.current ? this.parentHeaderRef.current.clientHeight : HEADER_HEIGHT,
    });
  }

  componentDidMount() {
    this.init(this.props.chatSession);
    this.resetChatHeight();
    if (typeof this.props.changeLanguage === "function") {
      this.props.changeLanguage(this.props.language);
    }
    this.logger && this.logger.info("Component mounted.")
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.chatSession !== this.props.chatSession) {
      this.cleanUp(prevProps.chatSession);
      this.init(this.props.chatSession);
    }
    if (prevProps.language !== this.props.language &&
      typeof this.props.changeLanguage === "function") {
      this.props.changeLanguage(this.props.language);
    }
    if (prevState.contactStatus !== this.state.contactStatus) {
      // The header is gated behind contactStatus, so its rendered height
      // (and the ref this measures) only exists once status flips to
      // CONNECTED/CONNECTING/ENDED - re-measure now instead of relying on
      // the componentDidMount reading, which ran before the header existed.
      this.resetChatHeight();
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

  /*
    Note: For Mobile layout: divided into 3 sections
    1. Header - Positon: absolute; top: 0, left: 0, right: 0 - height is dynamic!
    2. MainContent - Position: absolute; top: {dynamicHeight}, left: 0, right: 0, bottom: {fixedFooterHeight: 85px}
    3. Footer - position: absolute; bottom: 0, right: 0, left: 0
    -- this prevents overlay from overflowing in mobile browser.
  */
  render() {
    const {chatSession, headerConfig, transcriptConfig, composerConfig, logoConfig} = this.props;
    console.log('MESSAGES', this.state.transcript);
    return (
      <ChatWrapper data-testid="amazon-connect-chat-wrapper">
        {(this.state.contactStatus === CONTACT_STATUS.CONNECTED ||
          this.state.contactStatus === CONTACT_STATUS.CONNECTING || this.state.contactStatus === CONTACT_STATUS.ENDED) &&
          <ParentHeaderWrapper className="header" ref={this.parentHeaderRef}>
            <Header headerConfig={headerConfig} logoConfig={logoConfig} onEndChat={() => this.endChat()}/>
          </ParentHeaderWrapper>
        }
        <ChatComposerWrapper parentHeaderWrapperHeight={this.state.parentHeaderWrapperHeight}>
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
