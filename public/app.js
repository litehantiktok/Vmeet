const socket = io();

const $ = (id) => document.getElementById(id);

const home = $("home");
const meeting = $("meeting");

const nameInput = $("name");
const createBtn = $("create");

const localVideo = $("localVideo");
const localName = $("localName");
const localHostBadge = $("localHostBadge");
const localTile = $("localTile");

const roomTitle = $("roomTitle");
const videos = $("videos");

const micBtn = $("mic");
const camBtn = $("cam");
const switchCameraBtn = $("switchCamera");
const screenBtn = $("screen");
const leaveBtn = $("leave");

const copyBtn = $("copy");

const chatBtn = $("chatBtn");
const chatPanel = $("chatPanel");
const closeChat = $("closeChat");
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const messages = $("messages");

const participantsBtn = $("participantsBtn");
const participantsPanel = $("participantsPanel");
const closeParticipants = $("closeParticipants");
const participantsList = $("participantsList");

const hostControls = $("hostControls");

const pinHost = $("pinHost");
const muteAll = $("muteAll");
const cameraOffAll = $("cameraOffAll");
const unlockAllMic = $("unlockAllMic");
const unlockAllCamera = $("unlockAllCamera");
const lockRoom = $("lockRoom");

const toast = $("toast");

let localStream = null;
let screenStream = null;

let roomId = null;
let myName = "";
let isHost = false;

let cameraFacing = "user";

let participants = [];

let peerConnections = {};


// =====================================
// THÔNG BÁO
// =====================================

function showToast(text) {

  toast.textContent = text;

  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}


// =====================================
// TẠO KẾT NỐI SOCKET
// =====================================

socket.on("connect", () => {

  console.log(
    "Socket connected:",
    socket.id
  );

});


// =====================================
// TẠO CUỘC HỌP
// =====================================

createBtn.addEventListener(
  "click",
  async () => {

    myName =
      nameInput.value.trim();

    if (!myName) {

      showToast(
        "Vui lòng nhập tên của bạn."
      );

      nameInput.focus();

      return;
    }

    createBtn.disabled = true;

    createBtn.textContent =
      "Đang tạo cuộc họp...";

    try {

      await startMeeting(true);

    } catch (error) {

      console.error(error);

      showToast(
        "Không thể bắt đầu cuộc họp."
      );

      createBtn.disabled = false;

      createBtn.textContent =
        "➕ Tạo cuộc họp mới";
    }
  }
);


// =====================================
// BẮT ĐẦU CUỘC HỌP
// =====================================

async function startMeeting(create) {

  if (!navigator.mediaDevices) {

    throw new Error(
      "Trình duyệt không hỗ trợ camera/mic."
    );
  }

  try {

    localStream =
      await navigator.mediaDevices.getUserMedia(
        {
          video: {
            facingMode: cameraFacing
          },
          audio: true
        }
      );

  } catch (error) {

    console.error(
      "Camera/mic error:",
      error
    );

    showToast(
      "Không thể truy cập camera hoặc mic."
    );

    throw error;
  }


  localVideo.srcObject =
    localStream;


  localName.textContent =
    myName;


  socket.emit(
    "join-room",
    {
      room: "",
      name: myName,
      create: create
    }
  );
}


// =====================================
// VÀO PHÒNG THÀNH CÔNG
// =====================================

socket.on(
  "room-joined",
  (data) => {

    roomId = data.room;

    isHost = data.isHost;

    home.classList.add("hidden");

    meeting.classList.remove("hidden");

    roomTitle.textContent =
      "Phòng " + roomId;

    localTile.dataset.userId =
      socket.id;


    if (isHost) {

      localHostBadge.classList.remove(
        "hidden"
      );

      hostControls.classList.remove(
        "hidden"
      );

    } else {

      localHostBadge.classList.add(
        "hidden"
      );

      hostControls.classList.add(
        "hidden"
      );
    }


    updateParticipants();


    createShareLink();


    showToast(
      "Đã tạo cuộc họp thành công."
    );

  }
);


// =====================================
// TẠO LINK MỜI
// =====================================

function createShareLink() {

  const url =
    window.location.origin +
    "?room=" +
    encodeURIComponent(roomId);

  history.replaceState(
    null,
    "",
    "?room=" +
      encodeURIComponent(roomId)
  );

  copyBtn.onclick =
    async () => {

      try {

        await navigator.clipboard.writeText(
          url
        );

        showToast(
          "Đã sao chép link cuộc họp."
        );

      } catch {

        showToast(
          url
        );
      }
    };
}


// =====================================
// KIỂM TRA LINK PHÒNG
// =====================================

const params =
  new URLSearchParams(
    window.location.search
  );

const invitedRoom =
  params.get("room");

if (invitedRoom) {

  const joinInfo =
    $("joinInfo");

  const joinBtn =
    $("join");

  joinInfo.classList.remove(
    "hidden"
  );

  joinBtn.classList.remove(
    "hidden"
  );

  joinBtn.addEventListener(
    "click",
    async () => {

      myName =
        nameInput.value.trim();

      if (!myName) {

        showToast(
          "Vui lòng nhập tên của bạn."
        );

        nameInput.focus();

        return;
      }

      joinBtn.disabled = true;

      joinBtn.textContent =
        "Đang vào phòng...";


      try {

        localStream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode:
                  cameraFacing
              },
              audio: true
            }
          );

        localVideo.srcObject =
          localStream;


        localName.textContent =
          myName;


        socket.emit(
          "join-room",
          {
            room: invitedRoom,
            name: myName,
            create: false
          }
        );

      } catch (error) {

        console.error(error);

        showToast(
          "Không thể vào phòng."
        );

        joinBtn.disabled = false;

        joinBtn.textContent =
          "🚪 Tham gia cuộc họp";
      }
    }
  );
}


// =====================================
// MIC
// =====================================

micBtn.addEventListener(
  "click",
  () => {

    if (!localStream) return;

    const track =
      localStream.getAudioTracks()[0];

    if (!track) return;

    track.enabled =
      !track.enabled;

    micBtn.firstChild.textContent =
      track.enabled
        ? "🎤 "
        : "🔇 ";

    showToast(
      track.enabled
        ? "Đã bật mic"
        : "Đã tắt mic"
    );
  }
);


// =====================================
// CAMERA
// =====================================

camBtn.addEventListener(
  "click",
  () => {

    if (!localStream) return;

    const track =
      localStream.getVideoTracks()[0];

    if (!track) return;

    track.enabled =
      !track.enabled;

    camBtn.firstChild.textContent =
      track.enabled
        ? "📷 "
        : "🚫 ";

    showToast(
      track.enabled
        ? "Đã bật camera"
        : "Đã tắt camera"
    );
  }
);


// =====================================
// ĐỔI CAMERA TRƯỚC / SAU
// =====================================

switchCameraBtn.addEventListener(
  "click",
  async () => {

    if (!localStream) return;

    cameraFacing =
      cameraFacing === "user"
        ? "environment"
        : "user";


    try {

      const newStream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode:
                cameraFacing
            },
            audio: false
          }
        );


      const newTrack =
        newStream.getVideoTracks()[0];

      const oldTrack =
        localStream.getVideoTracks()[0];


      localStream.removeTrack(
        oldTrack
      );

      oldTrack.stop();


      localStream.addTrack(
        newTrack
      );


      localVideo.srcObject =
        localStream;


      // cập nhật WebRTC
      Object.values(
        peerConnections
      ).forEach(
        async (pc) => {

          const sender =
            pc.getSenders()
              .find(
                s =>
                  s.track &&
                  s.track.kind ===
                    "video"
              );

          if (sender) {

            await sender.replaceTrack(
              newTrack
            );
          }
        }
      );


      showToast(
        cameraFacing === "environment"
          ? "Đã chuyển sang camera sau"
          : "Đã chuyển sang camera trước"
      );

    } catch (error) {

      console.error(error);

      cameraFacing =
        cameraFacing === "user"
          ? "environment"
          : "user";

      showToast(
        "Không thể đổi camera."
      );
    }
  }
);


// =====================================
// CHIA SẺ MÀN HÌNH
// =====================================

screenBtn.addEventListener(
  "click",
  async () => {

    try {

      if (screenStream) {

        stopScreenShare();

        return;
      }


      screenStream =
        await navigator.mediaDevices.getDisplayMedia(
          {
            video: true,
            audio: false
          }
        );


      const screenTrack =
        screenStream.getVideoTracks()[0];


      localVideo.srcObject =
        screenStream;


      Object.values(
        peerConnections
      ).forEach(
        async (pc) => {

          const sender =
            pc.getSenders()
              .find(
                s =>
                  s.track &&
                  s.track.kind ===
                    "video"
              );

          if (sender) {

            await sender.replaceTrack(
              screenTrack
            );
          }
        }
      );


      screenTrack.onended =
        () => {

          stopScreenShare();

        };


      screenBtn.firstChild.textContent =
        "⏹️ ";

      showToast(
        "Đang chia sẻ màn hình"
      );

    } catch (error) {

      console.error(error);

      showToast(
        "Không thể chia sẻ màn hình."
      );
    }
  }
);


function stopScreenShare() {

  if (!screenStream) return;

  screenStream
    .getTracks()
    .forEach(
      track =>
        track.stop()
    );

  screenStream = null;


  localVideo.srcObject =
    localStream;


  const cameraTrack =
    localStream.getVideoTracks()[0];


  Object.values(
    peerConnections
  ).forEach(
    async (pc) => {

      const sender =
        pc.getSenders()
          .find(
            s =>
              s.track &&
              s.track.kind ===
                "video"
          );

      if (sender) {

        await sender.replaceTrack(
          cameraTrack
        );
      }
    }
  );


  screenBtn.firstChild.textContent =
    "🖥️ ";
}


// =====================================
// CHAT
// =====================================

chatBtn.addEventListener(
  "click",
  () => {

    chatPanel.classList.toggle(
      "hidden"
    );

    if (
      !chatPanel.classList.contains(
        "hidden"
      )
    ) {

      chatInput.focus();

    }
  }
);


closeChat.addEventListener(
  "click",
  () => {

    chatPanel.classList.add(
      "hidden"
    );

  }
);


chatForm.addEventListener(
  "submit",
  (event) => {

    event.preventDefault();

    const text =
      chatInput.value.trim();

    if (!text) return;

    socket.emit(
      "chat",
      {
        text: text
      }
    );

    chatInput.value = "";

  }
);


socket.on(
  "chat",
  ({ name, text }) => {

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "msg";

    div.textContent =
      name + ": " + text;

    messages.appendChild(
      div
    );

    messages.scrollTop =
      messages.scrollHeight;

  }
);


// =====================================
// NGƯỜI THAM GIA
// =====================================

participantsBtn.addEventListener(
  "click",
  () => {

    participantsPanel.classList.toggle(
      "hidden"
    );

  }
);


closeParticipants.addEventListener(
  "click",
  () => {

    participantsPanel.classList.add(
      "hidden"
    );

  }
);


socket.on(
  "participants",
  (list) => {

    participants =
      list || [];

    updateParticipants();

  }
);


function updateParticipants() {

  participantsList.innerHTML =
    "";

  participants.forEach(
    user => {

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "participant";


      const name =
        document.createElement(
          "span"
        );

      name.textContent =
        user.name +
        (
          user.isHost
            ? " 👑"
            : ""
        );


      row.appendChild(
        name
      );


      if (
        isHost &&
        user.id !== socket.id
      ) {

        const mute =
          document.createElement(
            "button"
          );

        mute.textContent =
          "🔇";

        mute.onclick =
          () => {

            socket.emit(
              "host-mute-user",
              {
                userId:
                  user.id
              }
            );
          };


        const cam =
          document.createElement(
            "button"
          );

        cam.textContent =
          "📷";

        cam.onclick =
          () => {

            socket.emit(
              "host-camera-off",
              {
                userId:
                  user.id
              }
            );
          };


        const remove =
          document.createElement(
            "button"
          );

        remove.textContent =
          "🚫";

        remove.onclick =
          () => {

            socket.emit(
              "host-remove-user",
              {
                userId:
                  user.id
              }
            );
          };


        row.appendChild(
          mute
        );

        row.appendChild(
          cam
        );

        row.appendChild(
          remove
        );
      }


      participantsList.appendChild(
        row
      );
    }
  );
}


// =====================================
// CHỦ PHÒNG
// =====================================

pinHost.addEventListener(
  "click",
  () => {

    if (!isHost) return;

    socket.emit(
      "host-toggle-pin"
    );

  }
);


muteAll.addEventListener(
  "click",
  () => {

    if (!isHost) return;

    socket.emit(
      "host-mute-all"
    );

  }
);


cameraOffAll.addEventListener(
  "click",
  () => {

    if (!isHost) return;

    socket.emit(
      "host-camera-off-all"
    );

  }
);


unlockAllMic.addEventListener(
  "click",
  () => {

    if (!isHost) return;

    socket.emit(
      "host-unlock-all-mic"
    );

  }
);


unlockAllCamera.addEventListener(
  "click",
  () => {

    if (!isHost) return;

    socket.emit(
      "host-unlock-all-camera"
    );

  }
);


lockRoom.addEventListener(
  "click",
  () => {

    if (!isHost) return;

    socket.emit(
      "host-toggle-lock"
    );

  }
);


// =====================================
// XỬ LÝ LỆNH CHỦ PHÒNG
// =====================================

socket.on(
  "force-mute",
  () => {

    if (!localStream) return;

    const track =
      localStream.getAudioTracks()[0];

    if (track) {

      track.enabled =
        false;

      micBtn.firstChild.textContent =
        "🔇 ";
    }

    showToast(
      "Chủ phòng đã tắt mic của bạn."
    );
  }
);


socket.on(
  "force-camera-off",
  () => {

    if (!localStream) return;

    const track =
      localStream.getVideoTracks()[0];

    if (track) {

      track.enabled =
        false;

      camBtn.firstChild.textContent =
        "🚫 ";
    }

    showToast(
      "Chủ phòng đã tắt camera của bạn."
    );
  }
);


socket.on(
  "unlock-mic",
  () => {

    showToast(
      "Chủ phòng đã cho phép bật mic."
    );

  }
);


socket.on(
  "unlock-camera",
  () => {

    showToast(
      "Chủ phòng đã cho phép bật camera."
    );

  }
);


socket.on(
  "room-lock-changed",
  ({ locked }) => {

    showToast(
      locked
        ? "Phòng đã được khóa."
        : "Phòng đã được mở khóa."
    );

  }
);


// =====================================
// GHIM CHỦ PHÒNG
// =====================================

socket.on(
  "host-pin-changed",
  ({ pinned, hostId }) => {

    const hostTile =
      document.querySelector(
        `[data-user-id="${hostId}"]`
      );

    if (!hostTile) return;


    document
      .querySelectorAll(
        ".pinned-tile"
      )
      .forEach(
        tile =>
          tile.classList.remove(
            "pinned-tile"
          )
      );


    if (pinned) {

      hostTile.classList.add(
        "pinned-tile"
      );

      showToast(
        "Chủ phòng đã được ghim cho tất cả."
      );

    } else {

      showToast(
        "Đã bỏ ghim."
      );
    }

  }
);


// =====================================
// NGƯỜI MỚI VÀO
// =====================================

socket.on(
  "user-joined",
  async (user) => {

    console.log(
      "User joined:",
      user
    );

    showToast(
      user.name +
      " đã tham gia phòng."
    );

  }
);


socket.on(
  "user-left",
  ({ id }) => {

    const tile =
      document.querySelector(
        `[data-user-id="${id}"]`
      );

    if (tile) {

      tile.remove();

    }

    if (
      peerConnections[id]
    ) {

      peerConnections[id]
        .close();

      delete peerConnections[id];

    }

  }
);


// =====================================
// RỜI PHÒNG
// =====================================

leaveBtn.addEventListener(
  "click",
  () => {

    if (
      !confirm(
        "Bạn có chắc muốn rời phòng?"
      )
    ) {
      return;
    }

    leaveMeeting();

  }
);


function leaveMeeting() {

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  if (screenStream) {

    screenStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  Object.values(
    peerConnections
  ).forEach(
    pc =>
      pc.close()
  );


  peerConnections =
    {};


  socket.emit(
    "leave-room"
  );


  meeting.classList.add(
    "hidden"
  );

  home.classList.remove(
    "hidden"
  );


  showToast(
    "Bạn đã rời phòng."
  );
}


// =====================================
// KẾT THÚC CUỘC HỌP
// =====================================

socket.on(
  "meeting-ended",
  () => {

    if (localStream) {

      localStream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

    }


    Object.values(
      peerConnections
    ).forEach(
      pc =>
        pc.close()
    );


    peerConnections =
      {};


    meeting.classList.add(
      "hidden"
    );

    home.classList.remove(
      "hidden"
    );


    showToast(
      "Cuộc họp đã kết thúc."
    );
  }
);


// =====================================
// NGƯỜI BỊ ĐUỔI
// =====================================

socket.on(
  "removed-from-room",
  () => {

    leaveMeeting();

    showToast(
      "Bạn đã được rời khỏi phòng."
    );

  }
);


// =====================================
// LỖI PHÒNG
// =====================================

socket.on(
  "room-error",
  ({ message }) => {

    showToast(
      message ||
      "Không thể vào phòng."
    );

  }
);


socket.on(
  "room-locked",
  ({ message }) => {

    showToast(
      message ||
      "Phòng đang bị khóa."
    );

  }
);


// =====================================
// TRẠNG THÁI MẶC ĐỊNH
// =====================================

window.addEventListener(
  "load",
  () => {

    console.log(
      "VMeet loaded."
    );

  }
);
