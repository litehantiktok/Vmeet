const socket = io();

const $ = (id) => document.getElementById(id);

let name = "";
let room = "";
let stream = null;

const peers = new Map();

function openMeeting(roomId) {
  room = roomId;
  name = $("name").value.trim() || "Khách";

  $("home").classList.add("hidden");
  $("meeting").classList.remove("hidden");

  $("roomTitle").textContent = "Phòng: " + room;
  $("localName").textContent = name;

  history.replaceState(
    {},
    "",
    "?room=" + encodeURIComponent(room)
  );

  startMeeting();
}

$("create").onclick = () => {
  const newRoom =
    Math.random().toString(36).substring(2, 8).toUpperCase();

  openMeeting(newRoom);
};

$("join").onclick = () => {
  const roomId = $("room").value.trim();

  if (roomId) {
    openMeeting(roomId);
  }
};

const urlRoom = new URLSearchParams(location.search).get("room");

if (urlRoom) {
  $("room").value = urlRoom;
}

async function startMeeting() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    $("localVideo").srcObject = stream;

    socket.emit("join-room", {
      room,
      name
    });

  } catch (error) {
    alert(
      "Không thể truy cập camera/micro. Hãy cấp quyền cho trình duyệt."
    );
  }
}

function addPeer(id, peerName) {

  if (peers.has(id)) {
    return peers.get(id);
  }

  const pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  });

  if (stream) {
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }

  const tile = document.createElement("div");

  tile.className = "video-tile";
  tile.id = "peer-" + id;

  const video = document.createElement("video");

  video.autoplay = true;
  video.playsInline = true;

  const label = document.createElement("span");

  label.textContent = peerName;

  tile.appendChild(video);
  tile.appendChild(label);

  $("videos").appendChild(tile);

  pc.ontrack = (event) => {
    video.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {

    if (event.candidate) {

      socket.emit("signal", {
        to: id,
        data: {
          candidate: event.candidate
        }
      });

    }
  };

  peers.set(id, pc);

  return pc;
}

socket.on("existing-users", async (users) => {

  for (const user of users) {

    const pc = addPeer(
      user.id,
      user.name
    );

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    socket.emit("signal", {
      to: user.id,
      data: {
        sdp: pc.localDescription
      }
    });

  }

});

socket.on("user-joined", (user) => {

  addPeer(
    user.id,
    user.name
  );

});

socket.on("signal", async ({ from, data }) => {

  let pc = peers.get(from);

  if (!pc) {

    pc = addPeer(
      from,
      "Người tham gia"
    );

  }

  if (data.sdp) {

    await pc.setRemoteDescription(data.sdp);

    if (data.sdp.type === "offer") {

      const answer = await pc.createAnswer();

      await pc.setLocalDescription(answer);

      socket.emit("signal", {
        to: from,
        data: {
          sdp: pc.localDescription
        }
      });

    }

  }

  else if (data.candidate) {

    try {

      await pc.addIceCandidate(
        data.candidate
      );

    } catch (error) {

      console.log(error);

    }

  }

});

socket.on("user-left", ({ id }) => {

  const pc = peers.get(id);

  if (pc) {
    pc.close();
  }

  peers.delete(id);

  const tile = $("peer-" + id);

  if (tile) {
    tile.remove();
  }

});

$("mic").onclick = () => {

  const track =
    stream?.getAudioTracks()[0];

  if (!track) return;

  track.enabled = !track.enabled;

  $("mic").textContent =
    track.enabled
      ? "🎤 Mic"
      : "🔇 Mic tắt";

};

$("cam").onclick = () => {

  const track =
    stream?.getVideoTracks()[0];

  if (!track) return;

  track.enabled = !track.enabled;

  $("cam").textContent =
    track.enabled
      ? "📷 Camera"
      : "🚫 Camera tắt";

};

$("screen").onclick = async () => {

  try {

    const screenStream =
      await navigator.mediaDevices.getDisplayMedia({
        video: true
      });

    const screenTrack =
      screenStream.getVideoTracks()[0];

    for (const pc of peers.values()) {

      const sender =
        pc.getSenders().find(
          (s) =>
            s.track &&
            s.track.kind === "video"
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

    screenTrack.onended = () => {

      location.reload();

    };

  } catch (error) {

    console.log(error);

  }

};

$("copy").onclick = async () => {

  try {

    await navigator.clipboard.writeText(
      location.href
    );

    $("copy").textContent =
      "✓ Đã sao chép";

    setTimeout(() => {

      $("copy").textContent =
        "🔗 Mời";

    }, 1500);

  } catch (error) {

    alert(
      "Không thể sao chép link."
    );

  }

};

$("chatForm").onsubmit = (event) => {

  event.preventDefault();

  const input = $("chatInput");

  const text = input.value.trim();

  if (!text) return;

  socket.emit("chat", {
    room,
    name,
    text
  });

  input.value = "";

};

socket.on("chat", (message) => {

  const div =
    document.createElement("div");

  div.className = "msg";

  const nameElement =
    document.createElement("b");

  nameElement.textContent =
    message.name;

  const textElement =
    document.createElement("span");

  textElement.textContent =
    message.text;

  div.appendChild(nameElement);
  div.appendChild(textElement);

  $("messages").appendChild(div);

  $("messages").scrollTop =
    $("messages").scrollHeight;

});

$("leave").onclick = () => {

  if (stream) {

    stream
      .getTracks()
      .forEach((track) => {
        track.stop();
      });

  }

  location.href =
    location.pathname;

};
