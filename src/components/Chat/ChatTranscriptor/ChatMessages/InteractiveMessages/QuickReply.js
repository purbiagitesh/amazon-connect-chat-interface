import React from "react";
import styled from "styled-components";
import PT from "prop-types";
import {RichMessageRenderer} from "../../../RichMessageComponents";
import {Button} from "connect-core";
import {MessageBody} from "../InteractiveMessage";
import {truncateStrFromCharLimit} from "../../../../../utils/helper";
import {InteractiveMessageType} from "../../../datamodel/Model";

const customerQuickReplyStyles = {
  color: "#FFEA00",
  background: '#D2042D'
}

const ResponsesSection = styled.div`
  padding: ${({ theme}) => theme.spacing.base} 0;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  gap: ${({ theme}) => theme.spacing.mini};
  justify-content: flex-end;
`;

const QuickReplyOption = styled.button`
  display: block;
  width: 100%;
  padding: 14px 20px;
  margin-bottom: 10px;
  border: none;
  border-radius: 24px;
  background-color: #D6D6FA;
  color: #1A1A1A;
  font-size: 15px;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: #C4C4F8;
  }
`;

function ReplyElement({element, handleSelection}) {
  const title = truncateStrFromCharLimit( element.title, InteractiveMessageType.QUICK_REPLY, "replyOptionCharLimit");

  return (
    <QuickReplyOption onClick={() => handleSelection({ text: element.title})}>
      {title}
    </QuickReplyOption>
  );
}

QuickReply.propTypes = {
  content: PT.object.isRequired,
  addMessage: PT.func.isRequired,
};

export default function QuickReply({content, addMessage}) {
  const {title: inputTitle, elements} = content;
  const title = truncateStrFromCharLimit(inputTitle, InteractiveMessageType.QUICK_REPLY, "titleCharLimit");

  return (
    <>
      <MessageBody addChildBackgroundStyles={true} data-testid="interactive-quickreply-message-title" applySpeechBubbleCaret={true}>
        <RichMessageRenderer content={title} />
      </MessageBody>
      <ResponsesSection data-testid="interactive-quickreply-response-section">
        {elements.map((element, index) => (
          <ReplyElement
            element={element}
            handleSelection={addMessage}
            key={index}
          />
        ))}
      </ResponsesSection>
    </>
  );
}
