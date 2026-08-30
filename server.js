const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();


// ========================================
// TẠO ID PHÒNG
// ========================================

function createRoomId() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}


// ========================================
// KIỂM TRA CHỦ PHÒNG
// ========================================

function getRoom(socket) {
  return rooms.get(socket.data.room);
}

function isHost(socket) {
  const room = getRoom(socket);

  return room && room.host === socket.id;
}


// ========================================
// GỬI DANH SÁCH NGƯỜI
// ========================================

function sendParticipants(roomId) {
  const room = rooms.get(roomId);

  if (!room) return;

  const users = [...room.users.values()];

  io.to(roomId).emit("participants", users);
}


// ========================================
// KẾT NỐI
// ========================================

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);


  // ======================================
  // VÀO PHÒNG
  // ======================================

  socket.on("join-room", ({ room, name, create }) => {

    room = String(room || "")
      .trim()
      .toUpperCase();

    name = String(name || "Khách")
      .trim()
      .substring(0, 40);


    // ------------------------------------
    // TẠO PHÒNG
    // ------------------------------------

    if (create) {

      room = createRoomId();

      rooms.set(room, {

        host: socket.id,

        users: new Map(),

        locked: false,

        pinnedForAll: false

      });

    }


    // ------------------------------------
    // PHÒNG KHÔNG TỒN TẠI
    // ------------------------------------

    const currentRoom = rooms.get(room);

    if (!currentRoom) {

      socket.emit("room-error", {
        message: "Phòng không tồn tại hoặc đã kết thúc."
      });

      return;

    }


    // ------------------------------------
    // PHÒNG BỊ KHÓA
    // ------------------------------------

    if (
      currentRoom.locked &&
      currentRoom.host !== socket.id
    ) {

      socket.emit("room-locked", {
        message: "Phòng hiện đang bị khóa."
      });

      return;

    }


    // ------------------------------------
    // KHÔNG CHO MỘT SOCKET VÀO 2 PHÒNG
    // ------------------------------------

    if (socket.data.room) {

      const oldRoom =
        rooms.get(socket.data.room);

      if (oldRoom) {
        oldRoom.users.delete(socket.id);
      }

      socket.leave(socket.data.room);

    }


    // ------------------------------------
    // TẠO USER
    // ------------------------------------

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


    // ------------------------------------
    // THÔNG TIN CHO NGƯỜI VỪA VÀO
    // ------------------------------------

    socket.emit("room-joined", {

      room,

      isHost: user.isHost,

      pinnedForAll:
        currentRoom.pinnedForAll

    });


    // ------------------------------------
    // THÔNG BÁO NGƯỜI MỚI
    // ------------------------------------

    socket.to(room).emit(
      "user-joined",
      user
    );


    sendParticipants(room);

  });


  // ======================================
  // WEBRTC SIGNAL
  // ======================================

  socket.on(
    "signal",
    ({ to, data }) => {

      const room = getRoom(socket);

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


  // ======================================
  // HOST: TẮT MIC
  // ======================================

  socket.on(
    "host-mute-user",
    ({ userId }) => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

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


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: MỞ MIC
  // ======================================

  socket.on(
    "host-unlock-mic",
    ({ userId }) => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

      const user =
        room.users.get(userId);

      if (!user) return;


      user.micLocked = false;


      io.to(userId).emit(
        "unlock-mic"
      );


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: TẮT CAMERA
  // ======================================

  socket.on(
    "host-camera-off",
    ({ userId }) => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

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


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: MỞ CAMERA
  // ======================================

  socket.on(
    "host-unlock-camera",
    ({ userId }) => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

      const user =
        room.users.get(userId);

      if (!user) return;


      user.cameraLocked = false;


      io.to(userId).emit(
        "unlock-camera"
      );


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: TẮT MIC TẤT CẢ
  // ======================================

  socket.on(
    "host-mute-all",
    () => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

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


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: TẮT CAMERA TẤT CẢ
  // ======================================

  socket.on(
    "host-camera-off-all",
    () => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

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


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: MỞ MIC TẤT CẢ
  // ======================================

  socket.on(
    "host-unlock-all-mic",
    () => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

      for (
        const user of room.users.values()
      ) {

        user.micLocked = false;


        io.to(user.id).emit(
          "unlock-mic"
        );

      }


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: MỞ CAMERA TẤT CẢ
  // ======================================

  socket.on(
    "host-unlock-all-camera",
    () => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

      for (
        const user of room.users.values()
      ) {

        user.cameraLocked = false;


        io.to(user.id).emit(
          "unlock-camera"
        );

      }


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: ĐUỔI NGƯỜI
  // ======================================

  socket.on(
    "host-remove-user",
    ({ userId }) => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

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

        target.data.room = null;


        target.emit(
          "removed-from-room"
        );

      }


      io.to(socket.data.room).emit(
        "user-left",
        {
          id: userId
        }
      );


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ======================================
  // HOST: KHÓA / MỞ KHÓA PHÒNG
  // ======================================

  socket.on(
    "host-toggle-lock",
    () => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

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


  // ======================================
  // HOST: GHIM CHỦ PHÒNG CHO TẤT CẢ
  // ======================================

  socket.on(
    "host-toggle-pin",
    () => {

      if (!isHost(socket)) return;

      const room = getRoom(socket);

      if (!room) return;


      room.pinnedForAll =
        !room.pinnedForAll;


      io.to(socket.data.room).emit(
        "host-pin-changed",
        {

          pinned:
            room.pinnedForAll,

          hostId:
            socket.id

        }
      );

    }
  );


  // ======================================
  // CHAT
  // ======================================

  socket.on(
    "chat",
    ({ text }) => {

      const room = getRoom(socket);

      if (!room) return;


      const user =
        room.users.get(socket.id);

      if (!user) return;


      text = String(text || "")
        .trim()
        .substring(0, 500);


      if (!text) return;


      io.to(socket.data.room).emit(
        "chat",
        {

          name:
            user.name,

          text

        }
      );

    }
  );


  // ======================================
  // CHỦ PHÒNG KẾT THÚC CUỘC HỌP
  // ======================================

  socket.on(
    "end-meeting",
    () => {

      if (!isHost(socket)) return;

      const roomId =
        socket.data.room;

      const room =
        rooms.get(roomId);

      if (!room) return;


      io.to(roomId).emit(
        "meeting-ended"
      );


      rooms.delete(roomId);

    }
  );


  // ======================================
  // NGƯỜI THAM GIA RỜI PHÒNG
  // ======================================

  socket.on(
    "leave-room",
    () => {

      leaveRoom(socket);

    }
  );


  // ======================================
  // NGẮT KẾT NỐI
  // ======================================

  socket.on(
    "disconnect",
    () => {

      leaveRoom(socket);

    }
  );

});


// ========================================
// RỜI PHÒNG
// ========================================

function leaveRoom(socket) {

  const roomId =
    socket.data.room;

  if (!roomId) return;


  const room =
    rooms.get(roomId);

  if (!room) {

    socket.data.room = null;

    return;

  }


  // --------------------------------------
  // CHỦ PHÒNG RỜI
  // --------------------------------------

  if (
    room.host === socket.id
  ) {

    io.to(roomId).emit(
      "meeting-ended"
    );


    rooms.delete(roomId);


    socket.data.room = null;

    return;

  }


  // --------------------------------------
  // NGƯỜI THAM GIA RỜI
  // --------------------------------------

  room.users.delete(
    socket.id
  );


  socket.leave(roomId);


  socket.to(roomId).emit(
    "user-left",
    {
      id: socket.id
    }
  );


  sendParticipants(roomId);


  socket.data.room = null;

}


// ========================================
// SERVER
// ========================================

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
