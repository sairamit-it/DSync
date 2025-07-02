const express = require("express");
const Message = require("../models/Message");
const Chat = require("../models/Chat");
const auth = require("../middleware/auth");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow all file types
    cb(null, true);
  }
});

// Get all messages for a chat with pagination
router.get("/:chatId", auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const chat = await Chat.findOne({
      _id: chatId,
      users: { $elemMatch: { $eq: req.userId } },
    });
    if (!chat) return res.status(403).json({ message: "Access denied" });

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name email avatar")
      .populate("readBy.user", "name")
      .populate("deliveredTo.user", "name")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name"
        }
      })
      .sort({ createdAt: -1 }) // Sort by newest first for pagination
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean for better performance

    // Reverse to get chronological order (oldest first)
    const chronologicalMessages = messages.reverse();

    res.json(chronologicalMessages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Like/Unlike a message
router.put("/:id/like", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const index = message.likes.indexOf(userId);
    if (index === -1) {
      message.likes.push(userId);
    } else {
      message.likes.splice(index, 1);
    }

    await message.save();
    res.json({ success: true, likes: message.likes });
  } catch (error) {
    console.error("Like error:", error);
    res.status(500).json({ message: "Failed to like message" });
  }
});

// Edit message
router.put("/:id/edit", auth, async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    
    if (message.sender.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Not authorized to edit this message" });
    }
    
    if (message.messageType !== "text") {
      return res.status(400).json({ message: "Can only edit text messages" });
    }
    
    message.content = content;
    message.isEdited = true;
    await message.save();
    
    res.json({ success: true, message });
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ message: "Failed to edit message" });
  }
});

// Delete message
router.delete("/:id", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    
    if (message.sender.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this message" });
    }
    
    // Delete file from cloudinary if it exists
    if (message.fileUrl && message.fileUrl.includes("cloudinary")) {
      try {
        const publicId = message.fileUrl.split("/").pop().split(".")[0];
        const folder = message.messageType === "image" ? "chat-app/images" : "chat-app/files";
        await cloudinary.uploader.destroy(`${folder}/${publicId}`);
      } catch (deleteError) {
        console.log("Failed to delete file from cloudinary:", deleteError);
      }
    }
    
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Message deleted" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ message: "Failed to delete message" });
  }
});

// Send text message
router.post("/", auth, async (req, res) => {
  try {
    const { content, chatId, messageType = "text", replyTo } = req.body;
    if (!chatId)
      return res.status(400).json({ message: "Chat ID is required" });
    if (messageType === "text" && (!content || content.trim() === "")) {
      return res.status(400).json({ message: "Message content required" });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      users: { $elemMatch: { $eq: req.userId } },
    });
    if (!chat) return res.status(403).json({ message: "Access denied" });

    const newMessage = {
      sender: req.userId,
      content: content || "",
      chat: chatId,
      messageType,
      replyTo: replyTo || null,
    };

    let message = await Message.create(newMessage);
    message = await Message.findById(message._id)
      .populate("sender", "name avatar")
      .populate("chat")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name"
        }
      });

    const deliveredTo = chat.users
      .filter((uid) => uid.toString() !== req.userId.toString())
      .map((uid) => ({
        user: uid,
        deliveredAt: new Date(),
      }));

    message.deliveredTo = deliveredTo;
    await message.save();

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });
    res.json(message);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// Upload file/image
router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    const { chatId, replyTo } = req.body;
    if (!req.file || !chatId) {
      return res.status(400).json({ message: "File and chatId required" });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      users: { $elemMatch: { $eq: req.userId } },
    });
    if (!chat) return res.status(403).json({ message: "Access denied" });

    const isImage = req.file.mimetype.startsWith("image/");

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: isImage ? "image" : "auto",
            folder: isImage ? "chat-app/images" : "chat-app/files",
            use_filename: true,
            unique_filename: true,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    const messageType = isImage ? "image" : "file";

    const newMessage = {
      sender: req.userId,
      content: req.file.originalname,
      chat: chatId,
      messageType,
      fileUrl: result.secure_url,
      fileName: req.file.originalname,
      replyTo: replyTo || null,
    };

    let message = await Message.create(newMessage);
    message = await Message.findById(message._id)
      .populate("sender", "name avatar")
      .populate("chat")
      .populate({
        path: "replyTo",
        populate: {
          path: "sender",
          select: "name"
        }
      });

    const deliveredTo = chat.users
      .filter((uid) => uid.toString() !== req.userId.toString())
      .map((uid) => ({
        user: uid,
        deliveredAt: new Date(),
      }));

    message.deliveredTo = deliveredTo;
    await message.save();
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    res.json(message);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "File upload failed" });
  }
});

// Mark message as read
router.put("/:messageId/read", auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() === req.userId.toString()) {
      return res.json({ message: "Cannot mark own message as read" });
    }

    const chat = await Chat.findOne({
      _id: message.chat,
      users: { $elemMatch: { $eq: req.userId } },
    });
    if (!chat) return res.status(403).json({ message: "Access denied" });

    const alreadyRead = message.readBy.some(
      (read) => read.user.toString() === req.userId.toString()
    );

    if (!alreadyRead) {
      message.readBy.push({ user: req.userId, readAt: new Date() });
      await message.save();
      await message.populate("readBy.user", "name");
    }

    res.json({ message: "Marked as read", readBy: message.readBy });
  } catch (error) {
    console.error("Read error:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

module.exports = router;