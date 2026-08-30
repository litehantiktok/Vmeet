const socket = io();

const $ = (id) => document.getElementById(id);

// ===============================
// DOM
// ===============================

const home = $("home");
const meeting = $("meeting");

const nameInput = $("name");
const createBtn = $("create");
const joinBtn = $("join");
const joinInfo = $("joinInfo");

const localVideo = $("localVideo");
const localTile = $("localTile");
const localName = $("localName");
const localHostBadge = $("localHostBadge");

const roomTitle = $("roomTitle");
const videos = $("videos");

const micBtn = $("mic");
const camBtn = $("cam");
const switchCameraBtn = $("switchCamera");
const screenBtn = $("screen");
const leaveBtn = $("leave");

const copyBtn = $("copy");
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

const chatBtn = $("chatBtn");
const chatPanel = $("chatPanel");
const closeChat = $("closeChat");
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const messages = $("messages");

const toast = $("toast");

// ===============================
// STATE
// ===============================

let localStream = null;
let screenStream = null;

let roomId = null;
let myName = "";
let isHost = false;

let cameraFacing = "user";

let participants = [];

const peerConnections = {};

const pendingCandidates = {};

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: "stun:stun1.l.google.com:19302"
    }
  ]
};

// ===============================
// TOAST
// ===============================

function showToast(message) {

  if (!toast) return;

  toast.textContent = message;

  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}

// ===============================
// CAMERA + MIC
// ===============================

async function getLocalMedia() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    throw new Error(
      "Trình duyệt không hỗ trợ camera."
    );
  }

  if (localStream) {
    return localStream;
  }

  localStream =
    await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: cameraFacing,
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      },
      audio: true
    });

  localVideo.srcObject = localStream;

  return localStream;
}

// ===============================
// TẠO PHÒNG
// ===============================

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

      await getLocalMedia();

      socket.emit(
        "join-room",
        {
          room: "",
          name: myName,
          create: true
        }
      );

    } catch (error) {

      console.error(error);

      createBtn.disabled = false;

      createBtn.textContent =
        "➕ Tạo cuộc họp mới";

      showToast(
        "Không thể mở camera hoặc mic."
      );
    }
  }
);

// ===============================
// THAM GIA PHÒNG QUA LINK
// ===============================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const invitedRoom =
  urlParams.get("room");

if (invitedRoom) {

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

        await getLocalMedia();

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

        joinBtn.disabled = false;

        joinBtn.textContent =
          "🚪 Tham gia cuộc họp";

        showToast(
          "Không thể mở camera hoặc mic."
        );
      }
    }
  );
}

// ===============================
// VÀO PHÒNG THÀNH CÔNG
// ===============================

socket.on(
  "room-joined",
  async (data) => {

    roomId = data.room;

    isHost = data.isHost;

    home.classList.add("hidden");

    meeting.classList.remove("hidden");

    roomTitle.textContent =
      "Phòng " + roomId;

    localName.textContent =
      myName;

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

    createShareLink();

    showToast(
      isHost
        ? "Đã tạo cuộc họp."
        : "Đã tham gia cuộc họp."
    );
  }
);

// ===============================
// LINK MỜI
// ===============================

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

        window.prompt(
          "Sao chép link này:",
          url
        );
      }
    };
}

// ===============================
// PARTICIPANTS
// ===============================

socket.on(
  "participants",
  (list) => {

    participants =
      Array.isArray(list)
        ? list
        : [];

    updateParticipants();

  }
);

function updateParticipants() {

  participantsList.innerHTML = "";

  participants.forEach(
    (user) => {

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

      row.appendChild(name);

      if (
        isHost &&
        user.id !== socket.id
      ) {

        const mute =
          document.createElement(
            "button"
          );

        mute.textContent = "🔇";

        mute.title =
          "Tắt mic";

        mute.onclick =
          () => {

            socket.emit(
              "host-mute-user",
              {
                userId: user.id
              }
            );

          };

        const cam =
          document.createElement(
            "button"
          );

        cam.textContent = "📷";

        cam.title =
          "Tắt camera";

        cam.onclick =
          () => {

            socket.emit(
              "host-camera-off",
              {
                userId: user.id
              }
            );

          };

        const remove =
          document.createElement(
            "button"
          );

        remove.textContent = "🚫";

        remove.title =
          "Đuổi khỏi phòng";

        remove.onclick =
          () => {

            if (
              confirm(
                "Bạn có chắc muốn đuổi người này?"
              )
            ) {

              socket.emit(
                "host-remove-user",
                {
                  userId: user.id
                }
              );
            }
          };

        row.appendChild(mute);
        row.appendChild(cam);
        row.appendChild(remove);
      }

      participantsList.appendChild(
        row
      );
    }
  );
}

// ===============================
// WEBRTC
// ===============================

function createPeerConnection(
  remoteId
) {

  if (
    peerConnections[remoteId]
  ) {

    return peerConnections[remoteId];

  }

  const pc =
    new RTCPeerConnection(
      configuration
    );

  peerConnections[remoteId] =
    pc;

  pendingCandidates[remoteId] =
    [];

  // -------------------------------
  // Gửi camera + mic
  // -------------------------------

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        (track) => {

          pc.addTrack(
            track,
            localStream
          );

        }
      );
  }

  // -------------------------------
  // Nhận camera + mic người khác
  // -------------------------------

  pc.ontrack =
    (event) => {

      const stream =
        event.streams &&
        event.streams[0];

      if (!stream) return;

      createRemoteVideo(
        remoteId,
        stream
      );
    };

  // -------------------------------
  // ICE
  // -------------------------------

  pc.onicecandidate =
    (event) => {

      if (
        event.candidate
      ) {

        socket.emit(
          "signal",
          {
            to: remoteId,
            data: {
              type: "candidate",
              candidate:
                event.candidate
            }
          }
        );
      }
    };

  pc.onconnectionstatechange =
    () => {

      console.log(
        "Connection",
        remoteId,
        pc.connectionState
      );

      if (
        pc.connectionState ===
          "failed" ||
        pc.connectionState ===
          "closed"
      ) {

        removeRemoteVideo(
          remoteId
        );
      }
    };

  return pc;
}

// ===============================
// VIDEO NGƯỜI THAM GIA
// ===============================

function createRemoteVideo(
  userId,
  stream
) {

  let tile =
    document.querySelector(
      `[data-user-id="${CSS.escape(userId)}"]`
    );

  if (!tile) {

    tile =
      document.createElement(
        "div"
      );

    tile.className =
      "video-tile";

    tile.dataset.userId =
      userId;

    const video =
      document.createElement(
        "video"
      );

    video.autoplay = true;
    video.playsInline = true;

    tile.appendChild(video);

    const name =
      document.createElement(
        "div"
      );

    name.className =
      "video-name";

    const user =
      participants.find(
        (item) =>
          item.id === userId
      );

    name.textContent =
      user
        ? user.name
        : "Người tham gia";

    tile.appendChild(name);

    videos.appendChild(tile);
  }

  const video =
    tile.querySelector("video");

  if (
    video.srcObject !== stream
  ) {

    video.srcObject =
      stream;

  }
}

// ===============================
// XÓA VIDEO
// ===============================

function removeRemoteVideo(
  userId
) {

  const tile =
    document.querySelector(
      `[data-user-id="${CSS.escape(userId)}"]`
    );

  if (
    tile &&
    tile !== localTile
  ) {

    tile.remove();

  }

  if (
    peerConnections[userId]
  ) {

    peerConnections[userId]
      .close();

    delete peerConnections[
      userId
    ];

  }

  delete pendingCandidates[
    userId
  ];
}

// ===============================
// USER MỚI VÀO
// ===============================

socket.on(
  "user-joined",
  async (user) => {

    console.log(
      "User joined:",
      user
    );

    if (!user || !user.id) {
      return;
    }

    try {

      const pc =
        createPeerConnection(
          user.id
        );

      // Người đang có trong phòng
      // tạo offer cho người mới.

      const offer =
        await pc.createOffer();

      await pc.setLocalDescription(
        offer
      );

      socket.emit(
        "signal",
        {
          to: user.id,
          data: {
            type: "offer",
            offer:
              pc.localDescription
          }
        }
      );

    } catch (error) {

      console.error(
        "Offer error:",
        error
      );
    }
  }
);

// ===============================
// SIGNAL
// ===============================

socket.on(
  "signal",
  async ({ from, data }) => {

    if (!from || !data) {
      return;
    }

    try {

      const pc =
        createPeerConnection(
          from
        );

      // ---------------------------
      // OFFER
      // ---------------------------

      if (
        data.type === "offer"
      ) {

        await pc.setRemoteDescription(
          new RTCSessionDescription(
            data.offer
          )
        );

        const answer =
          await pc.createAnswer();

        await pc.setLocalDescription(
          answer
        );

        socket.emit(
          "signal",
          {
            to: from,
            data: {
              type: "answer",
              answer:
                pc.localDescription
            }
          }
        );

        await flushCandidates(
          from
        );

        return;
      }

      // ---------------------------
      // ANSWER
      // ---------------------------

      if (
        data.type === "answer"
      ) {

        await pc.setRemoteDescription(
          new RTCSessionDescription(
            data.answer
          )
        );

        await flushCandidates(
          from
        );

        return;
      }

      // ---------------------------
      // ICE CANDIDATE
      // ---------------------------

      if (
        data.type === "candidate"
      ) {

        const candidate =
          new RTCIceCandidate(
            data.candidate
          );

        if (
          pc.remoteDescription
        ) {

          await pc.addIceCandidate(
            candidate
          );

        } else {

          if (
            !pendingCandidates[from]
          ) {

            pendingCandidates[from] =
              [];

          }

          pendingCandidates[from]
            .push(candidate);

        }
      }

    } catch (error) {

      console.error(
        "WebRTC signal error:",
        error
      );
    }
  }
);

// ===============================
// ICE CHỜ
// ===============================

async function flushCandidates(
  remoteId
) {

  const pc =
    peerConnections[
      remoteId
    ];

  if (!pc) return;

  const list =
    pendingCandidates[
      remoteId
    ] || [];

  for (
    const candidate of list
  ) {

    try {

      await pc.addIceCandidate(
        candidate
      );

    } catch (error) {

      console.error(
        "ICE error:",
        error
      );

    }
  }

  pendingCandidates[
    remoteId
  ] = [];
}

// ===============================
// USER RỜI
// ===============================

socket.on(
  "user-left",
  ({ id }) => {

    if (!id) return;

    removeRemoteVideo(id);

  }
);

// ===============================
// MIC
// ===============================

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
        ? "Đã bật mic."
        : "Đã tắt mic."
    );
  }
);

// ===============================
// CAMERA
// ===============================

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
        ? "Đã bật camera."
        : "Đã tắt camera."
    );
  }
);

// ===============================
// ĐỔI CAMERA
// ===============================

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
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode:
                cameraFacing
            },
            audio: false
          });

      const newTrack =
        newStream.getVideoTracks()[0];

      const oldTrack =
        localStream.getVideoTracks()[0];

      if (oldTrack) {
        oldTrack.stop();
        localStream.removeTrack(
          oldTrack
        );
      }

      localStream.addTrack(
        newTrack
      );

      localVideo.srcObject =
        localStream;

      // Thay camera đang gửi
      // trong tất cả kết nối.

      for (
        const pc of Object.values(
          peerConnections
        )
      ) {

        const sender =
          pc.getSenders()
            .find(
              (item) =>
                item.track &&
                item.track.kind ===
                  "video"
            );

        if (sender) {

          await sender.replaceTrack(
            newTrack
          );
        }
      }

      showToast(
        cameraFacing ===
          "environment"
          ? "Đã chuyển sang camera sau."
          : "Đã chuyển sang camera trước."
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

// ===============================
// CHIA SẺ MÀN HÌNH
// ===============================

screenBtn.addEventListener(
  "click",
  async () => {

    if (screenStream) {

      stopScreenShare();

      return;
    }

    try {

      screenStream =
        await navigator.mediaDevices
          .getDisplayMedia({
            video: true,
            audio: false
          });

      const screenTrack =
        screenStream.getVideoTracks()[0];

      localVideo.srcObject =
        screenStream;

      for (
        const pc of Object.values(
          peerConnections
        )
      ) {

        const sender =
          pc.getSenders()
            .find(
              (item) =>
                item.track &&
                item.track.kind ===
                  "video"
            );

        if (sender) {

          await sender.replaceTrack(
            screenTrack
          );

        }
      }

      screenTrack.onended =
        () => {

          stopScreenShare();

        };

      screenBtn.firstChild.textContent =
        "⏹️ ";

      showToast(
        "Đang chia sẻ màn hình."
      );

    } catch (error) {

      console.error(error);

      screenStream = null;

      showToast(
        "Không thể chia sẻ màn hình."
      );
    }
  }
);

async function stopScreenShare() {

  if (!screenStream) {
    return;
  }

  screenStream
    .getTracks()
    .forEach(
      (track) =>
        track.stop()
    );

  screenStream = null;

  localVideo.srcObject =
    localStream;

  const cameraTrack =
    localStream &&
    localStream.getVideoTracks()[0];

  if (!cameraTrack) return;

  for (
    const pc of Object.values(
      peerConnections
    )
  ) {

    const sender =
      pc.getSenders()
        .find(
          (item) =>
            item.track &&
            item.track.kind ===
              "video"
        );

    if (sender) {

      await sender.replaceTrack(
        cameraTrack
      );

    }
  }

  screenBtn.firstChild.textContent =
    "🖥️ ";
}

// ===============================
// CHAT
// ===============================

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
        text
      }
    );

    chatInput.value = "";

  }
);

socket.on(
  "chat",
  ({ name, text }) => {

    const message =
      document.createElement(
        "div"
      );

    message.className =
      "msg";

    message.textContent =
      name + ": " + text;

    messages.appendChild(
      message
    );

    messages.scrollTop =
      messages.scrollHeight;
  }
);

// ===============================
// PANEL NGƯỜI THAM GIA
// ===============================

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

// ===============================
// CHỦ PHÒNG
// ===============================

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

// ===============================
// CHỦ PHÒNG GHIM
// ===============================

socket.on(
  "host-pin-changed",
  ({ pinned, hostId }) => {

    document
      .querySelectorAll(
        ".pinned-tile"
      )
      .forEach(
        (tile) => {

          tile.classList.remove(
            "pinned-tile"
          );

        }
      );

    document
      .querySelectorAll(
        ".pinned-badge"
      )
      .forEach(
        (badge) => {

          badge.classList.add(
            "hidden"
          );

        }
      );

    const hostTile =
      document.querySelector(
        `[data-user-id="${CSS.escape(hostId)}"]`
      );

    if (!hostTile) return;

    if (pinned) {

      hostTile.classList.add(
        "pinned-tile"
      );

      const badge =
        hostTile.querySelector(
          ".pinned-badge"
        );

      if (badge) {

        badge.classList.remove(
          "hidden"
        );

      } else {

        const newBadge =
          document.createElement(
            "div"
          );

        newBadge.className =
          "pinned-badge";

        newBadge.textContent =
          "📌 Đã ghim";

        hostTile.appendChild(
          newBadge
        );
      }

    }

  }
);

// ===============================
// TẮT MIC BẮT BUỘC
// ===============================

socket.on(
  "force-mute",
  () => {

    if (!localStream) return;

    const track =
      localStream.getAudioTracks()[0];

    if (track) {

      track.enabled = false;

    }

    micBtn.firstChild.textContent =
      "🔇 ";

    showToast(
      "Chủ phòng đã tắt mic của bạn."
    );
  }
);

// ===============================
// TẮT CAMERA BẮT BUỘC
// ===============================

socket.on(
  "force-camera-off",
  () => {

    if (!localStream) return;

    const track =
      localStream.getVideoTracks()[0];

    if (track) {

      track.enabled = false;

    }

    camBtn.firstChild.textContent =
      "🚫 ";

    showToast(
      "Chủ phòng đã tắt camera của bạn."
    );
  }
);

// ===============================
// MỞ MIC
// ===============================

socket.on(
  "unlock-mic",
  () => {

    showToast(
      "Chủ phòng đã cho phép bật mic."
    );

  }
);

// ===============================
// MỞ CAMERA
// ===============================

socket.on(
  "unlock-camera",
  () => {

    showToast(
      "Chủ phòng đã cho phép bật camera."
    );

  }
);

// ===============================
// KHÓA PHÒNG
// ===============================

socket.on(
  "room-lock-changed",
  ({ locked }) => {

    showToast(
      locked
        ? "🔒 Phòng đã được khóa."
        : "🔓 Phòng đã được mở khóa."
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

// ===============================
// ĐUỔI NGƯỜI
// ===============================

socket.on(
  "removed-from-room",
  () => {

    cleanupMeeting();

    showToast(
      "Bạn đã bị chủ phòng đưa ra khỏi phòng."
    );

  }
);

// ===============================
// LỖI PHÒNG
// ===============================

socket.on(
  "room-error",
  ({ message }) => {

    showToast(
      message ||
      "Không thể vào phòng."
    );

    joinBtn.disabled = false;

    joinBtn.textContent =
      "🚪 Tham gia cuộc họp";
  }
);

// ===============================
// KẾT THÚC CUỘC HỌP
// ===============================

socket.on(
  "meeting-ended",
  () => {

    cleanupMeeting();

    showToast(
      "Cuộc họp đã kết thúc."
    );

  }
);

// ===============================
// DỌN DẸP
// ===============================

function cleanupMeeting() {

  if (screenStream) {

    screenStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    screenStream = null;
  }

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    localStream = null;
  }

  Object.values(
    peerConnections
  ).forEach(
    (pc) => {

      try {
        pc.close();
      } catch {}

    }
  );

  Object.keys(
    peerConnections
  ).forEach(
    (key) => {

      delete peerConnections[key];

    }
  );

  Object.keys(
    pendingCandidates
  ).forEach(
    (key) => {

      delete pendingCandidates[key];

    }
  );

  document
    .querySelectorAll(
      ".video-tile:not(#localTile)"
    )
    .forEach(
      (tile) =>
        tile.remove()
    );

  localVideo.srcObject = null;

  meeting.classList.add(
    "hidden"
  );

  home.classList.remove(
    "hidden"
  );

  joinBtn.disabled = false;

  joinBtn.textContent =
    "🚪 Tham gia cuộc họp";

  createBtn.disabled = false;

  createBtn.textContent =
    "➕ Tạo cuộc họp mới";

  participantsPanel.classList.add(
    "hidden"
  );

  chatPanel.classList.add(
    "hidden"
  );

  roomId = null;

  isHost = false;
}

// ===============================
// RỜI PHÒNG
// ===============================

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

    if (isHost) {

      socket.emit(
        "end-meeting"
      );

    } else {

      socket.emit(
        "leave-room"
      );

      cleanupMeeting();

      showToast(
        "Bạn đã rời phòng."
      );

    }

  }
);

// ===============================
// SOCKET CONNECT
// ===============================

socket.on(
  "connect",
  () => {

    console.log(
      "VMeet connected:",
      socket.id
    );

  }
);

// ===============================
// SOCKET DISCONNECT
// ===============================

socket.on(
  "disconnect",
  () => {

    console.log(
      "VMeet disconnected"
    );

  }
);
