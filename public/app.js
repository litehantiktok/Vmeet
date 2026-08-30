const socket=io();
const $=id=>document.getElementById(id);

const home=$("home"),meeting=$("meeting"),nameInput=$("name"),createBtn=$("create"),joinBtn=$("join"),joinInfo=$("joinInfo");
const prejoin=$("prejoin"),previewVideo=$("previewVideo"),previewMic=$("previewMic"),previewCam=$("previewCam"),previewCameraOff=$("previewCameraOff"),previewName=$("previewName"),enterMeeting=$("enterMeeting"),cancelPrejoin=$("cancelPrejoin");
const localVideo=$("localVideo"),localTile=$("localTile"),localName=$("localName"),localHostBadge=$("localHostBadge"),localCameraOff=$("localCameraOff"),roomTitle=$("roomTitle");
const guestSection=$("guestSection"),guestGrid=$("guestGrid"),guestPageInfo=$("guestPageInfo"),guestPrev=$("guestPrev"),guestNext=$("guestNext");
const micBtn=$("mic"),camBtn=$("cam"),switchCameraBtn=$("switchCamera"),screenBtn=$("screen"),leaveBtn=$("leave"),copyBtn=$("copy");
const participantsBtn=$("participantsBtn"),participantsPanel=$("participantsPanel"),closeParticipants=$("closeParticipants"),participantsList=$("participantsList");
const hostControls=$("hostControls"),pinHost=$("pinHost"),muteAll=$("muteAll"),cameraOffAll=$("cameraOffAll"),unlockAllMic=$("unlockAllMic"),unlockAllCamera=$("unlockAllCamera"),lockRoom=$("lockRoom");
const chatBtn=$("chatBtn"),chatPanel=$("chatPanel"),closeChat=$("closeChat"),chatForm=$("chatForm"),chatInput=$("chatInput"),messages=$("messages"),toast=$("toast");

let localStream=null,screenStream=null,roomId=null,myName="",isHost=false,cameraFacing="user",participants=[];
let previewReady=false,enteringRoom=false,pinnedForAll=false,pinnedHostId=null,guestPage=0;
const GUESTS_PER_PAGE=8;
const peerConnections={},pendingCandidates={};

const configuration={iceServers:[
 {urls:"stun:stun.l.google.com:19302"},
 {urls:"stun:stun1.l.google.com:19302"}
]};

function showToast(message){
 if(!toast)return;
 toast.textContent=message;toast.classList.remove("hidden");
 clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.add("hidden"),2500);
}

async function startPreview(){
 if(!navigator.mediaDevices?.getUserMedia){showToast("Trình duyệt không hỗ trợ camera.");return false}
 if(!myName){showToast("Vui lòng nhập tên của bạn.");nameInput.focus();return false}
 try{
  if(!localStream)localStream=await navigator.mediaDevices.getUserMedia({
   video:{facingMode:cameraFacing,width:{ideal:1280},height:{ideal:720}},audio:true
  });
  previewVideo.srcObject=localStream;previewName.textContent=myName;prejoin.classList.remove("hidden");
  updatePreviewButtons();previewReady=true;return true;
 }catch(e){console.error(e);showToast("Không thể mở camera hoặc mic.");return false}
}

function updatePreviewButtons(){
 if(!localStream)return;
 const a=localStream.getAudioTracks()[0],v=localStream.getVideoTracks()[0];
 const ae=a?a.enabled:false,ve=v?v.enabled:false;
 previewMic.classList.toggle("active",ae);previewMic.innerHTML=ae?"🎤<span>Mic</span>":"🔇<span>Mic</span>";
 previewCam.classList.toggle("active",ve);previewCam.innerHTML=ve?"📷<span>Camera</span>":"🚫<span>Camera</span>";
 previewCameraOff.classList.toggle("hidden",ve);
}

previewMic.onclick=()=>{const t=localStream?.getAudioTracks()[0];if(t){t.enabled=!t.enabled;updatePreviewButtons()}};
previewCam.onclick=()=>{const t=localStream?.getVideoTracks()[0];if(t){t.enabled=!t.enabled;updatePreviewButtons()}};
cancelPrejoin.onclick=()=>{prejoin.classList.add("hidden")};

async function switchPreviewCamera(){
 if(!localStream)return;
 const oldFacing=cameraFacing;cameraFacing=cameraFacing==="user"?"environment":"user";
 try{
  const ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:cameraFacing},audio:false});
  const nt=ns.getVideoTracks()[0],ot=localStream.getVideoTracks()[0];
  if(ot){ot.stop();localStream.removeTrack(ot)} localStream.addTrack(nt);previewVideo.srcObject=localStream;updatePreviewButtons();
 }catch(e){cameraFacing=oldFacing;showToast("Không thể đổi camera.")}
}

async function beginCreate(){
 myName=nameInput.value.trim();if(!myName){showToast("Vui lòng nhập tên của bạn.");nameInput.focus();return}
 if(!previewReady){createBtn.disabled=true;createBtn.textContent="Đang mở camera...";const ok=await startPreview();createBtn.disabled=false;if(!ok){createBtn.textContent="➕ Tạo cuộc họp mới";return}createBtn.textContent="➕ Vào phòng với tư cách chủ phòng";showToast("Kiểm tra mic và camera trước khi vào.");return}
 enteringRoom=true;createBtn.disabled=true;createBtn.textContent="Đang tạo cuộc họp...";
 socket.emit("join-room",{room:"",name:myName,create:true});
}
createBtn.onclick=beginCreate;

const invitedRoom=new URLSearchParams(location.search).get("room");
if(invitedRoom){
 joinInfo.classList.remove("hidden");joinBtn.classList.remove("hidden");
 joinBtn.onclick=async()=>{
  myName=nameInput.value.trim();if(!myName){showToast("Vui lòng nhập tên của bạn.");nameInput.focus();return}
  if(enteringRoom)return;
  if(!previewReady){joinBtn.disabled=true;joinBtn.textContent="Đang mở camera...";const ok=await startPreview();joinBtn.disabled=false;if(!ok){joinBtn.textContent="🚪 Tham gia cuộc họp";return}joinBtn.textContent="🚪 Vào cuộc họp";showToast("Kiểm tra mic và camera trước khi vào.");return}
  enteringRoom=true;joinBtn.disabled=true;joinBtn.textContent="Đang vào phòng...";
  socket.emit("join-room",{room:invitedRoom,name:myName,create:false});
 };
}

enterMeeting.onclick=()=>{
 if(!enteringRoom){
  enteringRoom=true;enterMeeting.disabled=true;enterMeeting.textContent="Đang vào phòng...";
  socket.emit("join-room",{room:invitedRoom||"",name:myName,create:!invitedRoom});
 }
};

socket.on("room-joined",data=>{
 roomId=data.room;isHost=!!data.isHost;pinnedForAll=!!data.pinnedForAll;
 if(isHost)pinnedHostId=socket.id;
 home.classList.add("hidden");prejoin.classList.add("hidden");meeting.classList.remove("hidden");
 roomTitle.textContent="Phòng "+roomId;localName.textContent=myName;localTile.dataset.userId=socket.id;
 localVideo.srcObject=localStream;localHostBadge.classList.toggle("hidden",!isHost);hostControls.classList.toggle("hidden",!isHost);
 updateMeetingButtons();createShareLink();guestPage=0;renderGuestPage();
 if(pinnedForAll)applyPinnedHost();
 enteringRoom=false;enterMeeting.disabled=false;enterMeeting.textContent="🚪 Vào cuộc họp";
 showToast(isHost?"Đã tạo cuộc họp.":"Đã tham gia cuộc họp.");
});

function createShareLink(){
 const url=location.origin+"?room="+encodeURIComponent(roomId);
 history.replaceState(null,"","?room="+encodeURIComponent(roomId));
 copyBtn.onclick=async()=>{try{await navigator.clipboard.writeText(url);showToast("Đã sao chép link cuộc họp.")}catch{prompt("Sao chép link này:",url)}};
}

socket.on("participants",list=>{
 participants=Array.isArray(list)?list:[];
 const host=participants.find(u=>u.isHost);if(host)pinnedHostId=host.id;
 updateParticipants();renderGuestPage();if(pinnedForAll)applyPinnedHost();
});

function updateParticipants(){
 participantsList.innerHTML="";
 participants.forEach(user=>{
  const row=document.createElement("div");row.className="participant";
  const name=document.createElement("span");name.textContent=user.name+(user.isHost?" 👑":"");row.appendChild(name);
  if(isHost&&user.id!==socket.id){
   [["🔇","host-mute-user","Tắt mic"],["📷","host-camera-off","Tắt camera"],["🚫","host-remove-user","Đuổi khỏi phòng"]].forEach(([txt,ev,title])=>{
    const b=document.createElement("button");b.textContent=txt;b.title=title;b.onclick=()=>{if(ev==="host-remove-user"&&!confirm("Bạn có chắc muốn đuổi người này?"))return;socket.emit(ev,{userId:user.id})};row.appendChild(b);
   });
  }
  participantsList.appendChild(row);
 });
}

function createPeerConnection(remoteId){
 if(peerConnections[remoteId])return peerConnections[remoteId];
 const pc=new RTCPeerConnection(configuration);peerConnections[remoteId]=pc;pendingCandidates[remoteId]=[];
 if(localStream)localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
 pc.ontrack=e=>{const s=e.streams?.[0];if(s)createRemoteVideo(remoteId,s)};
 pc.onicecandidate=e=>{if(e.candidate)socket.emit("signal",{to:remoteId,data:{type:"candidate",candidate:e.candidate}})};
 pc.onconnectionstatechange=()=>{if(["failed","closed"].includes(pc.connectionState))removeRemoteVideo(remoteId)};
 return pc;
}

function getUserName(id){const u=participants.find(x=>x.id===id);return u?u.name+(u.isHost?" 👑":""):"Người tham gia"}

function createRemoteVideo(userId,stream){
 let tile=document.querySelector(`[data-user-id="${CSS.escape(userId)}"]`);
 if(!tile){
  tile=document.createElement("div");tile.className="video-tile";tile.dataset.userId=userId;
  const video=document.createElement("video");video.autoplay=true;video.playsInline=true;tile.appendChild(video);
  const name=document.createElement("div");name.className="video-name";name.textContent=getUserName(userId);tile.appendChild(name);
  const badge=document.createElement("div");badge.className="pinned-badge hidden";badge.textContent="📌 Đã ghim";tile.appendChild(badge);
  tile._stream=stream;
  guestGrid.appendChild(tile);
 }
 const video=tile.querySelector("video");if(video.srcObject!==stream)video.srcObject=stream;tile._stream=stream;
 renderGuestPage();if(pinnedForAll&&userId===pinnedHostId)applyPinnedHost();
}

function renderGuestPage(){
 const guests=participants.filter(u=>u.id!==socket.id);
 const total=Math.ceil(guests.length/GUESTS_PER_PAGE);
 if(guestPage>=total)guestPage=Math.max(0,total-1);
 guestSection.classList.toggle("hidden",guests.length===0);
 guestGrid.innerHTML="";
 if(!guests.length){guestPageInfo.textContent="Không có khách";guestPrev.disabled=true;guestNext.disabled=true;return}
 const start=guestPage*GUESTS_PER_PAGE,end=Math.min(start+GUESTS_PER_PAGE,guests.length);
 guestPageInfo.textContent=`Khách ${start+1}–${end} / ${guests.length}`;
 guestPrev.disabled=guestPage<=0;guestNext.disabled=guestPage>=total-1;
 guests.slice(start,end).forEach(u=>{
  const tile=document.querySelector(`[data-user-id="${CSS.escape(u.id)}"]`);
  if(tile)guestGrid.appendChild(tile);
 });
}

guestPrev.onclick=()=>{if(guestPage>0){guestPage--;renderGuestPage()}};
guestNext.onclick=()=>{const n=Math.ceil(participants.filter(u=>u.id!==socket.id).length/GUESTS_PER_PAGE);if(guestPage<n-1){guestPage++;renderGuestPage()}};

function applyPinnedHost(){
 document.querySelectorAll(".pinned-badge").forEach(b=>b.classList.add("hidden"));
 document.querySelectorAll(".pinned-tile").forEach(t=>t.classList.remove("pinned-tile"));
 if(!pinnedForAll||!pinnedHostId)return;
 const tile=document.querySelector(`[data-user-id="${CSS.escape(pinnedHostId)}"]`);
 if(tile){tile.classList.add("pinned-tile");tile.querySelector(".pinned-badge")?.classList.remove("hidden")}
}

function removeRemoteVideo(id){
 document.querySelector(`[data-user-id="${CSS.escape(id)}"]`)?.remove();
 peerConnections[id]?.close();delete peerConnections[id];delete pendingCandidates[id];renderGuestPage();
}

socket.on("user-joined",async user=>{
 if(!user?.id)return;
 try{const pc=createPeerConnection(user.id);const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("signal",{to:user.id,data:{type:"offer",offer:pc.localDescription}})}catch(e){console.error(e)}
});

socket.on("signal",async({from,data})=>{
 if(!from||!data)return;
 try{
  const pc=createPeerConnection(from);
  if(data.type==="offer"){
   await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
   const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
   socket.emit("signal",{to:from,data:{type:"answer",answer:pc.localDescription}});await flushCandidates(from);
  }else if(data.type==="answer"){
   await pc.setRemoteDescription(new RTCSessionDescription(data.answer));await flushCandidates(from);
  }else if(data.type==="candidate"){
   const c=new RTCIceCandidate(data.candidate);
   if(pc.remoteDescription)await pc.addIceCandidate(c);else(pendingCandidates[from]??=[]).push(c);
  }
 }catch(e){console.error("WebRTC signal error:",e)}
});

async function flushCandidates(id){
 const pc=peerConnections[id],list=pendingCandidates[id]||[];if(!pc)return;
 for(const c of list){try{await pc.addIceCandidate(c)}catch(e){}}pendingCandidates[id]=[];
}
socket.on("user-left",({id})=>id&&removeRemoteVideo(id));

function updateMeetingButtons(){
 const a=localStream?.getAudioTracks()[0],v=localStream?.getVideoTracks()[0];
 if(a)micBtn.firstChild.textContent=a.enabled?"🎤 ":"🔇 ";
 if(v){camBtn.firstChild.textContent=v.enabled?"📷 ":"🚫 ";localCameraOff.classList.toggle("hidden",v.enabled)}
}
micBtn.onclick=()=>{const t=localStream?.getAudioTracks()[0];if(t){t.enabled=!t.enabled;updateMeetingButtons();showToast(t.enabled?"Đã bật mic.":"Đã tắt mic.")}};
camBtn.onclick=()=>{const t=localStream?.getVideoTracks()[0];if(t){t.enabled=!t.enabled;updateMeetingButtons();showToast(t.enabled?"Đã bật camera.":"Đã tắt camera.")}};

switchCameraBtn.onclick=async()=>{
 if(!localStream)return;
 const oldFacing=cameraFacing;cameraFacing=cameraFacing==="user"?"environment":"user";
 try{
  const ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:cameraFacing},audio:false}),nt=ns.getVideoTracks()[0],ot=localStream.getVideoTracks()[0];
  if(ot){ot.stop();localStream.removeTrack(ot)}localStream.addTrack(nt);localVideo.srcObject=localStream;
  for(const pc of Object.values(peerConnections)){const s=pc.getSenders().find(x=>x.track?.kind==="video");if(s)await s.replaceTrack(nt)}
  showToast(cameraFacing==="environment"?"Đã chuyển sang camera sau.":"Đã chuyển sang camera trước.");
 }catch(e){cameraFacing=oldFacing;showToast("Không thể đổi camera.")}
};

screenBtn.onclick=async()=>{
 if(screenStream){await stopScreenShare();return}
 try{
  screenStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const st=screenStream.getVideoTracks()[0];localVideo.srcObject=screenStream;
  for(const pc of Object.values(peerConnections)){const s=pc.getSenders().find(x=>x.track?.kind==="video");if(s)await s.replaceTrack(st)}
  st.onended=stopScreenShare;screenBtn.firstChild.textContent="⏹️ ";showToast("Đang chia sẻ màn hình.");
 }catch(e){screenStream=null;showToast("Không thể chia sẻ màn hình.")}
};

async function stopScreenShare(){
 if(!screenStream)return;screenStream.getTracks().forEach(t=>t.stop());screenStream=null;localVideo.srcObject=localStream;
 const ct=localStream?.getVideoTracks()[0];if(ct)for(const pc of Object.values(peerConnections)){const s=pc.getSenders().find(x=>x.track?.kind==="video");if(s)await s.replaceTrack(ct)}
 screenBtn.firstChild.textContent="🖥️ ";
}

chatBtn.onclick=()=>{chatPanel.classList.toggle("hidden");if(!chatPanel.classList.contains("hidden"))chatInput.focus()};
closeChat.onclick=()=>chatPanel.classList.add("hidden");
chatForm.onsubmit=e=>{e.preventDefault();const text=chatInput.value.trim();if(!text)return;socket.emit("chat",{text});chatInput.value=""};
socket.on("chat",({name,text})=>{const m=document.createElement("div");m.className="msg";m.textContent=name+": "+text;messages.appendChild(m);messages.scrollTop=messages.scrollHeight});

participantsBtn.onclick=()=>participantsPanel.classList.toggle("hidden");
closeParticipants.onclick=()=>participantsPanel.classList.add("hidden");
pinHost.onclick=()=>{if(isHost)socket.emit("host-toggle-pin")};
socket.on("host-pin-changed",({pinned,hostId})=>{pinnedForAll=!!pinned;pinnedHostId=hostId||null;applyPinnedHost()});
muteAll.onclick=()=>isHost&&socket.emit("host-mute-all");
cameraOffAll.onclick=()=>isHost&&socket.emit("host-camera-off-all");
unlockAllMic.onclick=()=>isHost&&socket.emit("host-unlock-all-mic");
unlockAllCamera.onclick=()=>isHost&&socket.emit("host-unlock-all-camera");
lockRoom.onclick=()=>isHost&&socket.emit("host-toggle-lock");

socket.on("force-mute",()=>{const t=localStream?.getAudioTracks()[0];if(t)t.enabled=false;updateMeetingButtons();showToast("Chủ phòng đã tắt mic của bạn.")});
socket.on("force-camera-off",()=>{const t=localStream?.getVideoTracks()[0];if(t)t.enabled=false;updateMeetingButtons();showToast("Chủ phòng đã tắt camera của bạn.")});
socket.on("unlock-mic",()=>showToast("Chủ phòng đã cho phép bật mic."));
socket.on("unlock-camera",()=>showToast("Chủ phòng đã cho phép bật camera."));
socket.on("room-lock-changed",({locked})=>showToast(locked?"🔒 Phòng đã được khóa.":"🔓 Phòng đã được mở khóa."));
socket.on("room-locked",({message})=>{enteringRoom=false;joinBtn.disabled=false;enterMeeting.disabled=false;joinBtn.textContent="🚪 Vào cuộc họp";enterMeeting.textContent="🚪 Vào cuộc họp";showToast(message||"Phòng đang bị khóa.")});
socket.on("removed-from-room",()=>{cleanupMeeting();showToast("Bạn đã bị chủ phòng đưa ra khỏi phòng.")});
socket.on("room-error",({message})=>{enteringRoom=false;createBtn.disabled=false;joinBtn.disabled=false;enterMeeting.disabled=false;createBtn.textContent=previewReady?"➕ Vào phòng với tư cách chủ phòng":"➕ Tạo cuộc họp mới";joinBtn.textContent=previewReady?"🚪 Vào cuộc họp":"🚪 Tham gia cuộc họp";enterMeeting.textContent="🚪 Vào cuộc họp";showToast(message||"Không thể vào phòng.")});
socket.on("meeting-ended",()=>{cleanupMeeting();showToast("Cuộc họp đã kết thúc.")});

function cleanupMeeting(){
 if(screenStream){screenStream.getTracks().forEach(t=>t.stop());screenStream=null}
 if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null}
 Object.values(peerConnections).forEach(pc=>{try{pc.close()}catch{}});
 Object.keys(peerConnections).forEach(k=>delete peerConnections[k]);Object.keys(pendingCandidates).forEach(k=>delete pendingCandidates[k]);
 guestGrid.innerHTML="";localVideo.srcObject=null;previewVideo.srcObject=null;
 meeting.classList.add("hidden");prejoin.classList.add("hidden");home.classList.remove("hidden");
 joinBtn.disabled=false;createBtn.disabled=false;enterMeeting.disabled=false;
 joinBtn.textContent="🚪 Tham gia cuộc họp";createBtn.textContent="➕ Tạo cuộc họp mới";enterMeeting.textContent="🚪 Vào cuộc họp";
 participantsPanel.classList.add("hidden");chatPanel.classList.add("hidden");
 roomId=null;isHost=false;previewReady=false;enteringRoom=false;pinnedForAll=false;pinnedHostId=null;guestPage=0;
}

leaveBtn.onclick=()=>{
 if(!confirm("Bạn có chắc muốn rời phòng?"))return;
 if(isHost)socket.emit("end-meeting");else{socket.emit("leave-room");cleanupMeeting();showToast("Bạn đã rời phòng.")}
};
socket.on("connect",()=>console.log("VMeet connected:",socket.id));
socket.on("disconnect",()=>console.log("VMeet disconnected"));
