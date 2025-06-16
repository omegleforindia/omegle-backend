const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../frontend"))); // serve frontend

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("join-video", () => {
    if (waitingUser) {
      const partner = waitingUser;
      waitingUser = null;

      partner.emit("ready");
      socket.emit("ready");

      partner.partnerId = socket.id;
      socket.partnerId = partner.id;
    } else {
      waitingUser = socket;
    }
  });

  socket.on("offer", (data) => {
    const partnerId = socket.partnerId;
    if (partnerId) io.to(partnerId).emit("offer", data);
  });

  socket.on("answer", (data) => {
    const partnerId = socket.partnerId;
    if (partnerId) io.to(partnerId).emit("answer", data);
  });

  socket.on("candidate", (data) => {
    const partnerId = socket.partnerId;
    if (partnerId) io.to(partnerId).emit("candidate", data);
  });

  socket.on("disconnect", () => {
    if (waitingUser === socket) {
      waitingUser = null;
    }
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("partner-disconnected");
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log("🚀 Video Server running on port", PORT);
});
