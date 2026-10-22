import React, {useRef, useState, useEffect} from "react";
import {FormattedMessage} from "react-intl";
import PT from "prop-types";
import styled from "styled-components";
import {defaultTheme} from "../../../theme";
import {Text, Loader} from "connect-core";
import {usePrevious} from "connect-hooks";
import {MessageBox} from "./ChatMessages/ChatMessage";

const ScrollContainer = styled.div`
  overflow: auto;
  /* Hide scrollbar while preserving scroll behavior */
  ::-webkit-scrollbar {
    display: none; /* Chrome, Safari and Opera */
  }
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
`;

const SCROLL_BOTTOM_MARGIN = 20;
const SCROLL_TOP_MARGIN = 0;

export const LoaderWrapper = styled(MessageBox) `
  ${({ theme}) => theme.typography.supportingText};
  width: 80%;
  text-align: center;
  transition: 100ms;
  margin: 0 auto;
`;

ChatTranscriptScroller.propTypes = {
  contactId: PT.string.isRequired,
  loadPreviousTranscript: PT.func,
  lastSentMessageId: PT.string
};

ChatTranscriptScroller.defaultProps = {
  loadPreviousTranscript: () => Promise.resolve(),
  lastSentMessageId: ''
};

export default function ChatTranscriptScroller({
  contactId,
  lastSentMessageId,
  loadPreviousTranscript,
  className,
  children
}) {
  const ref = useRef(null);
  const prevChildren = usePrevious(children);
  const prevLastSentMessageId = usePrevious(lastSentMessageId);
  const [loading, setLoading] = useState(false);

  // Stores the scroll position during transcript loading
  const [loadingScrollPos, setLoadingScrollPos] = useState(null);

  // Stored scroll positions for different contactIds
  const [contactScrollStore, setContactScrollStore] = useState({});
  
  // Track container visibility changes (e.g., when launcher is minimized/maximized)
  const [containerHeight, setContainerHeight] = useState(0);

  // The launcher hides the panel with display:none while minimized, which
  // zeroes the container's size and resets its scrollTop. These refs let us
  // restore the right position (or jump to the latest message) on reopen.
  const isHiddenRef = useRef(false);
  const atBottomBeforeHideRef = useRef(true);
  const scrollTopBeforeHideRef = useRef(0);
  const newContentWhileHiddenRef = useRef(false);
 
  const lockedToBottom = ref && ref.current
    ? ref.current.clientHeight === 0 ||
      ref.current.scrollHeight - ref.current.clientHeight <= ref.current.scrollTop + SCROLL_BOTTOM_MARGIN
    : true;
 
  function isValidScrollTop(scrollTop) {
    return scrollTop !== undefined && (
      scrollTop <= ref.current.scrollHeight - ref.current.clientHeight || scrollTop < 0
    );
  }
  const maxScrollTop = () =>
    ref.current.scrollHeight - ref.current.clientHeight;
  const preLoadingScrollTop = () =>
    ref.current.scrollHeight - loadingScrollPos;
  const shouldScrollToBottom = () =>
    // Scroll down if we are either locked to bottom or have sent a new message
    lockedToBottom || lastSentMessageId !== prevLastSentMessageId;
 
  const shouldRestorePreLoadingScrollTop = () =>
    children !== prevChildren && loading && loadingScrollPos;
 
  useEffect(() => {
    if (ref.current.clientHeight === 0) {
      // Hidden (launcher minimized): sizes are meaningless, so don't scroll;
      // just remember that messages arrived so we can scroll on reopen.
      if (children !== prevChildren) {
        newContentWhileHiddenRef.current = true;
      }
      return;
    }
    const scrollTop = contactScrollStore[contactId];
    if (isValidScrollTop(scrollTop)) {
      ref.current.scrollTop = scrollTop < 0 ? maxScrollTop() : scrollTop;
      setContactScrollStore(contactScrollStore => ({...contactScrollStore, [contactId]: undefined}));
    } else if (shouldScrollToBottom()) {
      ref.current.scrollTop = maxScrollTop();
    } else if (shouldRestorePreLoadingScrollTop()) {
      ref.current.scrollTop = preLoadingScrollTop();
      setLoadingScrollPos(null);
    }
  }, [containerHeight, children, lastSentMessageId, loading]);
 
  useEffect(() => {
    // When loading has started, we store the scroll position from bottom
    if (loading) {
      setLoadingScrollPos(ref.current.scrollHeight - ref.current.scrollTop);
    }
  }, [loading]);
 
  useEffect(() => {
    // Monitor container size changes (e.g., when launcher is minimized/maximized)
    if (!ref.current) return;
 
    const resizeObserver = new ResizeObserver(() => {
      const el = ref.current;
      if (!el) return;
      if (el.clientHeight === 0) {
        isHiddenRef.current = true;
        return;
      }
      if (isHiddenRef.current) {
        // Container just became visible again: scroll to the latest message
        // if new ones arrived while hidden or we were at the bottom before;
        // otherwise put back the previous position.
        const max = el.scrollHeight - el.clientHeight;
        el.scrollTop = newContentWhileHiddenRef.current || atBottomBeforeHideRef.current
          ? max
          : Math.min(scrollTopBeforeHideRef.current, max);
        newContentWhileHiddenRef.current = false;
        isHiddenRef.current = false;
      }
      setContainerHeight(el.clientHeight);
    });
 
    resizeObserver.observe(ref.current);
 
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
 
  useEffect(() => {
    return () => {
      // When leaving a tab, we store scroll position or -1 if scrolled all the way down
      const scrolledToBottom = maxScrollTop() <= ref.current.scrollTop + SCROLL_BOTTOM_MARGIN;
      const scrollTop = scrolledToBottom ? -1 : ref.current.scrollTop;
      setContactScrollStore(contactScrollStore => ({...contactScrollStore, [contactId]: scrollTop}));
    };
  }, [contactId]);
 
  function handleScroll() {
    // Skip the scroll events caused by the browser resetting a hidden/re-shown container
    if (isHiddenRef.current || ref.current.clientHeight === 0) return;
    atBottomBeforeHideRef.current =
      maxScrollTop() <= ref.current.scrollTop + SCROLL_BOTTOM_MARGIN;
    scrollTopBeforeHideRef.current = ref.current.scrollTop;
    // Start loading transcript if scrolled all the way up
    const startLoading = ref.current.scrollHeight > ref.current.clientHeight && ref.current.scrollTop <= SCROLL_TOP_MARGIN && !loading;
    if (startLoading) {
      setLoading(true);
      loadPreviousTranscript().then(() => {
        setLoading(false);
      });
    }
  }
 
  return (
    <ScrollContainer ref={ref} onScroll={handleScroll} className={className}>
      { loading &&
        <LoaderWrapper>
          <Loader size={20} color={defaultTheme.color.primary} />
          <Text>
            <span>
              <FormattedMessage
                  id="connect-chat-transcriptor-loading-msg"
                  defaultMessage="Loading previous messages..."
              />
            </span>
          </Text>
        </LoaderWrapper>
      }
      {children}
    </ScrollContainer>
  );
}