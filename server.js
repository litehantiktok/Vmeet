const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();


// ================================
// KẾT NỐI
// ================================

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);


  // ==============================
  // TẠO PHÒNG
  // ==============================

  socket.on("create-room", ({ room, name }) => {

    if (rooms.has(room)) {

      socket.emit("room-error", {
        message: "Phòng đã tồn tại."
      });

      return;
    }


    rooms.set(room, {

      host: socket.id,

      users: new Map()

    });


    socket.data.room = room;

    socket.data.name =
      name || "Chủ phòng";

    socket.data.isHost = true;


    rooms.get(room).users.set(
      socket.id,
      {

        id: socket.id,

        name: socket.data.name,

        approved: true

      }
    );


    socket.join(room);


    socket.emit("room-created", {

      room,

      isHost: true

    });


    console.log(
      "Room created:",
      room
    );

  });


  // ==============================
  // XIN VÀO PHÒNG
  // ==============================

  socket.on(
    "request-join",
    ({ room, name }) => {

      const currentRoom =
        rooms.get(room);


      if (!currentRoom) {

        socket.emit(
          "room-error",
          {
            message:
              "Không tìm thấy phòng."
          }
        );

        return;
      }


      socket.data.room =
        room;

      socket.data.name =
        name || "Khách";

      socket.data.isHost =
        false;


      currentRoom.users.set(
        socket.id,
        {

          id: socket.id,

          name: socket.data.name,

          approved: false

        }
      );


      // Thông báo cho chủ phòng
      io.to(
        currentRoom.host
      ).emit(
        "join-request",
        {

          id: socket.id,

          name: socket.data.name

        }
      );


      // Người xin vào chờ
      socket.emit(
        "waiting-approval"
      );

    }
  );


  // ==============================
  // DUYỆT NGƯỜI
  // ==============================

  socket.on(
    "approve-user",
    ({ userId }) => {

      const room =
        rooms.get(
          socket.data.room
        );


      if (!room) return;


      // Chỉ chủ phòng được duyệt
      if (
        room.host !==
        socket.id
      ) {
        return;
      }


      const user =
        room.users.get(userId);


      if (!user) return;


      user.approved = true;


      const target =
        io.sockets.sockets.get(
          userId
        );


      if (!target) return;


      // Cho người đó vào Socket.IO room
      target.join(
        socket.data.room
      );


      target.emit(
        "approved",
        {
          room:
            socket.data.room
        }
      );


      // Gửi danh sách người đã được duyệt
      const approvedUsers =
        [...room.users.values()]
          .filter(
            user =>
              user.approved
          );


      io.to(
        socket.data.room
      ).emit(
        "participants",
        approvedUsers
      );


      // Thông báo người mới đã vào
      io.to(
        socket.data.room
      ).emit(
        "user-joined",
        {

          id: user.id,

          name: user.name

        }
      );

    }
  );


  // ==============================
  // TỪ CHỐI
  // ==============================

  socket.on(
    "reject-user",
    ({ userId }) => {

      const room =
        rooms.get(
          socket.data.room
        );


      if (!room) return;


      if (
        room.host !==
        socket.id
      ) {
        return;
      }


      const target =
        io.sockets.sockets.get(
          userId
        );


      if (target) {

        target.emit(
          "rejected",
          {

            message:
              "Chủ phòng đã từ chối yêu cầu tham gia."

          }
        );

        target.data.room =
          null;

      }


      room.users.delete(
        userId
      );

    }
  );


  // ==============================
  // WEBRTC SIGNAL
  // ==============================

  socket.on(
    "signal",
    ({ to, data }) => {

      const room =
        rooms.get(
          socket.data.room
        );


      if (!room) return;


      const targetUser =
        room.users.get(to);


      if (
        !targetUser ||
        !targetUser.approved
      ) {
        return;
      }


      io.to(to).emit(
        "signal",
        {

          from:
            socket.id,

          data

        }
      );

    }
  );


  // ==============================
  // CHAT
  // ==============================

  socket.on(
    "chat",
    ({ room, name, text }) => {

      if (
        !text ||
        !text.trim()
      ) {
        return;
      }


      const currentRoom =
        rooms.get(room);


      if (!currentRoom) {
        return;
      }


      const user =
        currentRoom.users.get(
          socket.id
        );


      if (
        !user ||
        !user.approved
      ) {
        return;
      }


      io.to(room).emit(
        "chat",
        {

          name:
            name ||
            user.name,

          text:
            text.trim()

        }
      );

    }
  );


  // ==============================
  // DANH SÁCH NGƯỜI
  // ==============================

  socket.on(
    "get-participants",
    () => {

      const room =
        rooms.get(
          socket.data.room
        );


      if (!room) return;


      const users =
        [...room.users.values()]
          .filter(
            user =>
              user.approved
          );


      socket.emit(
        "participants",
        users
      );

    }
  );


  // ==============================
  // RỜI PHÒNG
  // ==============================

  socket.on(
    "leave-room",
    () => {

      removeUser(socket);

    }
  );


  // ==============================
  // DISCONNECT
  // ==============================

  socket.on(
    "disconnect",
    () => {

      removeUser(socket);

    }
  );

});


// =================================
// XỬ LÝ NGƯỜI RỜI
// =================================

function removeUser(socket) {

  const roomId =
    socket.data.room;


  if (!roomId) {
    return;
  }


  const room =
    rooms.get(roomId);


  if (!room) {
    return;
  }


  // Chủ phòng rời
  if (
    room.host ===
    socket.id
  ) {

    io.to(roomId).emit(
      "room-closed"
    );


    rooms.delete(
      roomId
    );


    return;

  }


  // Người tham gia rời
  room.users.delete(
    socket.id
  );


  socket.to(roomId).emit(
    "user-left",
    {

      id:
        socket.id

    }
  );


  const users =
    [...room.users.values()]
      .filter(
        user =>
          user.approved
      );


  io.to(roomId).emit(
    "participants",
    users
  );

}


// =================================
// SERVER PORT
// =================================

const PORT =
  process.env.PORT ||
  3000;


server.listen(
  PORT,
  () => {

    console.log(
      `VMeet running on port ${PORT}`
    );

  }
);
