import React, { memo, useMemo, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import MessageItem from "./MessageItem";

const MessageList = memo(
  ({
    messages,
    currentUser,
    typingUsers,
    onLike,
    onReply,
    onEdit,
    onDelete,
    hasMore,
    loading,
    onLoadMore,
    messagesContainerRef,
  }) => {
    const messagesEndRef = useRef(null);
    const loadMoreTriggerRef = useRef(null);
    const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);

    // Intersection Observer for load more trigger
    useEffect(() => {
      if (!loadMoreTriggerRef.current || !hasMore || loading) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            onLoadMore();
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(loadMoreTriggerRef.current);

      return () => observer.disconnect();
    }, [hasMore, loading, onLoadMore]);

    // Handle scroll to detect if user is at bottom
    const handleScroll = useCallback((e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
      setShouldAutoScroll(isAtBottom);
    }, []);

    // Auto-scroll to bottom for new messages only if user is at bottom
    useEffect(() => {
      if (shouldAutoScroll && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, [messages, shouldAutoScroll]);

    const formatDate = (date) => {
      const messageDate = new Date(date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (messageDate.toDateString() === today.toDateString()) {
        return "Today";
      } else if (messageDate.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      } else {
        return messageDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    };

    const shouldShowDateSeparator = (currentMessage, previousMessage) => {
      if (!previousMessage) return true;

      const currentDate = new Date(currentMessage.createdAt).toDateString();
      const previousDate = new Date(previousMessage.createdAt).toDateString();

      return currentDate !== previousDate;
    };

    const shouldShowAvatar = (currentMessage, nextMessage) => {
      if (!nextMessage) return true;
      if (currentMessage.sender._id === currentUser.id) return false;

      return currentMessage.sender._id !== nextMessage.sender._id;
    };

    const shouldShowSenderName = (currentMessage, previousMessage) => {
      if (currentMessage.sender._id === currentUser.id) return false;
      if (!previousMessage) return true;

      return currentMessage.sender._id !== previousMessage.sender._id;
    };

    const messageElements = useMemo(() => {
      return messages.map((message, index) => {
        const showDateSeparator = shouldShowDateSeparator(
          message,
          messages[index - 1]
        );
        const showAvatar = shouldShowAvatar(message, messages[index + 1]);
        const showSenderName = shouldShowSenderName(
          message,
          messages[index - 1]
        );

        return (
          <React.Fragment key={message._id}>
            {showDateSeparator && (
              <div className="date-separator">
                <span>{formatDate(message.createdAt)}</span>
              </div>
            )}

            <MessageItem
              message={message}
              currentUser={currentUser}
              showAvatar={showAvatar}
              showSenderName={showSenderName}
              onLike={onLike}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </React.Fragment>
        );
      });
    }, [messages, currentUser, onLike, onReply, onEdit, onDelete]);

    return (
      <div
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        <div className="message-list">
          {/* Load more trigger at top */}
          {hasMore && (
            <div 
              ref={loadMoreTriggerRef} 
              className="load-more-trigger"
              style={{ 
                height: '20px', 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                padding: '10px',
                color: '#8696a0',
                fontSize: '12px'
              }}
            >
              {loading ? 'Loading older messages...' : ''}
            </div>
          )}

          {/* Messages */}
          {messageElements}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <motion.div
              className="typing-indicator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="typing-avatar">
                <img
                  src={`https://ui-avatars.com/api/?name=User&background=8b5cf6&color=fff&size=56`}
                  alt="Typing user"
                />
              </div>
              <div className="typing-bubble">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>
    );
  }
);

MessageList.displayName = "MessageList";

export default MessageList;