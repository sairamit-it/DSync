"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import api from "../utils/api";
import { storage } from "../utils/storage";

export const useMessages = (chatId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const optimisticMessagesRef = useRef(new Map());
  const MESSAGES_PER_PAGE = 20;

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId) {
      // Load cached messages first
      const cachedMessages = storage.getMessages(chatId);
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      }

      // Reset pagination
      setPage(1);
      setHasMore(true);

      // Fetch latest messages
      fetchMessages(true);
    } else {
      setMessages([]);
      setPage(1);
      setHasMore(true);
      optimisticMessagesRef.current.clear();
    }
  }, [chatId]);

  const fetchMessages = useCallback(
    async (isInitial = false) => {
      if (!chatId || loading) return;

      setLoading(true);
      try {
        const currentPage = isInitial ? 1 : page;
        const response = await api.get(
          `/message/${chatId}?page=${currentPage}&limit=${MESSAGES_PER_PAGE}`
        );
        const newMessages = response.data;

        if (isInitial) {
          setMessages(newMessages);
          storage.setMessages(chatId, newMessages);
          setPage(2);
        } else {
          // For pagination, prepend older messages
          setMessages((prev) => {
            const combined = [...newMessages, ...prev];
            // Remove duplicates
            const unique = combined.filter(
              (msg, index, arr) =>
                arr.findIndex((m) => m._id === msg._id) === index
            );
            storage.setMessages(chatId, unique);
            return unique;
          });
          setPage((prev) => prev + 1);
        }

        // Check if there are more messages
        setHasMore(newMessages.length === MESSAGES_PER_PAGE);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [chatId, loading, page]
  );

  const loadMoreMessages = useCallback(() => {
    if (hasMore && !loading) {
      fetchMessages(false);
    }
  }, [hasMore, loading, fetchMessages]);

  const generateOptimisticId = () =>
    `optimistic_${Date.now()}_${Math.random()}`;

  const sendMessage = useCallback(
    async (content, messageType = "text", file = null, replyTo = null) => {
      if (!chatId || (!content?.trim() && !file)) return;

      const optimisticId = generateOptimisticId();

      // Get current user from auth context or localStorage
      const getCurrentUser = () => {
        try {
          // Try to get from localStorage first
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            return JSON.parse(storedUser);
          }

          // Fallback to cookie parsing
          const userCookie = document.cookie
            .split("; ")
            .find((row) => row.startsWith("user="));

          if (userCookie) {
            return JSON.parse(decodeURIComponent(userCookie.split("=")[1]));
          }

          // Default fallback
          return { id: "temp", name: "You", avatar: "" };
        } catch (error) {
          console.error("Error getting current user:", error);
          return { id: "temp", name: "You", avatar: "" };
        }
      };

      const currentUser = getCurrentUser();

      // Create optimistic message with animation
      const optimisticMessage = {
        _id: optimisticId,
        content: content || (file ? file.name : ""),
        messageType,
        sender: {
          _id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
        },
        chat: chatId,
        createdAt: new Date().toISOString(),
        replyTo,
        likes: [],
        readBy: [],
        deliveredTo: [],
        isOptimistic: true,
        status: "sending",
      };

      // Add optimistic message immediately with animation
      setMessages((prev) => {
        const updated = [...prev, optimisticMessage];
        storage.setMessages(chatId, updated);
        return updated;
      });
      optimisticMessagesRef.current.set(optimisticId, optimisticMessage);

      try {
        let response;

        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("chatId", chatId);
          if (replyTo) formData.append("replyTo", replyTo._id);

          response = await api.post("/message/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          const payload = {
            content: content.trim(),
            chatId,
            messageType,
          };

          if (replyTo) payload.replyTo = replyTo._id;
          response = await api.post("/message", payload);
        }

        const realMessage = response.data;

        // Replace optimistic message with real message
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg._id === optimisticId ? { ...realMessage, status: "sent" } : msg
          );
          storage.setMessages(chatId, updated);
          return updated;
        });

        optimisticMessagesRef.current.delete(optimisticId);
        return realMessage;
      } catch (error) {
        console.error("Failed to send message:", error);

        // Mark optimistic message as failed
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg._id === optimisticId ? { ...msg, status: "failed" } : msg
          );
          storage.setMessages(chatId, updated);
          return updated;
        });

        throw error;
      }
    },
    [chatId]
  );

  const editMessage = useCallback(
    async (messageId, newContent) => {
      // Optimistic update
      const originalMessage = messages.find((msg) => msg._id === messageId);
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg._id === messageId
            ? { ...msg, content: newContent, isEdited: true }
            : msg
        );
        storage.setMessages(chatId, updated);
        return updated;
      });

      try {
        const response = await api.put(`/message/${messageId}/edit`, {
          content: newContent,
        });

        return response.data;
      } catch (error) {
        console.error("Failed to edit message:", error);

        // Revert optimistic update
        if (originalMessage) {
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg._id === messageId ? originalMessage : msg
            );
            storage.setMessages(chatId, updated);
            return updated;
          });
        }

        throw error;
      }
    },
    [messages, chatId]
  );

  const deleteMessage = useCallback(
    async (messageId) => {
      // Optimistic update - remove message immediately
      const messageToDelete = messages.find((msg) => msg._id === messageId);
      setMessages((prev) => {
        const updated = prev.filter((msg) => msg._id !== messageId);
        storage.setMessages(chatId, updated);
        return updated;
      });

      try {
        await api.delete(`/message/${messageId}`);
      } catch (error) {
        console.error("Failed to delete message:", error);

        // Revert optimistic update
        if (messageToDelete) {
          setMessages((prev) => {
            const updated = [...prev, messageToDelete].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
            storage.setMessages(chatId, updated);
            return updated;
          });
        }

        throw error;
      }
    },
    [messages, chatId]
  );

  const likeMessage = useCallback(
    async (messageId) => {
      // Get current user
      const getCurrentUser = () => {
        try {
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            const user = JSON.parse(storedUser);
            return { id: user.id };
          }

          const userCookie = document.cookie
            .split("; ")
            .find((row) => row.startsWith("user="));

          if (userCookie) {
            const user = JSON.parse(
              decodeURIComponent(userCookie.split("=")[1])
            );
            return { id: user.id };
          }

          return { id: "temp" };
        } catch (error) {
          console.error("Error getting current user for like:", error);
          return { id: "temp" };
        }
      };

      const currentUser = getCurrentUser();

      // Optimistic update
      const originalMessage = messages.find((msg) => msg._id === messageId);
      let newLikes;

      setMessages((prev) => {
        const updated = prev.map((msg) => {
          if (msg._id === messageId) {
            const likes = msg.likes || [];
            const isLiked = likes.includes(currentUser.id);
            newLikes = isLiked
              ? likes.filter((id) => id !== currentUser.id)
              : [...likes, currentUser.id];
            return { ...msg, likes: newLikes };
          }
          return msg;
        });
        storage.setMessages(chatId, updated);
        return updated;
      });

      try {
        const response = await api.put(`/message/${messageId}/like`);
        const { likes } = response.data;

        // Update with server response
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg._id === messageId ? { ...msg, likes } : msg
          );
          storage.setMessages(chatId, updated);
          return updated;
        });

        return likes;
      } catch (error) {
        console.error("Failed to like message:", error);

        // Revert optimistic update
        if (originalMessage) {
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg._id === messageId ? originalMessage : msg
            );
            storage.setMessages(chatId, updated);
            return updated;
          });
        }

        throw error;
      }
    },
    [messages, chatId]
  );

  const markAsRead = useCallback(async (messageId) => {
    try {
      await api.put(`/message/${messageId}/read`);
    } catch (error) {
      console.error("Failed to mark message as read:", error);
    }
  }, []);

  const addMessage = useCallback(
    (message) => {
      setMessages((prev) => {
        const exists = prev.find((m) => m._id === message._id);
        if (exists) return prev;

        const updated = [...prev, message];
        storage.setMessages(chatId, updated);
        return updated;
      });
    },
    [chatId]
  );

  const updateMessage = useCallback(
    (messageId, updates) => {
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg._id === messageId ? { ...msg, ...updates } : msg
        );
        storage.setMessages(chatId, updated);
        return updated;
      });
    },
    [chatId]
  );

  const removeMessage = useCallback(
    (messageId) => {
      setMessages((prev) => {
        const updated = prev.filter((msg) => msg._id !== messageId);
        storage.setMessages(chatId, updated);
        return updated;
      });
    },
    [chatId]
  );

  return {
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
  };
};
