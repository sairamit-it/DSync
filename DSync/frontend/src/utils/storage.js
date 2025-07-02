// Enhanced local storage utilities with better error handling
export const storage = {
  // User data
  setUser: (user) => {
    try {
      localStorage.setItem("user", JSON.stringify(user));
    } catch (error) {
      console.error("Failed to save user to localStorage:", error);
    }
  },

  getUser: () => {
    try {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error("Failed to get user from localStorage:", error);
      return null;
    }
  },

  removeUser: () => {
    try {
      localStorage.removeItem("user");
    } catch (error) {
      console.error("Failed to remove user from localStorage:", error);
    }
  },

  // Token
  setToken: (token) => {
    try {
      localStorage.setItem("token", token);
    } catch (error) {
      console.error("Failed to save token to localStorage:", error);
    }
  },

  getToken: () => {
    try {
      return localStorage.getItem("token");
    } catch (error) {
      console.error("Failed to get token from localStorage:", error);
      return null;
    }
  },

  removeToken: () => {
    try {
      localStorage.removeItem("token");
    } catch (error) {
      console.error("Failed to remove token from localStorage:", error);
    }
  },

  // Chats cache with size limit
  setChats: (chats) => {
    try {
      // Limit to last 50 chats to prevent storage overflow
      const limitedChats = chats.slice(0, 50);
      localStorage.setItem("chats", JSON.stringify(limitedChats));
    } catch (error) {
      console.error("Failed to save chats to localStorage:", error);
      // If storage is full, try to clear old data
      try {
        localStorage.removeItem("chats");
        localStorage.setItem("chats", JSON.stringify(chats.slice(0, 20)));
      } catch (retryError) {
        console.error("Failed to save chats after cleanup:", retryError);
      }
    }
  },

  getChats: () => {
    try {
      const chats = localStorage.getItem("chats");
      return chats ? JSON.parse(chats) : [];
    } catch (error) {
      console.error("Failed to get chats from localStorage:", error);
      return [];
    }
  },

  // Messages cache with size limit per chat
  setMessages: (chatId, messages) => {
    try {
      // Limit to last 100 messages per chat to prevent storage overflow
      const limitedMessages = messages.slice(-100);
      localStorage.setItem(
        `messages_${chatId}`,
        JSON.stringify(limitedMessages)
      );
    } catch (error) {
      console.error(`Failed to save messages for chat ${chatId}:`, error);
      // If storage is full, try with fewer messages
      try {
        const evenMoreLimited = messages.slice(-50);
        localStorage.setItem(
          `messages_${chatId}`,
          JSON.stringify(evenMoreLimited)
        );
      } catch (retryError) {
        console.error(
          `Failed to save messages after cleanup for chat ${chatId}:`,
          retryError
        );
      }
    }
  },

  getMessages: (chatId) => {
    try {
      const messages = localStorage.getItem(`messages_${chatId}`);
      return messages ? JSON.parse(messages) : [];
    } catch (error) {
      console.error(`Failed to get messages for chat ${chatId}:`, error);
      return [];
    }
  },

  // Remove messages for a specific chat
  removeMessages: (chatId) => {
    try {
      localStorage.removeItem(`messages_${chatId}`);
    } catch (error) {
      console.error(`Failed to remove messages for chat ${chatId}:`, error);
    }
  },

  // Get storage usage info
  getStorageInfo: () => {
    try {
      let totalSize = 0;
      let itemCount = 0;

      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length;
          itemCount++;
        }
      }

      return {
        totalSize: totalSize,
        itemCount: itemCount,
        sizeInMB: (totalSize / (1024 * 1024)).toFixed(2),
      };
    } catch (error) {
      console.error("Failed to get storage info:", error);
      return { totalSize: 0, itemCount: 0, sizeInMB: "0.00" };
    }
  },

  // Clean up old message caches
  cleanupOldMessages: () => {
    try {
      const keys = Object.keys(localStorage);
      const messageKeys = keys.filter((key) => key.startsWith("messages_"));

      // Keep only the 10 most recent message caches
      if (messageKeys.length > 10) {
        const keysToRemove = messageKeys.slice(10);
        keysToRemove.forEach((key) => {
          localStorage.removeItem(key);
        });
      }
    } catch (error) {
      console.error("Failed to cleanup old messages:", error);
    }
  },

  // Clear all data
  clear: () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error("Failed to clear localStorage:", error);
    }
  },
};

// Auto-cleanup on page load
if (typeof window !== "undefined") {
  // Clean up old messages periodically
  storage.cleanupOldMessages();
}
