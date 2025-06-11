const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUser = null;
const partners = new Map();

io.on("connection", (socket) => {
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
    const p = partners.get(socket.id);
    if (p) io.to(p).emit("partner-left");
    if (waitingUser === socket.id) waitingUser = null;
    partners.delete(socket.id);
    partners.delete(p);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Server running on port", PORT));
