import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Settings, LogOut, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ChatList from './ChatList';
import UserSearch from './UserSearch';
import ProfileModal from './ProfileModal';
import toast from 'react-hot-toast';

const Sidebar = memo(({ 
  chats, 
  loading, 
  selectedChat, 
  setSelectedChat, 
  socket, 
  onlineUsers, 
  onCreateChat 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const { user, logout } = useAuth();

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    if (socket) {
      socket.emit('join-chat', chat._id);
    }
  };

  const handleNewChat = async (userId) => {
    try {
      const newChat = await onCreateChat(userId);
      setSelectedChat(newChat);
      setShowUserSearch(false);
      toast.success('Chat created successfully');
    } catch (error) {
      toast.error('Failed to create chat');
    }
  };

  const filteredChats = chats.filter((chat) =>
    chat.isGroupChat
      ? chat.chatName.toLowerCase().includes(searchTerm.toLowerCase())
      : chat.users
          .find((u) => u._id !== user.id)
          ?.name.toLowerCase()
          .includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="user-section">
            <div className="user-profile-container">
              <div
                className="user-avatar-wrapper"
                onClick={() => setShowProfileModal(true)}
              >
                <img
                  src={
                    user?.avatar ||
                    `https://ui-avatars.com/api/?name=${user?.name}&background=8b5cf6&color=fff&size=128`
                  }
                  alt={user?.name}
                  className="user-avatar"
                />
                <div className="avatar-overlay">
                  <Camera size={16} />
                </div>
                <div className="online-status"></div>
              </div>
              <div className="user-details">
                <h2 className="user-name">{user?.name}</h2>
                <span className="user-status">Active now</span>
              </div>
            </div>

            <div className="header-actions">
              <motion.button
                className="action-btn"
                onClick={() => setShowUserSearch(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="New chat"
              >
                <Plus size={20} />
              </motion.button>

              <motion.button
                className="action-btn"
                onClick={() => setShowProfileModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Settings"
              >
                <Settings size={20} />
              </motion.button>

              <motion.button
                className="action-btn logout-btn"
                onClick={logout}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Logout"
              >
                <LogOut size={20} />
              </motion.button>
            </div>
          </div>

          {/* Search */}
          <div className="search-container">
            <div className="search-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <div className="title">DSync</div>
            </div>
          </div>
        </div>

        {/* Chat List */}
        <div className="chat-list-container">
          <ChatList
            chats={filteredChats}
            loading={loading}
            selectedChat={selectedChat}
            onChatSelect={handleChatSelect}
            currentUser={user}
            onlineUsers={onlineUsers}
          />
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showUserSearch && (
          <UserSearch
            onClose={() => setShowUserSearch(false)}
            onUserSelect={handleNewChat}
            currentUser={user}
          />
        )}
        {showProfileModal && (
          <ProfileModal onClose={() => setShowProfileModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;