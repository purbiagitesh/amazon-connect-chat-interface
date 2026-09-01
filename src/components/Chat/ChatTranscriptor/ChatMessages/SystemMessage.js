import React from "react";
import {FormattedMessage} from "react-intl";
import PT from "prop-types";
import styled from "styled-components";
import {ContentType} from "../../datamodel/Model";
import {AuthenticationMessage} from './AuthenticationMessage'
import {formatDateDisplay, formatTimeDisplay} from "../../../../utils/helper";

// Events that arrive from Connect but are hidden entirely per Figma - no
// text and no date/time divider. CHAT_ENDED still fires (contact status is
// handled elsewhere), it just isn't surfaced in the transcript.
const HIDDEN_EVENT_TYPES = [
  ContentType.EVENT_CONTENT_TYPE.CHAT_ENDED,
];

const Timestamp = styled.div`
  ${({ theme }) => theme.typography.supportingText};
  color: ${({ theme }) => theme.globals.timestampColor};
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.micro};
`;

const TimestampDot = styled.span`
  display: inline-block;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.globals.timestampColor};
  margin: 0 ${({ theme }) => theme.spacing.micro};
  vertical-align: middle;
`;

export class SystemMessage extends React.PureComponent {
  static propTypes = {
    messageDetails: PT.object.isRequired,
    authenticationUrl: PT.string
  };

  static defaultProps = {};

  renderTimestamp = () => {
    const transportDetails = this.props.messageDetails.transportDetails;
    const sentTime = transportDetails && transportDetails.sentTime;
    if (!sentTime) {
      return null;
    }
    return (
      <Timestamp>
        {formatDateDisplay(sentTime)}
        <TimestampDot />
        {formatTimeDisplay(sentTime)}
      </Timestamp>
    );
  };

  getMessageText = () => {
    console.log("SystemMessage getMessageText");
    console.log(this.props);
    let name = this.props.messageDetails.displayName;
    const type = this.props.messageDetails.content.type;
    const content = this.props.messageDetails.content;
    switch (type) {
      case ContentType.EVENT_CONTENT_TYPE.PARTICIPANT_JOINED:
        // Per Figma, the "{name} has joined the chat" line is not shown - only
        // the date/time divider from renderTimestamp() stays. Returning null
        // here keeps the timestamp but drops the dynamic text.
        return null;
      case ContentType.EVENT_CONTENT_TYPE.PARTICIPANT_LEFT:
        name = this.props.messageDetails.displayName;
        return <FormattedMessage
            id="transcriptor.leftChat"
            defaultMessage="{name} has left the chat"
            values={{
              name
            }}
        />;
      case ContentType.EVENT_CONTENT_TYPE.AUTHENTICATION_INITIATED:
        return <AuthenticationMessage link={this.props.messageDetails.authenticationUrl} content={content} ></AuthenticationMessage>
      case ContentType.EVENT_CONTENT_TYPE.AUTHENTICATION_EXPIRED:
      case ContentType.EVENT_CONTENT_TYPE.AUTHENTICATION_FAILED:
      case ContentType.EVENT_CONTENT_TYPE.AUTHENTICATION_SUCCESSFUL:
      case ContentType.EVENT_CONTENT_TYPE.AUTHENTICATION_TIMEOUT:
      case ContentType.EVENT_CONTENT_TYPE.AUTHENTICATION_CANCELLED:
        return <AuthenticationMessage content={content}></AuthenticationMessage>
      case ContentType.EVENT_CONTENT_TYPE.CHAT_ENDED:
        return <FormattedMessage
            id="transcriptor.endChat"
            defaultMessage="Chat has ended!"
        />;
      case ContentType.EVENT_CONTENT_TYPE.PARTICIPANT_IDLE:
        return <FormattedMessage
            id="transcriptor.idleChat"
            defaultMessage="{name} has become idle"
            values={{
              name
            }}
        />;
      case ContentType.EVENT_CONTENT_TYPE.PARTICIPANT_DISCONNECT:
        return <FormattedMessage
            id="transcriptor.disconnectChat"
            defaultMessage="{name} has been idle too long, disconnecting"
            values={{
              name
            }}
        />;
      case ContentType.EVENT_CONTENT_TYPE.PARTICIPANT_RETURNED:
        return <FormattedMessage
            id="transcriptor.returnedChat"
            defaultMessage="{name} has returned"
            values={{
              name
            }}
        />;

      default:
        return "";
    }
  };

  render() {
    // Some events (e.g. CHAT_ENDED) are hidden completely - no divider at all.
    if (HIDDEN_EVENT_TYPES.includes(this.props.messageDetails.content.type)) {
      return null;
    }
    // Otherwise the date/time divider always renders; getMessageText() may
    // return null (e.g. PARTICIPANT_JOINED) so only the timestamp shows for
    // that event.
    return (
      <>
        {this.renderTimestamp()}
        {this.getMessageText()}
      </>
    );
  }
}