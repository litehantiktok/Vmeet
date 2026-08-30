const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  // =========================
  // VÀO PHÒNG
  // =========================

  socket.on("join-room", ({ room, name, create }) => {

    if (!room) {
      socket.emit("room-error", {
        message: "Không có mã phòng."
      });
      return;
    }

    let currentRoom = rooms.get(room);

    // Tạo phòng mới
    if (!currentRoom) {

      if (!create) {
        socket.emit("room-error", {
          message: "Phòng không tồn tại."
        });
        return;
      }

      currentRoom = {
        host: socket.id,
        users: new Map(),
        locked: false
      };

      rooms.set(room, currentRoom);

    }

    // Kiểm tra phòng bị khóa
    if (
      currentRoom.locked &&
      currentRoom.host !== socket.id
    ) {

      socket.emit("room-locked", {
        message: "Phòng hiện đang bị khóa."
      });

      return;
    }

    const user = {
      id: socket.id,
      name: name || "Khách",
      isHost:
        currentRoom.host === socket.id,
      micEnabled: true,
      cameraEnabled: true,
      micLocked: false,
      cameraLocked: false
    };

    currentRoom.users.set(
      socket.id,
      user
    );

    socket.data.room = room;
    socket.data.name = user.name;

    socket.join(room);

    // Gửi thông tin phòng cho người vừa vào
    socket.emit("room-joined", {
      room,
      isHost: user.isHost
    });

    // Gửi danh sách người hiện tại
    socket.emit(
      "participants",
      [...currentRoom.users.values()]
    );

    // Thông báo cho những người khác
    socket.to(room).emit(
      "user-joined",
      user
    );

    // Cập nhật danh sách
    io.to(room).emit(
      "participants",
      [...currentRoom.users.values()]
    );

  });


  // =========================
  // WEBRTC SIGNAL
  // =========================

  socket.on(
    "signal",
    ({ to, data }) => {

      const room =
        rooms.get(socket.data.room);

      if (!room) return;

      const target =
        room.users.get(to);

      if (!target) return;

      io.to(to).emit(
        "signal",
        {
          from: socket.id,
          data
        }
      );

    }
  );


  // =========================
  // HOST KIỂM TRA QUYỀN
  // =========================

  function isHost() {

    const room =
      rooms.get(socket.data.room);

    return (
      room &&
      room.host === socket.id
    );

  }


  // =========================
  // TẮT MIC MỘT NGƯỜI
  // =========================

  socket.on(
    "host-mute-user",
    ({ userId }) => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      const user =
        room.users.get(userId);

      if (!user) return;

      user.micEnabled = false;
      user.micLocked = true;

      io.to(userId).emit(
        "force-mute",
        {
          locked: true
        }
      );

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // BẬT LẠI MIC CHO NGƯỜI
  // =========================

  socket.on(
    "host-unlock-mic",
    ({ userId }) => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      const user =
        room.users.get(userId);

      if (!user) return;

      user.micLocked = false;

      io.to(userId).emit(
        "unlock-mic"
      );

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // TẮT CAMERA MỘT NGƯỜI
  // =========================

  socket.on(
    "host-camera-off",
    ({ userId }) => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      const user =
        room.users.get(userId);

      if (!user) return;

      user.cameraEnabled = false;
      user.cameraLocked = true;

      io.to(userId).emit(
        "force-camera-off",
        {
          locked: true
        }
      );

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // MỞ KHÓA CAMERA
  // =========================

  socket.on(
    "host-unlock-camera",
    ({ userId }) => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      const user =
        room.users.get(userId);

      if (!user) return;

      user.cameraLocked = false;

      io.to(userId).emit(
        "unlock-camera"
      );

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // TẮT MIC TẤT CẢ
  // =========================

  socket.on(
    "host-mute-all",
    () => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      for (
        const user of room.users.values()
      ) {

        if (user.id === socket.id) {
          continue;
        }

        user.micEnabled = false;
        user.micLocked = true;

        io.to(user.id).emit(
          "force-mute",
          {
            locked: true
          }
        );

      }

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // TẮT CAMERA TẤT CẢ
  // =========================

  socket.on(
    "host-camera-off-all",
    () => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      for (
        const user of room.users.values()
      ) {

        if (user.id === socket.id) {
          continue;
        }

        user.cameraEnabled = false;
        user.cameraLocked = true;

        io.to(user.id).emit(
          "force-camera-off",
          {
            locked: true
          }
        );

      }

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // MỞ KHÓA MIC
  // =========================

  socket.on(
    "host-unlock-all-mic",
    () => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      for (
        const user of room.users.values()
      ) {

        user.micLocked = false;

        io.to(user.id).emit(
          "unlock-mic"
        );

      }

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // MỞ KHÓA CAMERA
  // =========================

  socket.on(
    "host-unlock-all-camera",
    () => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      for (
        const user of room.users.values()
      ) {

        user.cameraLocked = false;

        io.to(user.id).emit(
          "unlock-camera"
        );

      }

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // ĐUỔI NGƯỜI
  // =========================

  socket.on(
    "host-remove-user",
    ({ userId }) => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      if (!room) return;

      if (userId === socket.id) {
        return;
      }

      const user =
        room.users.get(userId);

      if (!user) return;

      room.users.delete(userId);

      const target =
        io.sockets.sockets.get(userId);

      if (target) {

        target.leave(
          socket.data.room
        );

        target.emit(
          "removed-from-room"
        );

        target.data.room = null;

      }

      io.to(socket.data.room).emit(
        "user-left",
        {
          id: userId
        }
      );

      io.to(socket.data.room).emit(
        "participants",
        [...room.users.values()]
      );

    }
  );


  // =========================
  // KHÓA / MỞ PHÒNG
  // =========================

  socket.on(
    "host-toggle-lock",
    () => {

      if (!isHost()) return;

      const room =
        rooms.get(socket.data.room);

      room.locked =
        !room.locked;

      io.to(socket.data.room).emit(
        "room-lock-changed",
        {
          locked: room.locked
        }
      );

    }
  );


  // =========================
  // CHAT
  // =========================

  socket.on(
    "chat",
    ({ text }) => {

      if (
        !text ||
        !text.trim()
      ) {
        return;
      }

      const room =
        rooms.get(socket.data.room);

      if (!room) return;

      const user =
        room.users.get(socket.id);

      if (!user) return;

      io.to(socket.data.room).emit(
        "chat",
        {
          name: user.name,
          text: text.trim()
        }
      );

    }
  );


  // =========================
  // RỜI PHÒNG
  // =========================

  socket.on(
    "leave-room",
    () => {

      removeUser(socket);

    }
  );


  // =========================
  // DISCONNECT
  // =========================

  socket.on(
    "disconnect",
    () => {

      removeUser(socket);

    }
  );

});


// =================================
// XÓA NGƯỜI KHỎI PHÒNG
// =================================

function removeUser(socket) {

  const roomId =
    socket.data.room;

  if (!roomId) return;

  const room =
    rooms.get(roomId);

  if (!room) return;

  const wasHost =
    room.host === socket.id;

  room.users.delete(
    socket.id
  );


  // Chủ phòng rời
  if (wasHost) {

    io.to(roomId).emit(
      "room-closed"
    );

    rooms.delete(roomId);

    return;
  }


  socket.to(roomId).emit(
    "user-left",
    {
      id: socket.id
    }
  );


  io.to(roomId).emit(
    "participants",
    [...room.users.values()]
  );

}


// =================================
// SERVER
// =================================

const PORT =
  process.env.PORT || 3000;

server.listen(
  PORT,
  () => {

    console.log(
      `VMeet running on port ${PORT}`
    );

  }
);
