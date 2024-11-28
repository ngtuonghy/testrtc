import React, { useRef, useEffect, useState } from "react";
import { db } from "./lib/firebase";
import {
	doc,
	setDoc,
	getDoc,
	onSnapshot,
	collection,
	addDoc,
} from "firebase/firestore";

const configuration = {
	iceServers: [
		{
			urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
		},
	],
	iceCandidatePoolSize: 10,
};

const VideoCall = () => {
	const localVideoRef = useRef(null);
	const remoteVideoRef = useRef(null);
	const peerConnection = useRef(new RTCPeerConnection(configuration));

	const [callId, setCallId] = useState("");
	const [generatedCallId, setGeneratedCallId] = useState(null); // Lưu ID phòng

	useEffect(() => {
		startLocalVideo();
	}, []);

	const generateCallId = () => {
		const newCallId = Math.random().toString(36).substring(2, 8); // Tạo ID ngẫu nhiên 6 ký tự
		setGeneratedCallId(newCallId);
		// setCallId(newCallId);
		return newCallId;
	};

	const startLocalVideo = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true,
			});
			localVideoRef.current.srcObject = stream;
			stream
				.getTracks()
				.forEach((track) => peerConnection.current.addTrack(track, stream));
		} catch (error) {
			console.error("Error accessing media devices:", error);
		}
	};

	const setupConnection = async () => {
		peerConnection.current.onicecandidate = (event) => {
			if (event.candidate) {
				// Lưu ICE candidate vào tài liệu 'localCandidate' trong Firestore
				setDoc(
					collection(db, "calls", callId, "candidates", "localCandidate"),
					{
						candidate: event.candidate.toJSON(),
					},
				);
			}
		};

		peerConnection.current.ontrack = (event) => {
			remoteVideoRef.current.srcObject = event.streams[0];
		};

		// Lắng nghe ICE Candidate từ 'remoteCandidate'
		onSnapshot(
			doc(db, "calls", callId, "candidates", "remoteCandidate"),
			(snapshot) => {
				const data = snapshot.data();
				if (data?.candidate) {
					peerConnection.current.addIceCandidate(
						new RTCIceCandidate(data.candidate),
					);
				}
			},
		);
	};

	const createOffer = async () => {
		const newCallId = generateCallId(); // Tạo ID khi bắt đầu cuộc gọi
		// await setupConnection();
		const offer = await peerConnection.current.createOffer();
		console.log(offer);
		// const docRef = await addDoc(collection(db, "users"), {
		// 	first: "Ada",
		// 	last: "Lovelace",
		// 	born: 1815,
		// });
		// console.log("Document written with ID: ", docRef.id);

		// Add or update the document
		await peerConnection.current.setLocalDescription(offer);
		await addDoc(collection(db, "calls"), { offer });
	};

	const joinCall = async () => {
		const callDoc = await getDoc(doc(db, "calls", callId));
		if (callDoc.exists()) {
			const offer = callDoc.data().offer;
			await peerConnection.current.setRemoteDescription(
				new RTCSessionDescription(offer),
			);

			const answer = await peerConnection.current.createAnswer();
			await peerConnection.current.setLocalDescription(answer);
			await setDoc(doc(db, "calls", callId, "answer"), { answer });
		}
	};

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "1rem",
			}}
		>
			<h2>Video Call</h2>
			{generatedCallId && <p>Room ID: {generatedCallId}</p>}
			<input
				type="text"
				placeholder="Enter Call ID"
				value={callId}
				onChange={(e) => setCallId(e.target.value)}
			/>
			<div>
				<button onClick={createOffer}>Create Call</button>
				<button onClick={joinCall}>Join Call</button>
			</div>
			<div className="videos">
				<video width={"45%"} ref={localVideoRef} autoPlay playsInline muted />
				<video width={"45%"} ref={remoteVideoRef} autoPlay playsInline />
			</div>
		</div>
	);
};

export { VideoCall };
