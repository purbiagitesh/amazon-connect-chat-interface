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
  lastSentMessageId: PT.string,
  lastReceivedMessageId: PT.string
};

ChatTranscriptScroller.defaultProps = {
  loadPreviousTranscript: () => Promise.resolve(),
  lastSentMessageId: '',
  lastReceivedMessageId: ''
};

export default function ChatTranscriptScroller({
  contactId,
  lastSentMessageId,
  lastReceivedMessageId,
  loadPreviousTranscript,
  className,
  children
}) {
  const ref = useRef(null);
  const prevChildren = usePrevious(children);
  const prevLastSentMessageId = usePrevious(lastSentMessageId);
  const prevLastReceivedMessageId = usePrevious(lastReceivedMessageId);
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

  // Distinguishes a scroll WE triggered (by writing scrollTop below) from
  // one the customer actually did themselves - the native 'scroll' event
  // looks identical either way, so every programmatic scrollTop write sets
  // this first; handleScroll consumes it and otherwise treats the event as
  // customer-driven. Needed for burstFrozenRef below.
  const isProgrammaticScrollRef = useRef(false);
  // When several incoming messages land in quick succession (e.g. a bot
  // replying with 3-4 separate messages), only the FIRST one should pull
  // the view down to reveal it - once that happens this flips true and
  // every following message in the same burst is left alone, so the
  // transcript doesn't keep hopping down past what the customer is reading.
  // It's cleared (re-armed) by the customer's own next outgoing message
  // (see the effect below) or by a genuine scroll from them (see
  // handleScroll) - whichever comes first. Only ever set/consulted when
  // lastReceivedMessageId actually changes (a real new incoming message) -
  // never for any other reason children might change (status update on an
  // existing item, a resize, etc. - see the effect below), so those can't
  // burn this burst's one allowed auto-scroll before the real next message
  // arrives.
  const burstFrozenRef = useRef(false);

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
  // Only flags the write as "programmatic" when it will actually move
  // scrollTop - if it's already sitting at `value`, no 'scroll' event fires
  // at all, so flagging it here would leave isProgrammaticScrollRef stuck
  // true and wrongly swallow the NEXT genuine scroll from the customer.
  function writeScrollTop(el, value) {
    if (el.scrollTop !== value) {
      isProgrammaticScrollRef.current = true;
    }
    el.scrollTop = value;
  }
  const preLoadingScrollTop = () =>
    ref.current.scrollHeight - loadingScrollPos;
  // true only on the render where the customer's OWN message id actually
  // changes - i.e. they just sent something new, never for the later
  // render where that same message's optimistic entry gets replaced by the
  // server-confirmed one (same id).
  const isNewOwnMessage = () => lastSentMessageId !== prevLastSentMessageId;
  // true only on the render where a genuinely NEW message from the OTHER
  // side appears - this is deliberately a separate signal from "children
  // changed", which also fires for unrelated updates (status changes,
  // typing indicator, resizes) that must not consume burstFrozenRef.
  const isNewIncomingMessage = () => lastReceivedMessageId !== prevLastReceivedMessageId;

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
      writeScrollTop(ref.current, scrollTop < 0 ? maxScrollTop() : scrollTop);
      setContactScrollStore(contactScrollStore => ({...contactScrollStore, [contactId]: undefined}));
    } else if (isNewOwnMessage()) {
      // The customer just sent something - always scroll to show it, and
      // re-arm: the next incoming message is the first of a new burst, and
      // must be allowed to scroll into view.
      burstFrozenRef.current = false;
      writeScrollTop(ref.current, maxScrollTop());
    } else if (isNewIncomingMessage()) {
      // A genuinely new message from the other side. Only the first one in
      // a burst (burstFrozenRef still false) scrolls into view - every
      // later one in the same burst is left exactly where it is.
      if (lockedToBottom && !burstFrozenRef.current) {
        burstFrozenRef.current = true;
        writeScrollTop(ref.current, maxScrollTop());
      }
    } else if (lockedToBottom) {
      // Neither a new outgoing nor incoming message - e.g. the customer's
      // own message getting its optimistic entry replaced by the server-
      // confirmed one, a typing indicator toggling, or a container resize
      // (composer/disclaimer height changing). If we were already pinned
      // to the bottom, stay pinned - but never touch burstFrozenRef here,
      // so this can't eat the one free scroll meant for the next real
      // incoming message.
      writeScrollTop(ref.current, maxScrollTop());
    } else if (shouldRestorePreLoadingScrollTop()) {
      writeScrollTop(ref.current, preLoadingScrollTop());
      setLoadingScrollPos(null);
    }
  }, [containerHeight, children, lastSentMessageId, lastReceivedMessageId, loading]);

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
        writeScrollTop(el, newContentWhileHiddenRef.current || atBottomBeforeHideRef.current
          ? max
          : Math.min(scrollTopBeforeHideRef.current, max));
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
      // Leaving this contact entirely - don't carry a burst freeze over to
      // whatever contact is shown next.
      burstFrozenRef.current = false;
    };
  }, [contactId]);

  function handleScroll() {
    // Skip the scroll events caused by the browser resetting a hidden/re-shown container
    if (isHiddenRef.current || ref.current.clientHeight === 0) return;
    if (isProgrammaticScrollRef.current) {
      // This 'scroll' event is the result of one of OUR scrollTop writes
      // above, not the customer actually scrolling - consume the flag and
      // don't treat it as a sign they want to keep following new messages.
      isProgrammaticScrollRef.current = false;
    } else {
      // A genuine scroll from the customer - re-arm so the next incoming
      // message (if they're at the bottom) is allowed to scroll into view
      // again. See burstFrozenRef above.
      burstFrozenRef.current = false;
    }
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
