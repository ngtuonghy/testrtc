import React, { useRef, useState } from "react";
import { db } from "./lib/firebase";
import {
	collection,
	addDoc,
	doc,
	getDoc,
	setDoc,
	updateDoc,
	arrayUnion,
	onSnapshot,
} from "firebase/firestore";

const configuration = {
	iceServers: [
		{
			urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
		},
	],
};

const Rtc = () => {
	const [roomId, setRoomId] = useState("");
	const [joinId, setJoinId] = useState("");
	const localVideo = useRef(null);
	const remoteVideoRef = useRef(null);
	const peerConnection = useRef(null);
	const localStream = useRef(null);

	const startCall = async () => {
		localStream.current = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true,
		});
		localVideo.current.srcObject = localStream.current;
	};

	const createRoom = async () => {
		peerConnection.current = new RTCPeerConnection(configuration);

		// Lấy luồng video/audio từ người tạo phòng
		await startCall();
		localStream.current.getTracks().forEach((track) => {
			peerConnection.current.addTrack(track, localStream.current);
		});

		// Tạo offer và lưu vào Firestore
		const offer = await peerConnection.current.createOffer();
		await peerConnection.current.setLocalDescription(offer);
		const roomRef = await addDoc(collection(db, "rooms"), {
			offer: { type: offer.type, sdp: offer.sdp },
		});
		setRoomId(roomRef.id);

		// Lắng nghe các ICE candidates
		peerConnection.current.onicecandidate = async (event) => {
			if (event.candidate) {
				await updateDoc(roomRef, {
					candidates: arrayUnion(event.candidate.toJSON()),
				});
			}
		};

		// Hiển thị video từ người tham gia khác
		peerConnection.current.ontrack = (event) => {
			remoteVideoRef.current.srcObject = event.streams[0];
		};
	};

	const joinRoom = async (e) => {
		e.preventDefault();
		peerConnection.current = new RTCPeerConnection(configuration);

		await startCall();
		localStream.current.getTracks().forEach((track) => {
			peerConnection.current.addTrack(track, localStream.current);
		});

		const roomRef = doc(db, "rooms", joinId);
		const roomSnapshot = await getDoc(roomRef);
		if (roomSnapshot.exists()) {
			const roomData = roomSnapshot.data();
			await peerConnection.current.setRemoteDescription(
				new RTCSessionDescription(roomData.offer),
			);
			const answer = await peerConnection.current.createAnswer();
			await peerConnection.current.setLocalDescription(answer);

			await setDoc(
				roomRef,
				{ answer: { type: answer.type, sdp: answer.sdp } },
				{ merge: true },
			);

			// Nhận track từ người tạo phòng
			peerConnection.current.ontrack = (event) => {
				remoteVideoRef.current.srcObject = event.streams[0];
			};
		} else {
			alert("Room không tồn tại!");
		}
	};

	const stopCall = () => {
		if (localStream.current) {
			localStream.current.getTracks().forEach((track) => track.stop());
		}
		if (peerConnection.current) {
			peerConnection.current.close();
		}
		setRoomId("");
	};

	return (
		<div>
			<button onClick={createRoom}>Create Room</button>
			<p>Room ID: {roomId}</p>
			<button onClick={stopCall}>Stop</button>

			<div style={{ display: "flex" }}>
				<video ref={localVideo} autoPlay muted style={{ width: "45%" }}></video>
				<video ref={remoteVideoRef} autoPlay style={{ width: "45%" }}></video>
			</div>

			<form onSubmit={joinRoom}>
				<input
					required
					type="text"
					placeholder="Enter room ID"
					value={joinId}
					onChange={(e) => setJoinId(e.target.value)}
				/>
				<button type="submit">Join Room</button>
			</form>
		</div>
	);
};

export { Rtc };
