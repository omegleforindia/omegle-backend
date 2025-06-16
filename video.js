const { Server } = require("socket.io");

let waitingUser = null;

function setupVideoServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // You can restrict this to your domain for security
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-video", () => {
      if (waitingUser && waitingUser.id !== socket.id) {
        const peerId = waitingUser.id;
        io.to(socket.id).emit("match-found", { peerId, initiator: true });
        io.to(peerId).emit("match-found", { peerId: socket.id, initiator: false });
        waitingUser = null;
      } else {
        waitingUser = socket;
      }
    });

    socket.on("offer", ({ to, offer }) => {
      io.to(to).emit("offer", { from: socket.id, offer });
    });

    socket.on("answer", ({ to, answer }) => {
      io.to(to).emit("answer", { from: socket.id, answer });
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", { candidate });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      if (waitingUser && waitingUser.id === socket.id) {
        waitingUser = null;
      }
    });
  });
}

module.exports = { setupVideoServer };
