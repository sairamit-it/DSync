"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, User, Loader } from "lucide-react";
import api from "../../utils/api";

const UserSearch = ({ onClose, onUserSelect, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm.trim()) {
        searchUsers();
      } else {
        setUsers([]);
        setError(null);
      }
    }, 300); // Debounce search

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const searchUsers = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Fixed API endpoint - should be /api/auth/users, not /auth/users
      const response = await api.get(
        `/auth/users?search=${encodeURIComponent(searchTerm.trim())}`
      );

      if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        console.error("Invalid response format:", response.data);
        setUsers([]);
        setError("Invalid response from server");
      }
    } catch (error) {
      console.error("Search failed:", error);
      setUsers([]);

      if (error.response?.status === 401) {
        setError("Please log in again to search for users");
      } else if (error.response?.status === 403) {
        setError("You don't have permission to search users");
      } else if (error.response?.status >= 500) {
        setError("Server error. Please try again later.");
      } else {
        setError("Failed to search users. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId) => {
    try {
      onUserSelect(userId);
    } catch (error) {
      console.error("Error selecting user:", error);
      setError("Failed to start chat. Please try again.");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="user-search-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="user-search-modal"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>Start New Chat</h3>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="search-input-container">
            <div className="search-input">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {loading && <Loader size={20} className="loading-icon" />}
            </div>
            {error && (
              <div
                className="error-message"
                style={{
                  color: "#ef4444",
                  fontSize: "14px",
                  marginTop: "8px",
                  padding: "8px",
                  background: "rgba(239, 68, 68, 0.1)",
                  borderRadius: "8px",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div className="users-list">
            {loading ? (
              <div className="loading-users">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="user-skeleton">
                    <div className="skeleton-avatar"></div>
                    <div className="skeleton-content">
                      <div className="skeleton-line"></div>
                      <div className="skeleton-line short"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="no-users">
                <AlertCircle
                  size={48}
                  className="empty-icon"
                  style={{ color: "#ef4444" }}
                />
                <h4>Search Error</h4>
                <p>{error}</p>
              </div>
            ) : users.length > 0 ? (
              users.map((user, index) => (
                <motion.div
                  key={user._id}
                  className="user-item"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleUserSelect(user._id)}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="user-avatar">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="avatar-placeholder"
                      style={{ display: user.avatar ? "none" : "flex" }}
                    >
                      <User size={24} />
                    </div>
                  </div>
                  <div className="user-info">
                    <h4>{user.name}</h4>
                    <p>{user.email}</p>
                  </div>
                  <div className="user-action">
                    <span>Chat</span>
                  </div>
                </motion.div>
              ))
            ) : searchTerm && !loading ? (
              <div className="no-users">
                <User size={48} className="empty-icon" />
                <h4>No users found</h4>
                <p>Try searching with a different name or email</p>
              </div>
            ) : (
              <div className="search-prompt">
                <Search size={48} className="empty-icon" />
                <h4>Find people to chat with</h4>
                <p>Search for users by their name or email address</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UserSearch;
