import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { storage } from '../utils/storage';
import toast from 'react-hot-toast';

export const useChat = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load chats from cache first, then fetch from server
  useEffect(() => {
    const cachedChats = storage.getChats();
    if (cachedChats.length > 0) {
      setChats(cachedChats);
      setLoading(false);
    }
    fetchChats();
  }, []);

  const fetchChats = useCallback(async () => {
    try {
      const response = await api.get('/chat');
      setChats(response.data);
      storage.setChats(response.data);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      toast.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, []);

  const createChat = useCallback(async (userId) => {
    try {
      const response = await api.post('/chat', { userId });
      const newChat = response.data;
      
      setChats((prevChats) => {
        const exists = prevChats.find((chat) => chat._id === newChat._id);
        if (exists) return prevChats;
        const updatedChats = [newChat, ...prevChats];
        storage.setChats(updatedChats);
        return updatedChats;
      });
      
      return newChat;
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast.error('Failed to create chat');
      throw error;
    }
  }, []);

  const updateChatLatestMessage = useCallback((chatId, message) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) =>
        chat._id === chatId ? { ...chat, latestMessage: message } : chat
      );
      storage.setChats(updatedChats);
      return updatedChats;
    });
  }, []);

  return {
    chats,
    loading,
    fetchChats,
    createChat,
    updateChatLatestMessage,
  };
};