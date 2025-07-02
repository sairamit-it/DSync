"use client";

import { useState, memo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCheck,
  Download,
  Edit3,
  Trash2,
  Reply,
  Heart,
  Clock,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  X,
} from "lucide-react";

const MessageItem = memo(
  ({
    message,
    currentUser,
    showAvatar,
    showSenderName,
    onLike,
    onReply,
    onEdit,
    onDelete,
  }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const menuRef = useRef(null);
    const tapTimeoutRef = useRef(null);
    const tapCountRef = useRef(0);

    const isOwn = message.sender._id === currentUser.id;
    const isLiked = message.likes?.includes(currentUser.id);
    const hasLikes = message.likes?.length > 0;
    const isOptimistic = message.isOptimistic;
    const status = message.status;

    // Close menu when clicking outside
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setShowMenu(false);
        }
      };

      if (showMenu) {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }, [showMenu]);

    const formatTime = (date) => {
      return new Date(date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };

    const getMessageStatus = () => {
      if (!isOwn) return null;

      if (isOptimistic) {
        if (status === "sending") {
          return <Clock size={12} className="text-gray-400" />;
        } else if (status === "failed") {
          return <AlertCircle size={12} className="text-red-500" />;
        }
      }

      const isRead = message.readBy && message.readBy.length > 1;
      const isDelivered = message.deliveredTo && message.deliveredTo.length > 0;

      if (isRead) {
        return <CheckCheck size={12} className="text-blue-500" />;
      } else if (isDelivered) {
        return <CheckCheck size={12} className="text-gray-400" />;
      } else {
        return <Check size={12} className="text-gray-400" />;
      }
    };

    const handleDownload = (fileUrl, fileName) => {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handleEdit = () => {
      if (editContent.trim() && editContent !== message.content) {
        onEdit(message._id, editContent.trim());
      }
      setIsEditing(false);
      setShowMenu(false);
    };

    const handleKeyPress = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleEdit();
      } else if (e.key === "Escape") {
        setIsEditing(false);
        setEditContent(message.content);
      }
    };

    const handleRetry = () => {
      console.log("Retrying message:", message._id);
    };

    // Handle double-tap/click for like
    const handleTap = (e) => {
      e.preventDefault();
      tapCountRef.current += 1;

      if (tapCountRef.current === 1) {
        tapTimeoutRef.current = setTimeout(() => {
          tapCountRef.current = 0;
        }, 300);
      } else if (tapCountRef.current === 2) {
        clearTimeout(tapTimeoutRef.current);
        tapCountRef.current = 0;
        if (!isOptimistic) {
          onLike(message._id);
        }
      }
    };

    const handleMenuAction = (action) => {
      setShowMenu(false);

      switch (action) {
        case "like":
          onLike(message._id);
          break;
        case "reply":
          onReply(message);
          break;
        case "edit":
          setIsEditing(true);
          break;
        case "delete":
          onDelete(message._id);
          break;
      }
    };

    // Handle menu button click with proper event handling
    const handleMenuClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setShowMenu(!showMenu);
    };

    return (
      <motion.div
        className={`message ${isOwn ? "sent" : "received"} ${
          isOptimistic ? "optimistic" : ""
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onTouchEnd={handleTap}
        onDoubleClick={handleTap}
      >
        {!isOwn && showAvatar && (
          <img
            src={
              message.sender.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                message.sender.name || "User"
              )}&background=8b5cf6&color=fff&size=56`
            }
            alt={message.sender.name}
            className="message-avatar"
          />
        )}

        <div className="message-content">
          {!isOwn && showSenderName && (
            <div className="sender-name">{message.sender.name}</div>
          )}

          {message.replyTo && (
            <div className="reply-preview">
              <div className="reply-line"></div>
              <div className="reply-content">
                <span className="reply-sender">
                  {message.replyTo.sender?.name}
                </span>
                <p className="reply-text">{message.replyTo.content}</p>
              </div>
            </div>
          )}

          <div className="message-bubble-container">
            <div
              className={`message-bubble ${
                status === "failed" ? "failed" : ""
              }`}
            >
              {message.messageType === "image" ? (
                <div className="message-image-container">
                  {isOptimistic && status === "sending" ? (
                    <div className="image-placeholder">
                      <div className="loading-spinner">
                        <RefreshCw size={20} className="animate-spin" />
                      </div>
                      <span>Uploading image...</span>
                    </div>
                  ) : (
                    <>
                      <a
                        href={message.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={message.fileUrl || "/placeholder.svg"}
                          alt={message.fileName || "Shared image"}
                          className="message-image"
                          loading="lazy"
                        />
                      </a>
                      {message.fileName && (
                        <div className="image-caption">{message.fileName}</div>
                      )}
                    </>
                  )}
                </div>
              ) : message.messageType === "file" ? (
                <div className="message-file">
                  <div className="file-info">
                    <div className="file-icon">📄</div>
                    <div className="file-details">
                      <span className="file-name">
                        {message.fileName || message.content}
                      </span>
                      <span className="file-size">
                        {isOptimistic && status === "sending"
                          ? "Uploading..."
                          : "Click to download"}
                      </span>
                    </div>
                  </div>
                  {!isOptimistic && (
                    <button
                      className="download-btn"
                      onClick={() =>
                        handleDownload(message.fileUrl, message.fileName)
                      }
                      aria-label="Download file"
                    >
                      <Download size={14} />
                    </button>
                  )}
                </div>
              ) : isEditing ? (
                <div className="edit-input-container">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={handleKeyPress}
                    onBlur={handleEdit}
                    className="edit-input"
                    autoFocus
                    rows={1}
                  />
                </div>
              ) : (
                <p className="message-text">{message.content}</p>
              )}

              {/* Like indicator - visible to all users */}
              {hasLikes && (
                <motion.div
                  className="message-likes"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <Heart size={12} className="like-icon" />
                 
                </motion.div>
              )}

              <div className="message-meta">
                <span className="message-time">
                  {formatTime(message.createdAt)}
                </span>
                {message.isEdited && (
                  <span className="edited-indicator">Edited</span>
                )}
                {status === "failed" && (
                  <button
                    className="retry-btn"
                    onClick={handleRetry}
                    title="Retry sending"
                  >
                    <RefreshCw size={10} />
                  </button>
                )}
                {getMessageStatus()}
              </div>
            </div>

            {/* 3-dot menu button - always visible with improved touch handling */}
            {!isOptimistic && (
              <div className="message-menu-container" ref={menuRef}>
                <button
                  className="message-menu-btn"
                  onClick={handleMenuClick}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMenuClick(e);
                  }}
                  aria-label="Message options"
                  type="button"
                >
                  <MoreVertical size={16} />
                </button>

                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      className={`message-menu ${isOwn ? "own" : "other"}`}
                      initial={{ opacity: 0, scale: 0.8, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      <button
                        className="menu-item"
                        onClick={() => handleMenuAction("like")}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleMenuAction("like");
                        }}
                      >
                        <Heart size={16} className={isLiked ? "liked" : ""} />
                        <span>{isLiked ? "Unlike" : "Like"}</span>
                      </button>

                      <button
                        className="menu-item"
                        onClick={() => handleMenuAction("reply")}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleMenuAction("reply");
                        }}
                      >
                        <Reply size={16} />
                        <span>Reply</span>
                      </button>

                      {isOwn && message.messageType === "text" && (
                        <button
                          className="menu-item"
                          onClick={() => handleMenuAction("edit")}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            handleMenuAction("edit");
                          }}
                        >
                          <Edit3 size={16} />
                          <span>Edit</span>
                        </button>
                      )}

                      {isOwn && (
                        <button
                          className="menu-item delete"
                          onClick={() => handleMenuAction("delete")}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            handleMenuAction("delete");
                          }}
                        >
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

MessageItem.displayName = "MessageItem";

export default MessageItem;
