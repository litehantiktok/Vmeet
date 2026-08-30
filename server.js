const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


// =====================================================
// ROOMS
// =====================================================

const rooms = new Map();


// =====================================================
// TẠO ROOM ID
// =====================================================

function createRoomId() {

  let roomId;

  do {

    roomId = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

  } while (rooms.has(roomId));

  return roomId;
}


// =====================================================
// GỬI DANH SÁCH NGƯỜI
// =====================================================

function sendParticipants(roomId) {

  const room = rooms.get(roomId);

  if (!room) return;

  io.to(roomId).emit(
    "participants",
    Array.from(room.users.values())
  );
}


// =====================================================
// CONNECTION
// =====================================================

io.on("connection", (socket) => {

  console.log(
    "User connected:",
    socket.id
  );


  // ===================================================
  // JOIN ROOM
  // ===================================================

  socket.on(
    "join-room",
    ({
      room,
      name,
      create
    } = {}) => {

      name = String(
        name || "Khách"
      )
        .trim()
        .substring(0, 40);


      // ===============================================
      // TẠO PHÒNG MỚI
      // ===============================================

      if (create === true) {

        room = createRoomId();

        rooms.set(room, {

          host: socket.id,

          locked: false,

          pinnedForAll: false,

          users: new Map()

        });

        console.log(
          "Room created:",
          room
        );

      }


      // ===============================================
      // CHUẨN HÓA ROOM
      // ===============================================

      room = String(
        room || ""
      )
        .trim()
        .toUpperCase();


      // ===============================================
      // KHÔNG CÓ MÃ PHÒNG
      // ===============================================

      if (!room) {

        socket.emit(
          "room-error",
          {
            message:
              "Vui lòng nhập link hoặc mã phòng."
          }
        );

        return;
      }


      // ===============================================
      // TÌM PHÒNG
      // ===============================================

      const currentRoom =
        rooms.get(room);


      if (!currentRoom) {

        socket.emit(
          "room-error",
          {
            message:
              "Không tìm thấy phòng. Có thể phòng đã kết thúc hoặc server vừa khởi động lại."
          }
        );

        return;
      }


      // ===============================================
      // ĐÃ Ở TRONG PHÒNG KHÁC
      // ===============================================

      if (
        socket.data.room &&
        socket.data.room !== room
      ) {

        leaveRoom(socket);

      }


      // ===============================================
      // PHÒNG ĐÃ KHÓA
      // ===============================================

      if (
        currentRoom.locked &&
        currentRoom.host !== socket.id
      ) {

        socket.emit(
          "room-locked",
          {
            message:
              "Phòng đang bị khóa. Không thể tham gia."
          }
        );

        return;
      }


      // ===============================================
      // KIỂM TRA ĐÃ CÓ TRONG PHÒNG
      // ===============================================

      if (
        currentRoom.users.has(socket.id)
      ) {

        socket.emit(
          "room-joined",
          {

            room: room,

            isHost:
              currentRoom.host === socket.id,

            pinnedForAll:
              currentRoom.pinnedForAll

          }
        );

        return;
      }


      // ===============================================
      // USER
      // ===============================================

      const user = {

        id:
          socket.id,

        name:
          name || "Khách",

        isHost:
          currentRoom.host === socket.id,

        micEnabled:
          true,

        cameraEnabled:
          true,

        micLocked:
          false,

        cameraLocked:
          false

      };


      // ===============================================
      // THÊM USER
      // ===============================================

      currentRoom.users.set(
        socket.id,
        user
      );


      socket.data.room =
        room;

      socket.data.name =
        user.name;


      socket.join(room);


      // ===============================================
      // BÁO USER ĐÃ VÀO
      // ===============================================

      socket.emit(
        "room-joined",
        {

          room:
            room,

          isHost:
            user.isHost,

          pinnedForAll:
            currentRoom.pinnedForAll

        }
      );


      // ===============================================
      // BÁO CHO NHỮNG NGƯỜI ĐANG Ở TRONG PHÒNG
      // ===============================================

      socket.to(room).emit(
        "user-joined",
        user
      );


      // ===============================================
      // CẬP NHẬT DANH SÁCH
      // ===============================================

      sendParticipants(room);


      console.log(
        `${user.name} joined room ${room}`
      );

    }
  );


  // ===================================================
  // WEBRTC SIGNAL
  // ===================================================

  socket.on(
    "signal",
    ({
      to,
      data
    } = {}) => {

      if (!to || !data) return;

      const target =
        io.sockets.sockets.get(to);

      if (!target) return;

      target.emit(
        "signal",
        {

          from:
            socket.id,

          data:
            data

        }
      );

    }
  );


  // ===================================================
  // CHAT
  // ===================================================

  socket.on(
    "chat",
    ({
      text
    } = {}) => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;


      const user =
        room.users.get(
          socket.id
        );

      if (!user) return;


      text = String(
        text || ""
      )
        .trim()
        .substring(0, 500);


      if (!text) return;


      io.to(
        socket.data.room
      ).emit(
        "chat",
        {

          name:
            user.name,

          text:
            text

        }
      );

    }
  );


  // ===================================================
  // GHIM CHỦ PHÒNG
  // ===================================================

  socket.on(
    "host-toggle-pin",
    () => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;


      if (
        room.host !== socket.id
      ) return;


      room.pinnedForAll =
        !room.pinnedForAll;


      io.to(
        socket.data.room
      ).emit(
        "host-pin-changed",
        {

          pinned:
            room.pinnedForAll,

          hostId:
            room.host

        }
      );

    }
  );


  // ===================================================
  // MUTE MỘT NGƯỜI
  // ===================================================

  socket.on(
    "host-mute-user",
    ({
      userId
    } = {}) => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;

      if (
        room.host !== socket.id
      ) return;


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


  // ===================================================
  // TẮT CAMERA MỘT NGƯỜI
  // ===================================================

  socket.on(
    "host-camera-off",
    ({
      userId
    } = {}) => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;

      if (
        room.host !== socket.id
      ) return;


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


  // ===================================================
  // MUTE TẤT CẢ
  // ===================================================

  socket.on(
    "host-mute-all",
    () => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;

      if (
        room.host !== socket.id
      ) return;


      room.users.forEach(
        (user) => {

          if (
            user.id === socket.id
          ) return;


          user.micEnabled = false;

          user.micLocked = true;


          io.to(user.id).emit(
            "force-mute",
            {
              locked: true
            }
          );

        }
      );


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ===================================================
  // TẮT CAMERA TẤT CẢ
  // ===================================================

  socket.on(
    "host-camera-off-all",
    () => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;

      if (
        room.host !== socket.id
      ) return;


      room.users.forEach(
        (user) => {

          if (
            user.id === socket.id
          ) return;


          user.cameraEnabled = false;

          user.cameraLocked = true;


          io.to(user.id).emit(
            "force-camera-off",
            {
              locked: true
            }
          );

        }
      );


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ===================================================
  // MỞ MIC TẤT CẢ
  // ===================================================

  socket.on(
    "host-unlock-all-mic",
    () => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;

      if (
        room.host !== socket.id
      ) return;


      room.users.forEach(
        (user) => {

          user.micLocked = false;

          io.to(user.id).emit(
            "unlock-mic"
          );

        }
      );


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ===================================================
  // MỞ CAMERA TẤT CẢ
  // ===================================================

  socket.on(
    "host-unlock-all-camera",
    () => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;

      if (
        room.host !== socket.id
      ) return;


      room.users.forEach(
        (user) => {

          user.cameraLocked = false;

          io.to(user.id).emit(
            "unlock-camera"
          );

        }
      );


      sendParticipants(
        socket.data.room
      );

    }
  );


  // ===================================================
  // ĐUỔI NGƯỜI
  // ===================================================

  socket.on(
    "host-remove-user",
    ({
      userId
    } = {}) => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;

      if (
        room.host !== socket.id
      ) return;

      if (
        userId === socket.id
      ) return;


      const target =
        io.sockets.sockets.get(userId);


      room.users.delete(userId);


      if (target) {

        target.leave(
          socket.data.room
        );

        target.data.room =
          null;

        target.emit(
          "removed-from-room"
        );

      }


      io.to(
        socket.data.room
      ).emit(
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


  // ===================================================
  // KHÓA PHÒNG
  // ===================================================

  socket.on(
    "host-toggle-lock",
    () => {

      const room =
        rooms.get(
          socket.data.room
        );

      if (!room) return;

      if (
        room.host !== socket.id
      ) return;


      room.locked =
        !room.locked;


      io.to(
        socket.data.room
      ).emit(
        "room-lock-changed",
        {
          locked:
            room.locked
        }
      );

    }
  );


  // ===================================================
  // KẾT THÚC CUỘC HỌP
  // ===================================================

  socket.on(
    "end-meeting",
    () => {

      const roomId =
        socket.data.room;

      const room =
        rooms.get(roomId);

      if (!room) return;


      if (
        room.host !== socket.id
      ) return;


      io.to(roomId).emit(
        "meeting-ended"
      );


      rooms.delete(roomId);


      console.log(
        "Meeting ended:",
        roomId
      );

    }
  );


  // ===================================================
  // RỜI PHÒNG
  // ===================================================

  socket.on(
    "leave-room",
    () => {

      leaveRoom(socket);

    }
  );


  // ===================================================
  // DISCONNECT
  // ===================================================

  socket.on(
    "disconnect",
    () => {

      leaveRoom(socket);

      console.log(
        "User disconnected:",
        socket.id
      );

    }
  );

});


// =====================================================
// LEAVE ROOM
// =====================================================

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


  // ===============================================
  // CHỦ PHÒNG RỜI
  // ===============================================

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


  // ===============================================
  // KHÁCH RỜI
  // ===============================================

  room.users.delete(
    socket.id
  );


  socket.leave(roomId);


  io.to(roomId).emit(
    "user-left",
    {
      id: socket.id
    }
  );


  sendParticipants(roomId);


  socket.data.room = null;

}


// =====================================================
// SERVER
// =====================================================

const PORT =
  process.env.PORT || 3000;


server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `VMeet server running on port ${PORT}`
    );

  }
);
