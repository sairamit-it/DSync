"use client"

import { useState, useRef } from "react"
import { motion } from "framer-motion"
import { X, Camera, Edit3, Save, User, Mail } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import toast from "react-hot-toast"

const ProfileModal = ({ onClose }) => {
  const { user, updateProfile, uploadAvatar } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  })
  const fileInputRef = useRef(null)

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }

    setLoading(true)
    try {
      await updateProfile(formData)
      setIsEditing(false)
      toast.success("Profile updated successfully")
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB")
      return
    }

    setAvatarLoading(true)
    try {
      await uploadAvatar(file)
      toast.success("Avatar updated successfully")
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload avatar")
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: user?.name || "",
      email: user?.email || "",
    })
    setIsEditing(false)
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="profile-modal"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Profile Settings</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {/* Avatar Section */}
          <div className="avatar-section">
            <div className="avatar-container">
              <img
                src={
                  user?.avatar || `https://ui-avatars.com/api/?name=${user?.name}&background=8b5cf6&color=fff&size=200`
                }
                alt={user?.name}
                className="profile-avatar"
              />
              <button
                className="avatar-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
              >
                {avatarLoading ? (
                  <div className="loading-spinner-small">
                    <div className="spinner-small"></div>
                  </div>
                ) : (
                  <Camera size={18} />
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: "none" }}
            />
          </div>

          {/* Profile Form */}
          <div className="profile-form">
            <div className="form-group">
              <label htmlFor="name">
                <User size={16} />
                Name
              </label>
              <div className="input-container">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`form-input ${!isEditing ? "disabled" : ""}`}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">
                <Mail size={16} />
                Email
              </label>
              <div className="input-container">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`form-input ${!isEditing ? "disabled" : ""}`}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
            {!isEditing ? (
              <motion.button
                className="edit-btn"
                onClick={() => setIsEditing(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Edit3 size={16} />
                Edit Profile
              </motion.button>
            ) : (
              <div className="edit-actions">
                <motion.button
                  className="cancel-btn"
                  onClick={handleCancel}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="save-btn"
                  onClick={handleSaveProfile}
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <div className="loading-spinner-small">
                      <div className="spinner-small"></div>
                    </div>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ProfileModal
