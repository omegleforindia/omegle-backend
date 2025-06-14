const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const Filter = require("bad-words");

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let waitingUser = null;
const userToPartner = new Map();

function pairUsers(user1, user2) {
  userToPartner.set(user1, user2);
  userToPartner.set(user2, user1);
  user1.emit("matched");
  user2.emit("matched");
}

function removeUser(socket) {
  const partner = userToPartner.get(socket);
  if (partner) {
    partner.emit("partner-left");
    userToPartner.delete(partner);
  }
  userToPartner.delete(socket);
  if (waitingUser === socket) {
    waitingUser = null;
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  if (waitingUser) {
    pairUsers(socket, waitingUser);
    waitingUser = null;
  } else {
    waitingUser = socket;
  }

  socket.on("message", (msg) => {
    const filter = new Filter();

    if (filter.isProfane(msg)) {
      socket.emit("blocked", "⚠️ Your message was blocked due to inappropriate content.");
      return;
    }

    const partner = userToPartner.get(socket);
    if (partner) {
      partner.emit("message", msg); // send to stranger
      socket.emit("echo", msg);     // send back to sender
    }
  });

  socket.on("typing", () => {
    const partner = userToPartner.get(socket);
    if (partner) {
      partner.emit("typing");
    }
  });

  socket.on("stop_typing", () => {
    const partner = userToPartner.get(socket);
    if (partner) {
      partner.emit("stop_typing");
    }
  });

  socket.on("next", () => {
    const partner = userToPartner.get(socket);
    if (partner) {
      partner.emit("partner-left");
      userToPartner.delete(partner);
      userToPartner.delete(socket);
      pairUsers(socket, partner); // try rematching instantly
    } else {
      waitingUser = socket;
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    removeUser(socket);
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
