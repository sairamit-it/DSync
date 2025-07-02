import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Users, Check, CheckCheck } from 'lucide-react';

const ChatList = memo(({ 
  chats, 
  loading, 
  selectedChat, 
  onChatSelect, 
  currentUser, 
  onlineUsers 
}) => {
  const formatTime = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now - messageDate) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else if (diffInHours < 168) {
      return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getChatName = (chat) => {
    if (chat.isGroupChat) {
      return chat.chatName;
    }
    const otherUser = chat.users.find((user) => user._id !== currentUser.id);
    return otherUser?.name || 'Unknown User';
  };

  const getChatAvatar = (chat) => {
    if (chat.isGroupChat) {
      return chat.groupImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.chatName)}&background=8b5cf6&color=fff`;
    }
    const otherUser = chat.users.find((user) => user._id !== currentUser.id);
    return otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || 'User')}&background=8b5cf6&color=fff`;
  };

  const isUserOnline = (chat) => {
    if (chat.isGroupChat) return false;
    const otherUser = chat.users.find((user) => user._id !== currentUser.id);
    return onlineUsers.includes(otherUser?._id);
  };

  const getLastMessagePreview = (message) => {
    if (!message) return 'No messages yet';

    const isOwn = message.sender._id === currentUser.id;
    const prefix = isOwn ? 'You: ' : '';

    if (message.messageType === 'image') {
      return `${prefix}📷 Photo`;
    }

    return `${prefix}${message.content}`;
  };

  if (loading) {
    return (
      <div className="loading-chats">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="chat-skeleton">
            <div className="skeleton-avatar"></div>
            <div className="skeleton-content">
              <div className="skeleton-line"></div>
              <div className="skeleton-line short"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="empty-chats">
        <Users size={48} className="empty-icon" />
        <h3>No conversations yet</h3>
        <p>Start a new chat to begin messaging</p>
      </div>
    );
  }

  return (
    <div className="chat-list">
      {chats.map((chat, index) => (
        <motion.div
          key={chat._id}
          className={`chat-item ${selectedChat?._id === chat._id ? 'active' : ''}`}
          onClick={() => onChatSelect(chat)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="chat-avatar-container">
            <img 
              src={getChatAvatar(chat)} 
              alt={getChatName(chat)} 
              className="chat-avatar" 
            />
            {!chat.isGroupChat && isUserOnline(chat) && (
              <div className="online-dot"></div>
            )}
            {chat.isGroupChat && (
              <div className="group-indicator">
                <Users size={12} />
              </div>
            )}
          </div>

          <div className="chat-info">
            <div className="chat-header">
              <h4 className="chat-name">{getChatName(chat)}</h4>
              {chat.latestMessage && (
                <span className="chat-time">
                  {formatTime(chat.latestMessage.createdAt)}
                </span>
              )}
            </div>

            <div className="chat-preview">
              <p className="last-message">
                {getLastMessagePreview(chat.latestMessage)}
              </p>

              {chat.latestMessage?.sender._id === currentUser.id && (
                <div className="message-status">
                  {chat.latestMessage.readBy?.length > 1 ? (
                    <CheckCheck size={16} className="read" />
                  ) : (
                    <Check size={16} className="sent" />
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedChat?._id === chat._id && (
            <motion.div
              className="active-indicator"
              layoutId="activeChat"
              initial={false}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
});

ChatList.displayName = 'ChatList';

export default ChatList;