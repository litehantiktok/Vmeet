const socket = io();

const $ = (id) => document.getElementById(id);

let name = "";
let room = "";
let stream = null;
let currentFacingMode = "user";

const peers = new Map();


// =========================
// TẠO / THAM GIA PHÒNG
// =========================

function openMeeting(roomId) {

  room = roomId;

  name =
    $("name").value.trim() ||
    "Khách";

  $("home").classList.add("hidden");
  $("meeting").classList.remove("hidden");

  $("roomTitle").textContent =
    "Phòng: " + room;

  $("localName").textContent =
    name;

  history.replaceState(
    {},
    "",
    "?room=" +
      encodeURIComponent(room)
  );

  startMeeting();
}


// Tạo phòng mới
$("create").onclick = () => {

  const newRoom =
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

  openMeeting(newRoom);
};


// Tham gia phòng
$("join").onclick = () => {

  const roomId =
    $("room").value.trim();

  if (roomId) {
    openMeeting(roomId);
  }

};


// Nếu link có sẵn mã phòng
const urlRoom =
  new URLSearchParams(
    location.search
  ).get("room");

if (urlRoom) {

  $("room").value =
    urlRoom;

}


// =========================
// CAMERA + MICRO
// =========================

async function startMeeting() {

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

    socket.emit(
      "join-room",
      {
        room,
        name
      }
    );

  }

  catch (error) {

    console.error(error);

    alert(
      "Không thể truy cập camera hoặc micro. Hãy cho phép Safari sử dụng camera và micro."
    );

  }

}


// =========================
// TẠO KẾT NỐI VỚI NGƯỜI KHÁC
// =========================

function addPeer(
  id,
  peerName
) {

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


  // Gửi camera + mic của mình
  if (stream) {

    stream
      .getTracks()
      .forEach((track) => {

        pc.addTrack(
          track,
          stream
        );

      });

  }


  // Tạo ô video
  const tile =
    document.createElement(
      "div"
    );

  tile.className =
    "video-tile";

  tile.id =
    "peer-" + id;


  const video =
    document.createElement(
      "video"
    );

  video.autoplay = true;
  video.playsInline = true;


  const label =
    document.createElement(
      "span"
    );

  label.textContent =
    peerName;


  tile.appendChild(video);
  tile.appendChild(label);

  $("videos")
    .appendChild(tile);


  // Nhận video người khác
  pc.ontrack = (event) => {

    video.srcObject =
      event.streams[0];

  };


  // ICE candidate
  pc.onicecandidate =
    (event) => {

      if (
        event.candidate
      ) {

        socket.emit(
          "signal",
          {

            to: id,

            data: {
              candidate:
                event.candidate
            }

          }
        );

      }

    };


  peers.set(
    id,
    pc
  );

  return pc;

}


// =========================
// NGƯỜI ĐÃ CÓ TRONG PHÒNG
// =========================

socket.on(
  "existing-users",
  async (users) => {

    for (
      const user of users
    ) {

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


// Người mới vào
socket.on(
  "user-joined",
  (user) => {

    addPeer(
      user.id,
      user.name
    );

  }
);


// =========================
// XỬ LÝ VIDEO CALL
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


    // SDP
    if (data.sdp) {

      await pc.setRemoteDescription(
        data.sdp
      );


      // Nhận offer
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


    // ICE
    else if (
      data.candidate
    ) {

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
// NGƯỜI RỜI PHÒNG
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
// BẬT / TẮT MICRO
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
// BẬT / TẮT CAMERA
// =========================

$("cam").onclick = async () => {

  if (!stream) {
    return;
  }


  const track =
    stream.getVideoTracks()[0];


  if (!track) {

    await startCamera(
      currentFacingMode
    );

    return;

  }


  track.enabled =
    !track.enabled;


  $("cam").textContent =
    track.enabled
      ? "📷 Camera"
      : "🚫 Camera tắt";

};


// =========================
// ĐỔI CAMERA TRƯỚC / SAU
// =========================

$("switchCamera").onclick =
  async () => {

    if (!stream) {
      return;
    }


    const newFacingMode =
      currentFacingMode ===
      "user"
        ? "environment"
        : "user";


    await switchCamera(
      newFacingMode
    );

  };


// Đổi camera
async function switchCamera(
  facingMode
) {

  try {

    const newStream =
      await navigator.mediaDevices.getUserMedia({

        video: {
          facingMode: {
            exact:
              facingMode
          }
        },

        audio: false

      });


    const newVideoTrack =
      newStream.getVideoTracks()[0];


    // Thay camera trong kết nối
    for (
      const pc of peers.values()
    ) {

      const sender =
        pc.getSenders().find(
          (s) =>
            s.track &&
            s.track.kind ===
              "video"
        );


      if (sender) {

        await sender.replaceTrack(
          newVideoTrack
        );

      }

    }


    // Camera cũ
    const oldTrack =
      stream.getVideoTracks()[0];


    if (oldTrack) {
      oldTrack.stop();
    }


    // Giữ lại micro
    const audioTracks =
      stream.getAudioTracks();


    stream =
      new MediaStream([

        newVideoTrack,

        ...audioTracks

      ]);


    $("localVideo").srcObject =
      stream;


    currentFacingMode =
      facingMode;


    $("cam").textContent =
      "📷 Camera";


  }

  catch (error) {

    console.error(error);

    alert(
      "Không thể đổi camera trên thiết bị này."
    );

  }

}


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
        screenStream.getVideoTracks()[0];


      for (
        const pc of peers.values()
      ) {

        const sender =
          pc.getSenders().find(
            (s) =>
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
// SAO CHÉP LINK MỜI
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
// CHAT / BÌNH LUẬN
// =========================

$("chatForm").onsubmit =
  (event) => {

    event.preventDefault();


    const input =
      $("chatInput");


    const text =
      input.value.trim();


    if (!text) {
      return;
    }


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


// Nhận tin nhắn
socket.on(
  "chat",
  (message) => {

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "msg";


    const nameElement =
      document.createElement(
        "b"
      );

    nameElement.textContent =
      message.name;


    const textElement =
      document.createElement(
        "span"
      );

    textElement.textContent =
      message.text;


    div.appendChild(
      nameElement
    );

    div.appendChild(
      textElement
    );


    $("messages")
      .appendChild(div);


    $("messages").scrollTop =
      $("messages").scrollHeight;

  }
);


// =========================
// RỜI PHÒNG
// =========================

$("leave").onclick =
  () => {

    if (stream) {

      stream
        .getTracks()
        .forEach(
          (track) => {
            track.stop();
          }
        );

    }


    location.href =
      location.pathname;

  };
