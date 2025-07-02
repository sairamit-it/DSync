"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, ImageIcon, Smile, Paperclip, X } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

const ChatInput = ({ onSendMessage, onTyping, replyTo, setReplyTo }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() && !imageFile && !replyTo) return;

    // Send image if selected
    if (imageFile) {
      onSendMessage("", "image", imageFile, replyTo);
      setImageFile(null);
      setImagePreview(null);
    } else {
      onSendMessage(message, "text", null, replyTo);
    }

    setMessage("");
    setShowEmojiPicker(false);
    setReplyTo(null);
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    onTyping();
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
    inputRef.current?.focus();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) onSendMessage("", "file", file);
    e.target.value = "";
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const cancelImagePreview = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="message-input-container">
      {replyTo && (
        <div className="reply-banner">
          <span>
            Replying to <strong>{replyTo.sender.name}</strong>:{" "}
            {replyTo.content}
          </span>
          <button className="close-btn" onClick={() => setReplyTo(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="image-preview-banner">
          <img src={imagePreview} alt="Preview" className="image-preview" />
          <button className="close-btn" onClick={cancelImagePreview}>
            <X size={16} />
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div className="emoji">
          
        </div>
      )}

      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-actions-left">
          <motion.button
            type="button"
            className="input-action-btn"
            onClick={() => fileInputRef.current?.click()}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Attach file"
          >
            <Paperclip size={18} />
          </motion.button>

          <motion.button
            type="button"
            className="input-action-btn"
            onClick={() => imageInputRef.current?.click()}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Send image"
          >
            <ImageIcon size={18} />
          </motion.button>
        </div>

        <div className="message-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInputChange}
            placeholder="Message..."
            className="message-input"
          />

          <motion.button
            type="button"
            className="input-action-btn emoji-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Add emoji"
          >
            <Smile size={18} />
          </motion.button>
        </div>

        <div className="input-actions-right">
          
            <motion.button
              type="submit"
              className="send-btn"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Send message"
            >
              <Send size={18} />
            </motion.button>
         
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.zip,.rar"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />
      </form>
    </div>
  );
};

export default ChatInput;
