require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const path = require("path");

const app = express();
const server = http.createServer(app);

// ✅ Use your real domain here
const io = new Server(server, {
  cors: {
    origin: ["https://yourdomain.com", "https://omegleforindia.github.io"],
    methods: ["GET", "POST"],
  },
});

// ✅ Security Middleware
app.use(helmet());
app.use(cors());
app.use(xss());
app.use(mongoSanitize());
app.disable("x-powered-by");

// ✅ Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
});
app.use(limiter);

// ✅ Serve static files (for dashboard)
app.use(express.static(path.join(__dirname)));

// ✅ Basic route
app.get("/", (req, res) => {
  res.send("OCHAT server is running.");
});

// ✅ Admin Dashboard route (protected by ?secret=...)
app.get("/admin-dashboard", (req, res) => {
  const secret = req.query.secret;
  if (secret !== "yourSecret123") {
    return res.status(403).send("Forbidden");
  }
  res.sendFile(path.join(__dirname, "admin.html"));
});

// 🔞 Blocked Words
const badWords = [
  "sex", "porn", "xxx", "nude", "naked", "boobs", "pussy", "dick", "cock",
  "asshole", "slut", "bitch", "fucking", "fuck", "shit", "damn", "bastard",
  "whore", "cunt", "rape", "horny", "suck", "blowjob", "tit", "milf", "anal",
  "gay", "lesbian", "trans", "hentai", "creampie", "orgy", "deepthroat",
  "sexy", "cum", "ejaculate", "masturbate"
];

// 💬 Socket.io logic
let waitingUser = null;
const partners = new Map();
let onlineUsers = 0;

io.on("connection", (socket) => {
  onlineUsers++;

  // Join admin room if admin
  socket.on("join-admin", () => {
    socket.join("admin");
    socket.emit("stats", { onlineUsers });
  });

  // Broadcast new user count to admin dashboard
  io.to("admin").emit("stats", { onlineUsers });

  // Matching logic
  if (waitingUser) {
    partners.set(socket.id, waitingUser);
    partners.set(waitingUser, socket.id);
    socket.emit("matched");
    io.to(waitingUser).emit("matched");
    waitingUser = null;
  } else {
    waitingUser = socket.id;
  }

  socket.on("message", (msg) => {
    const lowerMsg = msg.toLowerCase();
    const hasBadWord = badWords.some(word => lowerMsg.includes(word));
    if (hasBadWord) {
      socket.emit("warning", "⚠️ Inappropriate content is not allowed.");
      return;
    }
    const p = partners.get(socket.id);
    if (p) io.to(p).emit("message", msg);
  });

  socket.on("next", () => {
    const p = partners.get(socket.id);
    if (p) {
      io.to(p).emit("partner-left");
      partners.delete(socket.id);
      partners.delete(p);
    }
    if (waitingUser && waitingUser !== socket.id) {
      partners.set(socket.id, waitingUser);
      partners.set(waitingUser, socket.id);
      socket.emit("matched");
      io.to(waitingUser).emit("matched");
      waitingUser = null;
    } else {
      waitingUser = socket.id;
    }
  });

  socket.on("disconnect", () => {
    onlineUsers--;
    io.to("admin").emit("stats", { onlineUsers });
    const p = partners.get(socket.id);
    if (p) io.to(p).emit("partner-left");
    if (waitingUser === socket.id) waitingUser = null;
    partners.delete(socket.id);
    partners.delete(p);
  });
});

// 🛡️ Start Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
