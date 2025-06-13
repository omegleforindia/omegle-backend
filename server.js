require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://ochat.in", "https://omegleforindia.github.io"],
    methods: ["GET", "POST"],
  },
});

// Security middlewares
app.use(helmet());
app.use(cors());
app.use(xss());
app.use(mongoSanitize());
app.disable("x-powered-by");

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
});
app.use(limiter);

app.get("/", (req, res) => {
  res.send("OCHAT server is running.");
});

// Bad word list (you can edit this if needed)
const badWords = [
  "sex", "porn", "xxx", "nude", "naked", "boobs", "pussy", "dick", "cock",
  "asshole", "slut", "bitch", "fucking", "fuck", "shit", "damn", "bastard",
  "whore", "cunt", "rape", "horny", "suck", "blowjob", "tit", "milf", "anal",
  "gay", "lesbian", "trans", "hentai", "creampie", "orgy", "deepthroat",
  "sexy", "cum", "ejaculate", "masturbate"
];

// Simple filter function
function containsBadWords(message) {
  const lower = message.toLowerCase();
  return badWords.some(word => lower.includes(word));
}

let waitingUser = null;
const partners = new Map();

io.on("connection", (socket) => {
  // Match with waiting user or wait
  if (waitingUser) {
    partners.set(socket.id, waitingUser);
    partners.set(waitingUser, socket.id);
    socket.emit("matched");
    io.to(waitingUser).emit("matched");
    waitingUser = null;
  } else {
    waitingUser = socket.id;
  }

  // Message handler
  socket.on("message", (msg) => {
    if (containsBadWords(msg)) {
      socket.emit("warning", "⚠️ Inappropriate content is not allowed.");
      return;
    }

    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("message", msg);
    }
  });

  // Typing indicator only (no filtering here)
  socket.on("typing", () => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("typing");
    }
  });

  socket.on("stop_typing", () => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("stop_typing");
    }
  });

  // Next chat logic
  socket.on("next", () => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("partner-left");
      partners.delete(socket.id);
      partners.delete(partnerId);
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

  // Disconnect handler
  socket.on("disconnect", () => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("partner-left");
    }

    if (waitingUser === socket.id) {
      waitingUser = null;
    }

    partners.delete(socket.id);
    partners.delete(partnerId);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
