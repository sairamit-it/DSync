import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useChat } from '../../hooks/useChat';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import './Chat.css';

const Chat = React.memo(() => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);

  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket(user);
  const { chats, loading, createChat, updateChatLatestMessage } = useChat();

  const handleResize = useCallback(() => {
    setIsMobile(window.innerWidth <= 768);
    if (window.innerWidth <= 768) {
      setSidebarWidth(380);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const handleMouseDown = useCallback((e) => {
    if (isMobile) return;
    setIsResizing(true);
    e.preventDefault();
  }, [isMobile]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || isMobile) return;
      const newWidth = e.clientX;
      if (newWidth >= 320 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isMobile]);

  const showSidebar = !isMobile || !selectedChat;
  const showChatWindow = !isMobile || selectedChat;

  return (
    <div className="chat-container">
      <motion.div
        className="chat-layout"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {showSidebar && (
          <motion.div
            className={`sidebar-section ${isMobile ? 'mobile' : ''}`}
            style={{ width: isMobile ? '100%' : `${sidebarWidth}px` }}
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Sidebar
              chats={chats}
              loading={loading}
              selectedChat={selectedChat}
              setSelectedChat={setSelectedChat}
              socket={socket}
              onlineUsers={onlineUsers}
              onCreateChat={createChat}
            />
            {!isMobile && (
              <div className="resize-handle" onMouseDown={handleMouseDown}>
                <div className="resize-line"></div>
              </div>
            )}
          </motion.div>
        )}

        {showChatWindow && (
          <motion.div
            className={`chat-section ${isMobile ? 'mobile' : ''}`}
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChatWindow
              selectedChat={selectedChat}
              setSelectedChat={setSelectedChat}
              socket={socket}
              isMobile={isMobile}
              onlineUsers={onlineUsers}
              onUpdateChatLatestMessage={updateChatLatestMessage}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
});

Chat.displayName = 'Chat';

export default Chat;