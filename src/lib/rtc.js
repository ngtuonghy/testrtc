const configuration = {
	iceServers: [
		{
			urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
		},
	],
	iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;

const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const createButton = document.querySelector("#createRoom");
const localVideo = document.querySelector("#localVideo");
// const callButton = document.querySelector("#callButton");

createButton.onclick = async () => {
	localStream = await navigator.mediaDevices.getUserMedia({
		video: true,
		audio: true,
	});
	console.log("Create PeerConnection with configuration: ");
	peerConnection = new RTCPeerConnection(configuration);
	registerPeerConnectionListeners();

	localStream
		.getTracks()
		.forEach((track) => peerConnection.addTrack(track, localStream));

	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);

	const roomWithOffer = {
		offer: {
			type: offer.type,
			sdp: offer.sdp,
		},
	};
	const roomRef = await db.collection("rooms").add(roomWithOffer);
	const roomId = roomRef.id;
	document.querySelector("#currentRoom").innerText =
		`Current room is ${roomId} - You are the caller!`;

	peerConnection.addEventListener("track", (event) => {
		console.log("Got remote track:", event.streams[0]);
		event.streams[0].getTracks().forEach((track) => {
			console.log("Add a track to the remoteStream:", track);
			remoteStream.addTrack(track);
		});
	});
};

startButton.onclick = async () => {
	localVideo.srcObject = localStream;
};

stopButton.onclick = () => {
	document
		.querySelector("#localVideo")
		.srcObject.getTracks()
		.forEach((track) => track.stop());
	localVideo.srcObject = null;
};

function registerPeerConnectionListeners() {
	peerConnection.addEventListener("icegatheringstatechange", () => {
		console.log(
			`ICE gathering state changed: ${peerConnection.iceGatheringState}`,
		);
	});

	peerConnection.addEventListener("connectionstatechange", () => {
		console.log(`Connection state change: ${peerConnection.connectionState}`);
	});

	peerConnection.addEventListener("signalingstatechange", () => {
		console.log(`Signaling state change: ${peerConnection.signalingState}`);
	});

	peerConnection.addEventListener("iceconnectionstatechange ", () => {
		console.log(
			`ICE connection state change: ${peerConnection.iceConnectionState}`,
		);
	});
}
