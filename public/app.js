const socket = io();

const $ = (id) => document.getElementById(id);

let name = "";
let room = "";
let stream = null;
let isHost = false;
let currentFacingMode = "user";

const peers = new Map();


// =========================
// TIỆN ÍCH
// =========================

function show(element) {
  element.classList.remove("hidden");
}

function hide(element) {
  element.classList.add("hidden");
}

function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  show(el);

  setTimeout(() => {
    hide(el);
  }, 2500);
}


// =========================
// TẠO PHÒNG
// =========================

$("create").onclick = async () => {

  name =
    $("name").value.trim() ||
    "Chủ phòng";

  room =
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

  isHost = true;

  socket.emit("create-room", {
    room,
    name
  });

};


// =========================
// THAM GIA PHÒNG
// =========================

$("join").onclick = () => {

  name =
    $("name").value.trim() ||
    "Khách";

  const roomId =
    $("room").value.trim();

  if (!roomId) {
    alert("Hãy nhập mã phòng.");
    return;
  }

  room = roomId.toUpperCase();

  isHost = false;

  socket.emit("request-join", {
    room,
    name
  });

};


// =========================
// PHÒNG ĐƯỢC TẠO
// =========================

socket.on("room-created", async () => {

  history.replaceState(
    {},
    "",
    "?room=" +
      encodeURIComponent(room)
  );

  await enterMeeting();

});


// =========================
// ĐANG CHỜ DUYỆT
// =========================

socket.on("waiting-approval", () => {

  hide($("home"));
  show($("waiting"));

});


// =========================
// ĐƯỢC CHỦ PHÒNG DUYỆT
// =========================

socket.on("approved", async () => {

  hide($("waiting"));

  await enterMeeting();

  toast("Bạn đã được duyệt vào phòng.");

});


// =========================
// BỊ TỪ CHỐI
// =========================

socket.on("rejected", ({ message }) => {

  alert(
    message ||
    "Yêu cầu tham gia đã bị từ chối."
  );

  location.href =
    location.pathname;

});


// =========================
// VÀO PHÒNG
// =========================

async function enterMeeting() {

  hide($("home"));
  hide($("waiting"));
  show($("meeting"));

  $("roomTitle").textContent =
    "Phòng: " + room;

  $("localName").textContent =
    name;

  if (isHost) {

    $("participantsBtn").style.display =
      "inline-block";

  }

  await startCamera();

  socket.emit("get-participants");

}


// =========================
// CAMERA + MICRO
// =========================

async function startCamera() {

  try {

    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {
          facingMode: {
            ideal: currentFacingMode
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
      "Không thể truy cập camera hoặc micro. Hãy cấp quyền cho Safari."
    );

  }

}


// =========================
// WEBRTC PEER
// =========================

function addPeer(id, peerName) {

  if (peers.has(id)) {
    return peers.get(id);
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
      .forEach(track => {

        pc.addTrack(
          track,
          stream
        );

      });

  }


  const tile =
    document.createElement("div");

  tile.className =
    "video-tile";

  tile.id =
    "peer-" + id;


  const video =
    document.createElement("video");

  video.autoplay = true;
  video.playsInline = true;


  const label =
    document.createElement("span");

  label.textContent =
    peerName;


  tile.appendChild(video);
  tile.appendChild(label);

  $("videos").appendChild(tile);


  pc.ontrack = event => {

    video.srcObject =
      event.streams[0];

  };


  pc.onicecandidate =
    event => {

      if (event.candidate) {

        socket.emit("signal", {

          to: id,

          data: {
            candidate:
              event.candidate
          }

        });

      }

    };


  peers.set(
    id,
    pc
  );

  return pc;

}


// =========================
// DANH SÁCH NGƯỜI THAM GIA
// =========================

socket.on(
  "participants",
  users => {

    renderParticipants(users);

  }
);


function renderParticipants(users) {

  const list =
    $("participantsList");

  list.innerHTML = "";


  users.forEach(user => {

    const item =
      document.createElement("div");

    item.className =
      "participant";


    const nameEl =
      document.createElement("span");

    nameEl.textContent =
      user.name +
      (user.id === socket.id
        ? " (Bạn)"
        : "");


    item.appendChild(nameEl);

    list.appendChild(item);

  });

}


// =========================
// YÊU CẦU THAM GIA
// =========================

socket.on(
  "join-request",
  ({ id, name }) => {

    if (!isHost) return;


    const list =
      $("requestsList");


    const item =
      document.createElement("div");

    item.className =
      "request";


    const nameEl =
      document.createElement("span");

    nameEl.textContent =
      name;


    const approve =
      document.createElement("button");

    approve.textContent =
      "✓ Duyệt";


    approve.onclick =
      () => {

        socket.emit(
          "approve-user",
          {
            userId: id
          }
        );

        item.remove();

      };


    const reject =
      document.createElement("button");

    reject.textContent =
      "✕ Từ chối";


    reject.onclick =
      () => {

        socket.emit(
          "reject-user",
          {
            userId: id
          }
        );

        item.remove();

      };


    item.appendChild(nameEl);
    item.appendChild(approve);
    item.appendChild(reject);


    list.appendChild(item);


    toast(
      name +
      " đang xin vào phòng."
    );

  }
);


// =========================
// WEBRTC: NGƯỜI ĐÃ CÓ
// =========================

socket.on(
  "existing-users",
  async users => {

    for (
      const user of users
    ) {

      if (
        user.id === socket.id
      ) {
        continue;
      }


      const pc =
        addPeer(
          user.id,
          user.name
        );


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
            sdp:
              pc.localDescription
          }

        }
      );

    }

  }
);


// =========================
// NGƯỜI MỚI
// =========================

socket.on(
  "user-joined",
  user => {

    addPeer(
      user.id,
      user.name
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
        addPeer(
          from,
          "Người tham gia"
        );

    }


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

      try {

        await pc.addIceCandidate(
          data.candidate
        );

      }

      catch (error) {

        console.error(error);

      }

    }

  }
);


// =========================
// NGƯỜI RỜI
// =========================

socket.on(
  "user-left",
  ({ id }) => {

    const pc =
      peers.get(id);

    if (pc) {
      pc.close();
    }

    peers.delete(id);


    const tile =
      $("peer-" + id);

    if (tile) {
      tile.remove();
    }

  }
);


// =========================
// MICRO
// =========================

$("mic").onclick = () => {

  const track =
    stream?.getAudioTracks()[0];

  if (!track) return;


  track.enabled =
    !track.enabled;


  $("mic").textContent =
    track.enabled
      ? "🎤 Mic"
      : "🔇 Mic tắt";

};


// =========================
// CAMERA
// =========================

$("cam").onclick = () => {

  const track =
    stream?.getVideoTracks()[0];

  if (!track) return;


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

    if (!stream) return;


    const newMode =
      currentFacingMode ===
      "user"
        ? "environment"
        : "user";


    try {

      const newStream =
        await navigator.mediaDevices
          .getUserMedia({

            video: {
              facingMode: {
                exact: newMode
              }
            },

            audio: false

          });


      const newTrack =
        newStream.getVideoTracks()[0];


      for (
        const pc of peers.values()
      ) {

        const sender =
          pc.getSenders().find(
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


      currentFacingMode =
        newMode;


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


      const track =
        screenStream.getVideoTracks()[0];


      for (
        const pc of peers.values()
      ) {

        const sender =
          pc.getSenders().find(
            s =>
              s.track &&
              s.track.kind ===
                "video"
          );


        if (sender) {

          await sender.replaceTrack(
            track
          );

        }

      }


      $("localVideo").srcObject =
        new MediaStream([

          track,

          ...stream.getAudioTracks()

        ]);


      track.onended =
        () => {

          location.reload();

        };

    }

    catch (error) {

      console.error(error);

    }

  };


// =========================
// SAO CHÉP LINK
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


      setTimeout(() => {

        $("copy").textContent =
          "🔗 Mời";

      }, 1500);

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


    if (!text) return;


    socket.emit(
      "chat",
      {
        room,
        name,
        text
      }
    );


    input.value = "";

  };


socket.on(
  "chat",
  message => {

    const div =
      document.createElement("div");

    div.className =
      "msg";


    const nameEl =
      document.createElement("b");

    nameEl.textContent =
      message.name;


    const textEl =
      document.createElement("span");

    textEl.textContent =
      message.text;


    div.appendChild(nameEl);
    div.appendChild(textEl);


    $("messages")
      .appendChild(div);


    $("messages").scrollTop =
      $("messages").scrollHeight;

  }
);


// =========================
// HỦY CHỜ
// =========================

$("cancelWaiting").onclick =
  () => {

    socket.disconnect();

    location.href =
      location.pathname;

  };


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
// RỜI PHÒNG
// =========================

$("leave").onclick =
  () => {

    socket.emit(
      "leave-room"
    );


    if (stream) {

      stream
        .getTracks()
        .forEach(track => {
          track.stop();
        });

    }


    location.href =
      location.pathname;

  };


// =========================
// LỖI PHÒNG
// =========================

socket.on(
  "room-error",
  ({ message }) => {

    alert(message);

  }
);
