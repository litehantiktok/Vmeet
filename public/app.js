const socket = io();

const $ = (id) => document.getElementById(id);

let name = "";
let room = "";
let stream = null;
let isHost = false;
let facingMode = "user";

const peers = new Map();


// =========================
// KHỞI ĐỘNG
// =========================

const params = new URLSearchParams(
  window.location.search
);

const roomFromLink =
  params.get("room");


// Nếu link có phòng
if (roomFromLink) {

  room =
    roomFromLink.toUpperCase();

  $("joinInfo").classList.remove(
    "hidden"
  );

  $("join").classList.remove(
    "hidden"
  );

  $("create").classList.add(
    "hidden"
  );

}


// =========================
// TẠO PHÒNG
// =========================

$("create").onclick =
  async () => {

    name =
      $("name").value.trim();

    if (!name) {

      alert(
        "Vui lòng nhập tên của bạn."
      );

      return;

    }


    room =
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();


    isHost = true;


    socket.emit(
      "join-room",
      {

        room,

        name,

        create: true

      }
    );

  };


// =========================
// THAM GIA BẰNG LINK
// =========================

$("join").onclick =
  async () => {

    name =
      $("name").value.trim();

    if (!name) {

      alert(
        "Vui lòng nhập tên của bạn."
      );

      return;

    }


    socket.emit(
      "join-room",
      {

        room,

        name,

        create: false

      }
    );

  };


// =========================
// ĐÃ VÀO PHÒNG
// =========================

socket.on(
  "room-joined",
  async ({
    room: joinedRoom,
    isHost: host
  }) => {

    room =
      joinedRoom;

    isHost =
      host;


    // URL phòng
    history.replaceState(
      {},
      "",
      "?room=" +
      encodeURIComponent(room)
    );


    hide(
      $("home")
    );

    show(
      $("meeting")
    );


    $("roomTitle").textContent =
      "Phòng: " + room;


    $("localName").textContent =
      name;


    // Hiện điều khiển host
    if (isHost) {

      show(
        $("hostControls")
      );

    }


    await startCamera();

  }
);


// =========================
// CAMERA + MIC
// =========================

async function startCamera() {

  try {

    stream =
      await navigator.mediaDevices
        .getUserMedia({

          video: {
            facingMode: {
              ideal: facingMode
            }
          },

          audio: true

        });


    $("localVideo").srcObject =
      stream;

  }

  catch (error) {

    console.error(error);

    alert(
      "Không thể mở camera hoặc micro. Hãy cho phép quyền Camera và Micro."
    );

  }

}


// =========================
// THÊM NGƯỜI
// =========================

function createPeer(
  userId,
  userName,
  initiator
) {

  if (peers.has(userId)) {

    return peers.get(userId);

  }


  const pc =
    new RTCPeerConnection({

      iceServers: [

        {
          urls:
            "stun:stun.l.google.com:19302"
        }

      ]

    });


  if (stream) {

    stream
      .getTracks()
      .forEach(
        track => {

          pc.addTrack(
            track,
            stream
          );

        }
      );

  }


  const tile =
    document.createElement(
      "div"
    );

  tile.className =
    "video-tile";

  tile.id =
    "peer-" + userId;


  const video =
    document.createElement(
      "video"
    );

  video.autoplay =
    true;

  video.playsInline =
    true;


  const label =
    document.createElement(
      "span"
    );

  label.textContent =
    userName;


  tile.appendChild(
    video
  );

  tile.appendChild(
    label
  );


  $("videos").appendChild(
    tile
  );


  pc.ontrack =
    event => {

      video.srcObject =
        event.streams[0];

    };


  pc.onicecandidate =
    event => {

      if (!event.candidate)
        return;


      socket.emit(
        "signal",
        {

          to: userId,

          data: {
            candidate:
              event.candidate
          }

        }
      );

    };


  peers.set(
    userId,
    pc
  );


  if (initiator) {

    createOffer(
      userId,
      pc
    );

  }


  return pc;

}


// =========================
// TẠO OFFER
// =========================

async function createOffer(
  userId,
  pc
) {

  try {

    const offer =
      await pc.createOffer();


    await pc.setLocalDescription(
      offer
    );


    socket.emit(
      "signal",
      {

        to: userId,

        data: {
          sdp:
            pc.localDescription
        }

      }
    );

  }

  catch (error) {

    console.error(error);

  }

}


// =========================
// DANH SÁCH NGƯỜI
// =========================

socket.on(
  "participants",
  users => {

    renderParticipants(
      users
    );


    users.forEach(
      user => {

        if (
          user.id ===
          socket.id
        ) {
          return;
        }


        if (
          !peers.has(
            user.id
          )
        ) {

          // ID socket nhỏ hơn làm initiator
          const initiator =
            socket.id <
            user.id;


          createPeer(
            user.id,
            user.name,
            initiator
          );

        }

      }
    );

  }
);


// =========================
// NGƯỜI MỚI
// =========================

socket.on(
  "user-joined",
  user => {

    if (
      user.id ===
      socket.id
    ) {
      return;
    }


    const initiator =
      socket.id <
      user.id;


    createPeer(
      user.id,
      user.name,
      initiator
    );

  }
);


// =========================
// WEBRTC SIGNAL
// =========================

socket.on(
  "signal",
  async ({
    from,
    data
  }) => {

    let pc =
      peers.get(from);


    if (!pc) {

      pc =
        createPeer(
          from,
          "Người tham gia",
          false
        );

    }


    try {

      if (data.sdp) {

        await pc.setRemoteDescription(
          data.sdp
        );


        if (
          data.sdp.type ===
          "offer"
        ) {

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
                sdp:
                  pc.localDescription
              }

            }
          );

        }

      }


      if (data.candidate) {

        await pc.addIceCandidate(
          data.candidate
        );

      }

    }

    catch (error) {

      console.error(
        "WebRTC error:",
        error
      );

    }

  }
);


// =========================
// NGƯỜI RỜI
// =========================

socket.on(
  "user-left",
  ({ id }) => {

    removePeer(
      id
    );

  }
);


function removePeer(id) {

  const pc =
    peers.get(id);


  if (pc) {

    pc.close();

    peers.delete(id);

  }


  const tile =
    $("peer-" + id);


  if (tile) {

    tile.remove();

  }

}


// =========================
// MIC CỦA BẠN
// =========================

$("mic").onclick =
  () => {

    const track =
      stream?.getAudioTracks()[0];


    if (!track)
      return;


    track.enabled =
      !track.enabled;


    $("mic").textContent =
      track.enabled
        ? "🎤 Mic"
        : "🔇 Mic tắt";

  };


// =========================
// CAMERA CỦA BẠN
// =========================

$("cam").onclick =
  () => {

    const track =
      stream?.getVideoTracks()[0];


    if (!track)
      return;


    track.enabled =
      !track.enabled;


    $("cam").textContent =
      track.enabled
        ? "📷 Camera"
        : "🚫 Camera tắt";

  };


// =========================
// ĐỔI CAMERA
// =========================

$("switchCamera").onclick =
  async () => {

    if (!stream)
      return;


    const newFacing =
      facingMode ===
      "user"
        ? "environment"
        : "user";


    try {

      const newStream =
        await navigator.mediaDevices
          .getUserMedia({

            video: {
              facingMode: {
                exact:
                  newFacing
              }
            },

            audio: false

          });


      const newTrack =
        newStream
          .getVideoTracks()[0];


      for (
        const pc
        of peers.values()
      ) {

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


      const oldTrack =
        stream.getVideoTracks()[0];


      if (oldTrack) {

        oldTrack.stop();

      }


      stream =
        new MediaStream([

          newTrack,

          ...stream.getAudioTracks()

        ]);


      $("localVideo").srcObject =
        stream;


      facingMode =
        newFacing;

    }

    catch (error) {

      console.error(error);

      alert(
        "Không thể đổi camera."
      );

    }

  };


// =========================
// CHIA SẺ MÀN HÌNH
// =========================

$("screen").onclick =
  async () => {

    try {

      const screenStream =
        await navigator.mediaDevices
          .getDisplayMedia({

            video: true

          });


      const screenTrack =
        screenStream
          .getVideoTracks()[0];


      for (
        const pc
        of peers.values()
      ) {

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


      $("localVideo").srcObject =
        new MediaStream([

          screenTrack,

          ...stream.getAudioTracks()

        ]);


      screenTrack.onended =
        () => {

          location.reload();

        };

    }

    catch (error) {

      console.error(error);

    }

  };


// =========================
// COPY LINK
// =========================

$("copy").onclick =
  async () => {

    try {

      await navigator.clipboard
        .writeText(
          location.href
        );


      $("copy").textContent =
        "✓ Đã sao chép";


      setTimeout(
        () => {

          $("copy").textContent =
            "🔗 Mời";

        },
        1500
      );

    }

    catch (error) {

      alert(
        "Không thể sao chép link."
      );

    }

  };


// =========================
// PANEL NGƯỜI THAM GIA
// =========================

$("participantsBtn").onclick =
  () => {

    show(
      $("participantsPanel")
    );

  };


$("closeParticipants").onclick =
  () => {

    hide(
      $("participantsPanel")
    );

  };


// =========================
// HIỂN THỊ NGƯỜI
// =========================

function renderParticipants(
  users
) {

  const list =
    $("participantsList");


  list.innerHTML =
    "";


  users.forEach(
    user => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "participant";


      const nameEl =
        document.createElement(
          "span"
        );

      nameEl.textContent =
        user.name +
        (
          user.isHost
            ? " 👑"
            : ""
        );


      item.appendChild(
        nameEl
      );


      // Các nút quản lý chỉ hiện cho host
      if (
        isHost &&
        user.id !==
          socket.id
      ) {

        const mute =
          document.createElement(
            "button"
          );

        mute.textContent =
          user.micLocked
            ? "🔓 Mic"
            : "🔇 Mic";


        mute.onclick =
          () => {

            socket.emit(
              user.micLocked
                ? "host-unlock-mic"
                : "host-mute-user",
              {
                userId:
                  user.id
              }
            );

          };


        const camera =
          document.createElement(
            "button"
          );

        camera.textContent =
          user.cameraLocked
            ? "🔓 Cam"
            : "📷 Cam";


        camera.onclick =
          () => {

            socket.emit(
              user.cameraLocked
                ? "host-unlock-camera"
                : "host-camera-off",
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

            if (
              confirm(
                "Mời người này ra khỏi phòng?"
              )
            ) {

              socket.emit(
                "host-remove-user",
                {
                  userId:
                    user.id
                }
              );

            }

          };


        item.appendChild(
          mute
        );

        item.appendChild(
          camera
        );

        item.appendChild(
          remove
        );

      }


      list.appendChild(
        item
      );

    }
  );

}


// =========================
// HOST: TẮT MIC TẤT CẢ
// =========================

$("muteAll").onclick =
  () => {

    socket.emit(
      "host-mute-all"
    );

  };


// =========================
// HOST: TẮT CAMERA TẤT CẢ
// =========================

$("cameraOffAll").onclick =
  () => {

    socket.emit(
      "host-camera-off-all"
    );

  };


// =========================
// HOST: MỞ MIC
// =========================

$("unlockAllMic").onclick =
  () => {

    socket.emit(
      "host-unlock-all-mic"
    );

  };


// =========================
// HOST: MỞ CAMERA
// =========================

$("unlockAllCamera").onclick =
  () => {

    socket.emit(
      "host-unlock-all-camera"
    );

  };


// =========================
// HOST: KHÓA PHÒNG
// =========================

$("lockRoom").onclick =
  () => {

    socket.emit(
      "host-toggle-lock"
    );

  };


// =========================
// BỊ TẮT MIC
// =========================

socket.on(
  "force-mute",
  ({ locked }) => {

    const track =
      stream?.getAudioTracks()[0];


    if (!track)
      return;


    track.enabled =
      false;


    $("mic").textContent =
      locked
        ? "🔒 Mic bị khóa"
        : "🔇 Mic tắt";

  }
);


// =========================
// MỞ KHÓA MIC
// =========================

socket.on(
  "unlock-mic",
  () => {

    $("mic").textContent =
      "🎤 Mic";

  }
);


// =========================
// BỊ TẮT CAMERA
// =========================

socket.on(
  "force-camera-off",
  ({ locked }) => {

    const track =
      stream?.getVideoTracks()[0];


    if (!track)
      return;


    track.enabled =
      false;


    $("cam").textContent =
      locked
        ? "🔒 Camera bị khóa"
        : "🚫 Camera tắt";

  }
);


// =========================
// MỞ KHÓA CAMERA
// =========================

socket.on(
  "unlock-camera",
  () => {

    $("cam").textContent =
      "📷 Camera";

  }
);


// =========================
// BỊ ĐUỔI
// =========================

socket.on(
  "removed-from-room",
  () => {

    if (stream) {

      stream
        .getTracks()
        .forEach(
          track => track.stop()
        );

    }


    alert(
      "Bạn đã được chủ phòng mời ra."
    );


    location.href =
      location.pathname;

  }
);


// =========================
// KHÓA PHÒNG
// =========================

socket.on(
  "room-lock-changed",
  ({ locked }) => {

    $("lockRoom").textContent =
      locked
        ? "🔓 Mở khóa phòng"
        : "🔒 Khóa phòng";


    toast(
      locked
        ? "Đã khóa phòng."
        : "Đã mở khóa phòng."
    );

  }
);


// =========================
// PHÒNG ĐÓNG
// =========================

socket.on(
  "room-closed",
  () => {

    alert(
      "Chủ phòng đã đóng cuộc họp."
    );


    location.href =
      location.pathname;

  }
);


// =========================
// CHAT
// =========================

$("chatBtn").onclick =
  () => {

    show(
      $("chatPanel")
    );

  };


$("closeChat").onclick =
  () => {

    hide(
      $("chatPanel")
    );

  };


$("chatForm").onsubmit =
  event => {

    event.preventDefault();


    const input =
      $("chatInput");


    const text =
      input.value.trim();


    if (!text)
      return;


    socket.emit(
      "chat",
      {
        text
      }
    );


    input.value =
      "";

  };


socket.on(
  "chat",
  message => {

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "msg";


    const nameEl =
      document.createElement(
        "b"
      );

    nameEl.textContent =
      message.name +
      ": ";


    const textEl =
      document.createElement(
        "span"
      );

    textEl.textContent =
      message.text;


    div.appendChild(
      nameEl
    );

    div.appendChild(
      textEl
    );


    $("messages")
      .appendChild(div);


    $("messages").scrollTop =
      $("messages").scrollHeight;

  }
);


// =========================
// PHÒNG LỖI
// =========================

socket.on(
  "room-error",
  ({ message }) => {

    alert(message);

  }
);


socket.on(
  "room-locked",
  ({ message }) => {

    alert(message);

  }
);


// =========================
// TOAST
// =========================

function toast(
  message
) {

  const el =
    $("toast");


  el.textContent =
    message;


  show(el);


  setTimeout(
    () => {

      hide(el);

    },
    2500
  );

}


// =========================
// SHOW / HIDE
// =========================

function show(
  element
) {

  element.classList.remove(
    "hidden"
  );

}


function hide(
  element
) {

  element.classList.add(
    "hidden"
  );

}
