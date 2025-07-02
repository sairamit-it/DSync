"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import api from "../utils/api";
import { storage } from "../utils/storage";
import { notificationManager } from "../utils/notifications";

export const useMessages = (chatId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const optimisticMessagesRef = useRef(new Map());
  const messagesContainerRef = useRef(null);
  const lastScrollHeight = useRef(0);
  const isLoadingMore = useRef(false);
  const processedMessageIds = useRef(new Set());
  const MESSAGES_PER_PAGE = 20;

  // Auto-scroll to bottom for new messages
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      });
    }
  }, []);

  // Maintain scroll position when loading older messages
  const maintainScrollPosition = useCallback(() => {
    if (messagesContainerRef.current && isLoadingMore.current) {
      const container = messagesContainerRef.current;
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - lastScrollHeight.current;
      container.scrollTop = container.scrollTop + scrollDiff;
      isLoadingMore.current = false;
    }
  }, []);

  // Helper function to get current user safely
  const getCurrentUser = useCallback(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        return JSON.parse(storedUser);
      }
      return null;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }, []);

  // Helper function to deduplicate messages
  const deduplicateMessages = useCallback((messageList) => {
    const seen = new Set();
    return messageList.filter(msg => {
      if (seen.has(msg._id)) {
        return false;
      }
      seen.add(msg._id);
      return true;
    });
  }, []);

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId) {
      // Clear previous state
      processedMessageIds.current.clear();
      optimisticMessagesRef.current.clear();
      
      // Load cached messages first
      const cachedMessages = storage.getMessages(chatId);
      if (cachedMessages.length > 0) {
        const dedupedMessages = deduplicateMessages(cachedMessages);
        setMessages(dedupedMessages);
        // Mark cached messages as processed
        dedupedMessages.forEach(msg => processedMessageIds.current.add(msg._id));
        // Auto-scroll to bottom when opening chat
        setTimeout(() => scrollToBottom(false), 100);
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
      processedMessageIds.current.clear();
      optimisticMessagesRef.current.clear();
    }
  }, [chatId, scrollToBottom, deduplicateMessages]);

  // Maintain scroll position after loading more messages
  useEffect(() => {
    maintainScrollPosition();
  }, [messages, maintainScrollPosition]);

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
          // For initial load, replace all messages
          const dedupedMessages = deduplicateMessages(newMessages);
          setMessages(dedupedMessages);
          storage.setMessages(chatId, dedupedMessages);
          // Mark messages as processed
          dedupedMessages.forEach(msg => processedMessageIds.current.add(msg._id));
          setPage(2);
          // Auto-scroll to bottom for initial load
          setTimeout(() => scrollToBottom(false), 100);
        } else {
          // For pagination, store current scroll height
          if (messagesContainerRef.current) {
            lastScrollHeight.current = messagesContainerRef.current.scrollHeight;
            isLoadingMore.current = true;
          }

          // Prepend older messages, avoiding duplicates
          setMessages((prev) => {
            const filteredNewMessages = newMessages.filter(
              msg => !processedMessageIds.current.has(msg._id)
            );
            
            const combined = [...filteredNewMessages, ...prev];
            const unique = deduplicateMessages(combined);
            
            // Mark new messages as processed
            filteredNewMessages.forEach(msg => processedMessageIds.current.add(msg._id));
            
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
    [chatId, loading, page, scrollToBottom, deduplicateMessages]
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
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        console.error("No current user found");
        return;
      }

      // Create optimistic message with correct sender info
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
        readBy: [{ user: { _id: currentUser.id }, readAt: new Date() }],
        deliveredTo: [],
        isOptimistic: true,
        status: "sending",
      };

      // Add optimistic message immediately
      setMessages((prev) => {
        const updated = [...prev, optimisticMessage];
        storage.setMessages(chatId, updated);
        return updated;
      });
      optimisticMessagesRef.current.set(optimisticId, optimisticMessage);
      processedMessageIds.current.add(optimisticId);

      // Auto-scroll to bottom for new message
      setTimeout(() => scrollToBottom(true), 50);

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

        // Update processed IDs
        processedMessageIds.current.delete(optimisticId);
        processedMessageIds.current.add(realMessage._id);
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
    [chatId, scrollToBottom, getCurrentUser]
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

      // Remove from processed IDs
      processedMessageIds.current.delete(messageId);

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
          processedMessageIds.current.add(messageId);
        }

        throw error;
      }
    },
    [messages, chatId]
  );

  const likeMessage = useCallback(
    async (messageId) => {
      const currentUser = getCurrentUser();
      if (!currentUser) return;

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
    [messages, chatId, getCurrentUser]
  );

  const markAsRead = useCallback(async (messageId) => {
    try {
      const response = await api.put(`/message/${messageId}/read`);
      
      // Update message with read status
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg._id === messageId 
            ? { ...msg, readBy: response.data.readBy }
            : msg
        );
        storage.setMessages(chatId, updated);
        return updated;
      });

      return response.data;
    } catch (error) {
      console.error("Failed to mark message as read:", error);
    }
  }, [chatId]);

  const addMessage = useCallback(
    (message) => {
      // Prevent duplicate messages
      if (processedMessageIds.current.has(message._id)) {
        return;
      }

      setMessages((prev) => {
        const exists = prev.find((m) => m._id === message._id);
        if (exists) return prev;

        const updated = [...prev, message];
        const deduped = deduplicateMessages(updated);
        storage.setMessages(chatId, deduped);
        
        // Mark as processed
        processedMessageIds.current.add(message._id);
        
        // Auto-scroll to bottom for new incoming message
        setTimeout(() => scrollToBottom(true), 50);
        
        // Show notification for incoming messages
        const currentUser = getCurrentUser();
        if (currentUser && message.sender._id !== currentUser.id) {
          notificationManager.showMessageNotification(message);
        }
        
        return deduped;
      });
    },
    [chatId, scrollToBottom, getCurrentUser, deduplicateMessages]
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
      
      // Remove from processed IDs
      processedMessageIds.current.delete(messageId);
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
    messagesContainerRef,
    scrollToBottom,
  };
};