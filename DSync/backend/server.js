const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const socketIo = require("socket.io");
const http = require("http");
require("dotenv").config();
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const messageRoutes = require("./routes/message");

const app = express();
const server = http.createServer(app);

// Determine allowed origins based on environment
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log("Allowed CORS origins:", allowedOrigins);

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
});

// Trust proxy for secure cookies in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Enhanced CORS middleware
app.use(
  cors({
    origin: (origin, callback) => {
      console.log("CORS check for origin:", origin);

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        console.log("No origin, allowing request");
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        console.log("Origin allowed:", origin);
        return callback(null, true);
      }

      // For development, allow localhost with any port
      if (
        process.env.NODE_ENV !== "production" &&
        origin &&
        origin.includes("localhost")
      ) {
        console.log("Development localhost allowed:", origin);
        return callback(null, true);
      }

      console.log("Origin not allowed:", origin);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
  })
);

// Handle preflight requests
app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    cookies: req.cookies,
    headers: {
      authorization: req.headers.authorization,
      origin: req.headers.origin,
    },
  });
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  console.log("404 - Route not found:", req.originalUrl);
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// MongoDB connection with better error handling
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Socket.io connection with improved error handling
const users = new Map();
const onlineUsers = new Set();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    try {
      if (userId) {
        users.set(userId, socket.id);
        onlineUsers.add(userId);
        socket.join(userId);

        // Broadcast online status
        socket.broadcast.emit("user-online", userId);
        io.emit("online-users", Array.from(onlineUsers));

        console.log(`User ${userId} joined`);
      }
    } catch (error) {
      console.error("Join error:", error);
    }
  });

  socket.on("join-chat", (chatId) => {
    try {
      if (chatId) {
        socket.join(chatId);
        console.log(`Socket ${socket.id} joined chat ${chatId}`);
      }
    } catch (error) {
      console.error("Join chat error:", error);
    }
  });

  socket.on("send-message", (data) => {
    try {
      if (data && data.chatId) {
        // Emit to other users in the chat (not including sender)
        socket.to(data.chatId).emit("receive-message", data);
        
        console.log(`Message sent to chat ${data.chatId} by ${data.sender?.name || 'Unknown'}`);
      }
    } catch (error) {
      console.error("Send message error:", error);
    }
  });

  socket.on("typing", (data) => {
    try {
      if (data && data.chatId) {
        socket.to(data.chatId).emit("user-typing", data);
      }
    } catch (error) {
      console.error("Typing error:", error);
    }
  });

  socket.on("stop-typing", (data) => {
    try {
      if (data && data.chatId) {
        socket.to(data.chatId).emit("user-stop-typing", data);
      }
    } catch (error) {
      console.error("Stop typing error:", error);
    }
  });

  socket.on("message-read", (data) => {
    try {
      if (data && data.chatId) {
        // Broadcast read status to all users in chat
        socket.to(data.chatId).emit("message-read", data);
      }
    } catch (error) {
      console.error("Message read error:", error);
    }
  });

  socket.on("message-delivered", (data) => {
    try {
      if (data && data.chatId) {
        // Broadcast delivery status to sender
        socket.to(data.chatId).emit("message-delivered", data);
      }
    } catch (error) {
      console.error("Message delivered error:", error);
    }
  });

  socket.on("message-liked", (data) => {
    try {
      if (data && data.chatId) {
        // Broadcast to other users in the chat (not sender)
        socket.to(data.chatId).emit("message-liked", data);
      }
    } catch (error) {
      console.error("Message liked error:", error);
    }
  });

  socket.on("message-edited", (data) => {
    try {
      if (data && data.chatId) {
        socket.to(data.chatId).emit("message-edited", data);
      }
    } catch (error) {
      console.error("Message edited error:", error);
    }
  });

  socket.on("message-deleted", (data) => {
    try {
      if (data && data.chatId) {
        socket.to(data.chatId).emit("message-deleted", data);
      }
    } catch (error) {
      console.error("Message deleted error:", error);
    }
  });

  const User = require("./models/User");

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    try {
      for (const [userId, socketId] of users.entries()) {
        if (socketId === socket.id) {
          users.delete(userId);
          onlineUsers.delete(userId);

          const lastSeen = new Date();

          // Update user in DB
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen,
          });

          // Emit updated lastSeen to others
          socket.broadcast.emit("user-offline", {
            userId,
            lastSeen,
          });
          io.emit("online-users", Array.from(onlineUsers));

          console.log(`User ${userId} disconnected at ${lastSeen}`);
          break;
        }
      }
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`JWT Secret configured: ${!!process.env.JWT_SECRET}`);
  console.log(`MongoDB URI configured: ${!!process.env.MONGODB_URI}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});