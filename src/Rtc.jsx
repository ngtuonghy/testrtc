import React, { useRef, useState } from "react";
import { db } from "./lib/firebase";
import {
	collection,
	addDoc,
	doc,
	getDoc,
	setDoc,
	updateDoc,
	onSnapshot,
	arrayUnion,
} from "firebase/firestore";

// Cấu hình ICE server cho WebRTC
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
	const peerConnection = useRef(new RTCPeerConnection(configuration));
	const localStream = useRef(null);

	// Bắt đầu cuộc gọi và lấy video/audio
	const startCall = async () => {
		try {
			localStream.current = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true,
			});
			localVideo.current.srcObject = localStream.current;

			localStream.current.getTracks().forEach((track) => {
				peerConnection.current.addTrack(track, localStream.current);
			});
		} catch (error) {
			console.error("Error accessing media devices.", error);
		}
	};

	// Tạo phòng mới
	const createRoom = async () => {
		await startCall();

		const offer = await peerConnection.current.createOffer();
		await peerConnection.current.setLocalDescription(offer);

		const roomRef = await addDoc(collection(db, "rooms"), {
			offer: { type: offer.type, sdp: offer.sdp },
		});

		setRoomId(roomRef.id);

		peerConnection.current.onicecandidate = async (event) => {
			if (event.candidate) {
				await updateDoc(roomRef, {
					candidates: arrayUnion(event.candidate.toJSON()),
				});
			}
		};

		peerConnection.current.ontrack = (event) => {
			remoteVideoRef.current.srcObject = event.streams[0];
		};

		// Lắng nghe answer từ người tham gia
		onSnapshot(roomRef, (snapshot) => {
			const data = snapshot.data();
			if (data?.answer) {
				const remoteDesc = new RTCSessionDescription(data.answer);
				peerConnection.current.setRemoteDescription(remoteDesc);
			}
		});
	};

	// Tham gia phòng đã tạo
	const joinRoom = async (e) => {
		e.preventDefault();
		const roomRef = doc(db, "rooms", joinId);
		const roomSnapshot = await getDoc(roomRef);

		if (roomSnapshot.exists()) {
			const roomData = roomSnapshot.data();
			const offer = roomData.offer;

			await startCall();
			await peerConnection.current.setRemoteDescription(
				new RTCSessionDescription(offer),
			);

			const answer = await peerConnection.current.createAnswer();
			await peerConnection.current.setLocalDescription(answer);

			await setDoc(
				roomRef,
				{ answer: { type: answer.type, sdp: answer.sdp } },
				{ merge: true },
			);

			peerConnection.current.onicecandidate = async (event) => {
				if (event.candidate) {
					await updateDoc(roomRef, {
						candidates: arrayUnion(event.candidate.toJSON()),
					});
				}
			};

			peerConnection.current.ontrack = (event) => {
				remoteVideoRef.current.srcObject = event.streams[0];
			};

			// Lắng nghe ICE candidates từ host
			onSnapshot(roomRef, (snapshot) => {
				const data = snapshot.data();
				if (data?.candidates) {
					data.candidates.forEach(async (candidate) => {
						try {
							await peerConnection.current.addIceCandidate(
								new RTCIceCandidate(candidate),
							);
						} catch (error) {
							console.error("Error adding received ICE candidate", error);
						}
					});
				}
			});
		} else {
			alert("Room không tồn tại!");
		}
	};

	// Dừng cuộc gọi
	const stopCall = () => {
		localStream.current.getTracks().forEach((track) => track.stop());
		peerConnection.current.close();
		setRoomId("");
	};

	return (
		<div>
			<button onClick={createRoom}>Create Room</button>
			{roomId && <p>Room ID: {roomId}</p>}
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
