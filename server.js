const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // or restrict to your frontend URL
    methods: ["GET", "POST"],
  },
});

let waiting = null; // Only one waiting user at a time
const pairs = new Map(); // socket.id => partner socket

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Pair logic
  if (waiting) {
    const partner = waiting;
    pairs.set(socket.id, partner);
    pairs.set(partner.id, socket);

    waiting = null;

    socket.emit("matched");
    partner.emit("matched");
  } else {
    waiting = socket;
  }

  // Forward messages to the partner
  socket.on("message", (msg) => {
    const partner = pairs.get(socket.id);
    if (partner) {
      partner.emit("message", msg);
    }
  });

  // Forward typing event
  socket.on("typing", () => {
    const partner = pairs.get(socket.id);
    if (partner) {
      partner.emit("typing");
    }
  });

  // Forward stop_typing event
  socket.on("stop_typing", () => {
    const partner = pairs.get(socket.id);
    if (partner) {
      partner.emit("stop_typing");
    }
  });

  // Handle next chat or disconnect
  function disconnectPartner() {
    const partner = pairs.get(socket.id);
    if (partner) {
      partner.emit("partner-left");
      pairs.delete(partner.id);
    }
    pairs.delete(socket.id);
  }

  socket.on("next", () => {
    disconnectPartner();
    if (waiting === null) {
      waiting = socket;
    } else {
      const partner = waiting;
      waiting = null;
      pairs.set(socket.id, partner);
      pairs.set(partner.id, socket);
      socket.emit("matched");
      partner.emit("matched");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (waiting === socket) {
      waiting = null;
    }
    disconnectPartner();
  });
});

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
