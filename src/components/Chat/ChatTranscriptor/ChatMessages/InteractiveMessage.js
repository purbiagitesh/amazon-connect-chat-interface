import React, {useState, useLayoutEffect, useRef, useEffect} from 'react';
import PT from "prop-types";
import {Text} from "connect-core";
import {InteractiveMessageType} from "../../datamodel/Model";
import ListPicker from "./InteractiveMessages/ListPicker";
import Panel from "./InteractiveMessages/Panel";
import TimePicker from "./InteractiveMessages/TimePicker";
import QuickReply from "./InteractiveMessages/QuickReply";
import Carousel from "./InteractiveMessages/Carousel";
import OrderCarousel from "./InteractiveMessages/OrderCarousel";
import CaseCarousel from "./InteractiveMessages/CaseCarousel";
import ListConfirmation from "./InteractiveMessages/ListConfirmation";
import ListSelection from "./InteractiveMessages/ListSelection";
import ListSelectionStepper from "./InteractiveMessages/ListSelectionStepper";
import SingleProduct from "./InteractiveMessages/SingleProduct";
import ProductSelector from "./InteractiveMessages/ProductSelector";
import ShadeSelector from "./InteractiveMessages/ShadeSelector";
import {RichMessageRenderer} from "../../RichMessageComponents";
import styled from "styled-components";
import {ContentType} from "../../datamodel/Model"

const MessageBody = styled.div`
  border: ${({ theme}) => theme.globals.baseBorder};
  border-radius: ${({ theme}) => theme.spacing.mini};

  ${props => props.addChildBackgroundStyles ? `
    background: ${props.theme.chatTranscriptor.incomingMsgBg}
    padding: ${props.theme.spacing.small};
    border: none;
    border-radius: 16px;
    ${props.capWidth ? "max-width: 200px;" : ""}
  ` : ""}

  ${props => props.isCarouselElem ? `
    position: relative;
    max-width: 350px;
    min-width: 225px;
    scroll-snap-align: start;
    background: ${props.theme.chatTranscriptor.incomingMsgBg}
    display: flex;
    flex-direction: column;
  ` : ""}

  button {
    cursor: pointer;
    border: ${({ theme}) => theme.globals.baseBorder};
  
    &:hover:enabled {
      color: #fff;
      background: ${({ theme}) => theme.color.primary};
    }
  }
`;

const Title = styled(Text)`
  ${({ theme}) => theme.typography.title};
`;

const Subtitle = styled(Text)`
  ${({ theme}) => theme.typography.body};
  color: ${({ theme}) => theme.globals.textSecondaryColor};
`;

const ElementImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
`;

const TextSection = styled.div`
  padding: ${({ theme}) => theme.spacing.base};
  text-align: left;

  ${props => props.hasNestedSVG ? `
    align-items: center;
    display: flex;
    justify-content: center;
  ` : ""}
`;

const ResponsesSection = styled.div`
  position: relative;
  white-space: pre-line;
  border-radius: ${({ theme}) => theme.spacing.mini};

  ${props => props.isCarouselElem ? `
    margin-top: auto;
    flex: none;
  ` : ""}
`;
const PickerElementLink = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: none;
  border: ${({ theme}) => theme.globals.baseBorder};
  background: ${({ theme}) => theme.palette.white};
  white-space: pre-line;
  ${({ theme}) => theme.typography.label};
  padding-right: ${({ theme}) => theme.spacing.small};
  padding-left: ${({ theme}) => theme.spacing.small};
  padding-top: ${({ theme}) => theme.button.normal.padding};
  padding-bottom: ${({ theme}) => theme.button.normal.padding};
  text-decoration: none;

  &:last-child {
    border-bottom-left-radius: ${({ theme}) => theme.spacing.mini};
    border-bottom-right-radius: ${({ theme}) => theme.spacing.mini};
    margin-bottom: 0;
  }

  a {
    text-decoration: none !important;
  }

  svg {
    color: ${({ theme}) => theme.globals.textSecondaryColor};
    margin: 0 ${({ theme}) => theme.spacing.micro};
  }
`;
const PickerOptionTitle = styled(Text)`
  ${({ theme}) => theme.typography.label};

  a {
    text-decoration: none;
  }

  ${(props) => props.hasNestedSVG ? `
    align-items: center;
    display: flex;
    justify-content: center;
  ` : ""}
`;
//#endregion Styled Components

InteractiveMessage.propTypes = {
  content: PT.object.isRequired,
  templateType: PT.string.isRequired,
  addMessage: PT.func.isRequired,
  isCarouselElem: PT.bool,
  templateIdentifier: PT.string,
  // QUICK_REPLY only: "bubble" / "actions" to render just one half of the
  // template (ChatMessage places the title bubble beside the avatar and the
  // controls in a full-width row below it).
  renderPart: PT.oneOf(["bubble", "actions"])
};

export function InteractiveMessage({content, templateType, addMessage, textInputRef, isCarouselElem, templateIdentifier, renderPart}) {
  const [responseSelected, setResponseSelected] = useState(false);
  const ref = useRef();

  function onAddMessage(data) {
    addMessage(data);
    setResponseSelected(true);
  }

  /**
   * use useEffect to set the necessary attributes and listeners required to 
   * render views and get response from view
   */
  useEffect(() => {
    // function to create chat message from view event
    const viewOnActionCallback = ((event) => {
      const actionData = event.detail;

      const reshapedMessage = {
        action: actionData.Action,
        data: actionData.Output || {},
        templateType: templateType,
        version: '1.0'
      };
      const message = JSON.stringify(reshapedMessage);

      addMessage({text: message, type: ContentType.MESSAGE_CONTENT_TYPE.INTERACTIVE_RESPONSE});
      setResponseSelected(true);
    });

    if (!ref.current) return;
    const viewComponent = ref.current;
    viewComponent.setAttribute('view', JSON.stringify(content));
    viewComponent.addEventListener('onAction', viewOnActionCallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);



  useLayoutEffect(() => {
    if (!textInputRef || !textInputRef.current || !textInputRef.current.focus) {
      return;
    }
    textInputRef.current.focus();
  }, [responseSelected, textInputRef]);

  function renderTemplate() {
    if (templateType === InteractiveMessageType.LIST_PICKER) {
      return <ListPicker content={content} addMessage={onAddMessage} templateType={templateType} isCarouselElem={isCarouselElem} templateIdentifier={templateIdentifier} />
    } else if (templateType === InteractiveMessageType.PANEL) {
      return <Panel content={content} addMessage={onAddMessage} templateType={templateType} isCarouselElem={isCarouselElem} templateIdentifier={templateIdentifier} />
    } else if (templateType === InteractiveMessageType.TIME_PICKER) {
      return <TimePicker content={content} addMessage={onAddMessage} />
    } 
  }

  // Render ViewResource, QuickReply and Carousel outside of <MessageBody />
  if (templateType === InteractiveMessageType.QUICK_REPLY) {
    return <QuickReply content={content} addMessage={onAddMessage} renderPart={renderPart} />
  } else if (templateType === InteractiveMessageType.CAROUSEL) {
    return <Carousel content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.ORDER_CAROUSEL) {
    return <OrderCarousel content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.CASE_CAROUSEL) {
    return <CaseCarousel content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.LIST_CONFIRMATION) {
    return <ListConfirmation content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.LIST_SELECTION) {
    return <ListSelection content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.LIST_SELECTION_STEPPER) {
    return <ListSelectionStepper content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.SINGLE_PRODUCT) {
    return <SingleProduct content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.PRODUCT_SELECTOR) {
    return <ProductSelector content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.SHADE_SELECTOR) {
    return <ShadeSelector content={content} addMessage={onAddMessage} />
  } else if (templateType === InteractiveMessageType.VIEW_RESOURCE) {
    return <connect-view-renderer data-testid="connect-view-renderer" ref={ref} />
  }

  return (
    <MessageBody data-testid={templateIdentifier} isCarouselElem={isCarouselElem}>
      {renderTemplate()}
    </MessageBody>
  );
}

ReactiveImage.propTypes = {
  imageSrc: PT.string,
  imageDescription: PT.string
};

function ReactiveImage({imageSrc, imageDescription, onImageLoad}) {
  return <ElementImage src={imageSrc} alt={imageDescription} onLoad={onImageLoad} onError={(err) => console.log("Failed to load image:", err)} />;
}

HeaderText.propTypes = {
  title: PT.string.isRequired,
  subtitle: PT.string,
};

export function HeaderText({title, subtitle}) {
  return (
    <TextSection>
      <RichMessageRenderer content={title} styledWrapper={Title} />
      {subtitle && (<RichMessageRenderer content={subtitle} styledWrapper={Subtitle} />)}
    </TextSection>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      stroke="none"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
    </svg>
  )
}

export function PickerElementLinkOption({url, title, target, testId}) {
  return (
    <PickerElementLink data-testid={testId}>
      <PickerOptionTitle hasNestedSVG={true}>
        <a href={url} target={target || "_blank"}>
          {title}
        </a>
        <ExternalLinkIcon />
      </PickerOptionTitle>
    </PickerElementLink>
  );
}

export {ReactiveImage, TextSection, Title, Subtitle, ResponsesSection, MessageBody, PickerOptionTitle}
