"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Video, MoreVertical } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useMessages } from "../../hooks/useMessages";
import { notificationManager } from "../../utils/notifications";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

const ChatWindow = React.memo(
  ({
    selectedChat,
    setSelectedChat,
    socket,
    isMobile,
    onlineUsers,
    onUpdateChatLatestMessage,
  }) => {
    const [typing, setTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [replyTo, setReplyTo] = useState(null);
    const { user } = useAuth();
    const typingTimeoutRef = useRef(null);

    const {
      messages,
      loading,
      hasMore,
      sendMessage,
      editMessage,
      deleteMessage,
      likeMessage,
      markAsRead,
      addMessage,
      updateMessage,
      removeMessage,
      loadMoreMessages,
      messagesContainerRef,
      scrollToBottom,
    } = useMessages(selectedChat?._id);

    // Initialize notifications on component mount
    useEffect(() => {
      notificationManager.requestPermission();
      notificationManager.registerServiceWorker();
    }, []);

    useEffect(() => {
      if (socket && selectedChat) {
        socket.emit("join-chat", selectedChat._id);

        const handleReceiveMessage = (message) => {
          if (
            message.chat._id === selectedChat._id ||
            message.chat === selectedChat._id
          ) {
            addMessage(message);
            onUpdateChatLatestMessage(selectedChat._id, message);

            // Auto-mark as read if sender is not current user
            if (message.sender._id !== user.id) {
              setTimeout(() => {
                markAsRead(message._id).then((response) => {
                  // Emit read status to other users
                  if (socket && response) {
                    socket.emit("message-read", {
                      messageId: message._id,
                      chatId: selectedChat._id,
                      userId: user.id,
                      readBy: response.readBy
                    });
                  }
                });
              }, 500);
            }
          }
        };

        const handleUserTyping = (data) => {
          if (data.chatId === selectedChat._id && data.userId !== user.id) {
            setTypingUsers((prev) =>
              prev.includes(data.userId) ? prev : [...prev, data.userId]
            );
          }
        };

        const handleUserStopTyping = (data) => {
          if (data.chatId === selectedChat._id) {
            setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
          }
        };

        const handleMessageRead = (data) => {
          if (data.chatId === selectedChat._id) {
            updateMessage(data.messageId, {
              readBy: data.readBy || [
                ...(messages.find((m) => m._id === data.messageId)?.readBy || []),
                { user: { _id: data.userId }, readAt: new Date() },
              ],
            });
          }
        };

        const handleMessageDelivered = (data) => {
          if (data.chatId === selectedChat._id) {
            updateMessage(data.messageId, {
              deliveredTo: data.deliveredTo || [
                ...(messages.find((m) => m._id === data.messageId)?.deliveredTo || []),
                { user: data.userId, deliveredAt: new Date() },
              ],
            });
          }
        };

        const handleMessageLiked = (data) => {
          if (data.chatId === selectedChat._id) {
            updateMessage(data.messageId, { likes: data.likes });
          }
        };

        const handleMessageEdited = (data) => {
          if (data.chatId === selectedChat._id) {
            updateMessage(data.messageId, {
              content: data.content,
              isEdited: true,
            });
          }
        };

        const handleMessageDeleted = (data) => {
          if (data.chatId === selectedChat._id) {
            removeMessage(data.messageId);
          }
        };

        socket.on("receive-message", handleReceiveMessage);
        socket.on("user-typing", handleUserTyping);
        socket.on("user-stop-typing", handleUserStopTyping);
        socket.on("message-read", handleMessageRead);
        socket.on("message-delivered", handleMessageDelivered);
        socket.on("message-liked", handleMessageLiked);
        socket.on("message-edited", handleMessageEdited);
        socket.on("message-deleted", handleMessageDeleted);

        return () => {
          socket.off("receive-message", handleReceiveMessage);
          socket.off("user-typing", handleUserTyping);
          socket.off("user-stop-typing", handleUserStopTyping);
          socket.off("message-read", handleMessageRead);
          socket.off("message-delivered", handleMessageDelivered);
          socket.off("message-liked", handleMessageLiked);
          socket.off("message-edited", handleMessageEdited);
          socket.off("message-deleted", handleMessageDeleted);
        };
      }
    }, [
      socket,
      selectedChat,
      user.id,
      addMessage,
      updateMessage,
      removeMessage,
      markAsRead,
      onUpdateChatLatestMessage,
      messages,
    ]);

    const handleSendMessage = useCallback(
      async (content, messageType = "text", file = null, replyToMsg = null) => {
        try {
          const newMessage = await sendMessage(
            content,
            messageType,
            file,
            replyToMsg
          );

          if (socket && newMessage) {
            socket.emit("send-message", {
              ...newMessage,
              chatId: selectedChat._id,
            });
            onUpdateChatLatestMessage(selectedChat._id, newMessage);
          }
        } catch (error) {
          console.error("Send message error:", error);
        }
      },
      [sendMessage, socket, selectedChat, onUpdateChatLatestMessage]
    );

    const handleEditMessage = useCallback(
      async (messageId, newContent) => {
        try {
          await editMessage(messageId, newContent);
          if (socket) {
            socket.emit("message-edited", {
              messageId,
              content: newContent,
              chatId: selectedChat._id,
            });
          }
        } catch (error) {
          console.error("Edit message error:", error);
        }
      },
      [editMessage, socket, selectedChat]
    );

    const handleDeleteMessage = useCallback(
      async (messageId) => {
        if (window.confirm("Are you sure you want to delete this message?")) {
          try {
            await deleteMessage(messageId);
            if (socket) {
              socket.emit("message-deleted", {
                messageId,
                chatId: selectedChat._id,
              });
            }
          } catch (error) {
            console.error("Delete message error:", error);
          }
        }
      },
      [deleteMessage, socket, selectedChat]
    );

    const handleLikeMessage = useCallback(
      async (messageId) => {
        try {
          const likes = await likeMessage(messageId);
          if (socket) {
            socket.emit("message-liked", {
              messageId,
              likes,
              chatId: selectedChat._id,
              userId: user.id,
            });
          }
        } catch (error) {
          console.error("Like message error:", error);
        }
      },
      [likeMessage, socket, selectedChat, user.id]
    );

    const handleTyping = useCallback(() => {
      if (!socket || !selectedChat) return;

      if (!typing) {
        setTyping(true);
        socket.emit("typing", {
          chatId: selectedChat._id,
          userId: user.id,
          userName: user.name,
        });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
        socket.emit("stop-typing", {
          chatId: selectedChat._id,
          userId: user.id,
        });
      }, 1000);
    }, [socket, selectedChat, typing, user]);

    const chatInfo = useMemo(() => {
      if (!selectedChat) return { name: "", avatar: "", status: "" };

      if (selectedChat.isGroupChat) {
        return {
          name: selectedChat.chatName,
          avatar:
            selectedChat.groupImage ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              selectedChat.chatName
            )}&background=8b5cf6&color=fff`,
          status: `${selectedChat.users.length} members`,
        };
      }

      const otherUser = selectedChat.users.find((u) => u._id !== user.id);
      const isOnline = onlineUsers.includes(otherUser?._id);

      let status = "";
      if (typingUsers.length > 0) {
        status = "typing...";
      } else if (isOnline) {
        status = "Active now";
      } else if (otherUser?.lastSeen) {
        const date = new Date(otherUser.lastSeen);
        status = `Last seen ${date.toLocaleString("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
          day: "numeric",
          month: "short",
        })}`;
      } else {
        status = "Last seen unknown";
      }

      return {
        name: otherUser?.name || "Unknown User",
        avatar:
          otherUser?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            otherUser?.name || "User"
          )}&background=8b5cf6&color=fff`,
        status,
        isOnline,
      };
    }, [selectedChat, user.id, onlineUsers, typingUsers]);

    if (!selectedChat) {
      return (
        <div className="chat-window-empty">
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3>DSync – perfect for connecting and sharing.</h3>
            <p>Choose from your existing conversations or start a new one</p>
          </div>
        </div>
      );
    }

    return (
      <div className="chat-window">
        <div className="chat-header">
          {isMobile && (
            <motion.button
              className="back-btn"
              onClick={() => setSelectedChat(null)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft size={20} />
            </motion.button>
          )}

          <div className="chat-info">
            <div className="chat-avatar-container">
              <img
                src={chatInfo.avatar || "/placeholder.svg"}
                alt={chatInfo.name}
                className="chat-avatar"
              />
              {!selectedChat.isGroupChat && chatInfo.isOnline && (
                <div className="online-indicator"></div>
              )}
            </div>
            <div className="chat-details">
              <h3 className="chat-name">{chatInfo.name}</h3>
              <span className="chat-status">{chatInfo.status}</span>
            </div>
          </div>

          <div className="chat-actions">
            <motion.button
              className="action-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Phone size={18} />
            </motion.button>
            <motion.button
              className="action-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Video size={18} />
            </motion.button>
            <motion.button
              className="action-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <MoreVertical size={18} />
            </motion.button>
          </div>
        </div>

        {loading && messages.length === 0 ? (
          <div className="loading-messages">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`message-skeleton ${
                  i % 2 === 0 ? "sent" : "received"
                }`}
              >
                <div className="skeleton-bubble"></div>
              </div>
            ))}
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentUser={user}
            typingUsers={typingUsers}
            onLike={handleLikeMessage}
            onReply={(msg) => setReplyTo(msg)}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
            hasMore={hasMore}
            loading={loading}
            onLoadMore={loadMoreMessages}
            messagesContainerRef={messagesContainerRef}
          />
        )}

        <MessageInput
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
        />
      </div>
    );
  }
);

ChatWindow.displayName = "ChatWindow";

export default ChatWindow;