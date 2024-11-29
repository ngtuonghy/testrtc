import "./Rtc.css";
import React, { useRef, useEffect, useState } from "react";
import {
	BiCamera,
	BiCameraOff,
	BiMicrophone,
	BiMicrophoneOff,
} from "react-icons/bi";
import { db } from "./lib/firebase";
import {
	doc,
	setDoc,
	getDoc,
	onSnapshot,
	arrayUnion,
	collection,
	addDoc,
	updateDoc,
} from "firebase/firestore";

const configuration = {
	iceServers: [
		{ urls: "stun:stun.l.google.com:19302" },
		{ urls: "stun:stun.l.google.com:5349" },
		{ urls: "stun:stun1.l.google.com:3478" },
		{ urls: "stun:stun1.l.google.com:5349" },
		{ urls: "stun:stun2.l.google.com:19302" },
		{ urls: "stun:stun2.l.google.com:5349" },
		{ urls: "stun:stun3.l.google.com:3478" },
		{ urls: "stun:stun3.l.google.com:5349" },
		{ urls: "stun:stun4.l.google.com:19302" },
		{ urls: "stun:stun4.l.google.com:5349" },
	],
	// iceCandidatePoolSize: 10,
};

const VideoCall = () => {
	const localVideoRef = useRef(null);
	const remoteVideoRef = useRef();
	const peerConnection = useRef(new RTCPeerConnection(configuration));

	const [callId, setCallId] = useState("");
	const [generatedCallId, setGeneratedCallId] = useState(null);

	useEffect(() => {
		startLocalVideo();
	}, []);

	const generateCallId = () => {
		const newCallId = Math.random().toString(36).substring(2, 8);
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

			peerConnection.current.ontrack = (event) => {
				remoteVideoRef.current.srcObject = event.streams[0];
			};
		} catch (error) {
			console.error("Error accessing media devices:", error);
		}
	};

	const setupConnection = (newCallId) => {
		peerConnection.current.onicecandidate = (event) => {
			if (event.candidate) {
				console.log(event.candidate);

				try {
					const candidateRef = doc(
						db,
						"calls",
						newCallId,
						"candidates",
						"local",
					);

					setDoc(
						candidateRef,
						{
							candidates: arrayUnion(event.candidate.toJSON()),
						},
						{ merge: true },
					);
					console.log("Candidate added successfully");
				} catch (error) {
					console.error("Error adding candidate: ", error);
				}
			}
		};
		onSnapshot(doc(db, "calls", newCallId), (snapshot) => {
			const data = snapshot.data();
			// console.log(data, "is running");
			if (!peerConnection.current.currentRemoteDescription && data.answer) {
				console.log("Set remote description: ", data.answer);
				const answer = new RTCSessionDescription(data.answer);
				peerConnection.current.setRemoteDescription(answer);
			}

			// if (data?.candidate) {
			// 	peerConnection.current.addIceCandidate(
			// 		new RTCIceCandidate(data.candidate),
			// 	);
			// }
		});

		onSnapshot(
			doc(db, "calls", newCallId, "candidates", "remote"),

			(snapshot) => {
				const data = snapshot.data();
				console.log(data, "remoteCandidate is running");
				if (data) {
					for (const candidate of data.candidates) {
						console.log(candidate, "candidate remote");
						peerConnection.current.addIceCandidate(
							new RTCIceCandidate(candidate),
						);
					}
					// peerConnection.current.addIceCandidate(
					// 	new RTCIceCandidate(data.remoteCandidate),
					// );
				}
			},
		);
	};

	const createOffer = async () => {
		const newCallId = generateCallId();
		setupConnection(newCallId);
		const offer = await peerConnection.current.createOffer();
		// console.log(offer);

		await peerConnection.current.setLocalDescription(offer);
		await setDoc(doc(db, "calls", newCallId), {
			offer,
		});

		// setDoc(collection(db, "calls", newCallId), { offer });
	};

	const joinCall = async () => {
		const callDoc = await getDoc(doc(db, "calls", callId));
		if (callDoc.exists()) {
			peerConnection.current.onicecandidate = (event) => {
				if (event.candidate) {
					console.log(event.candidate);

					try {
						const candidateRef = doc(
							db,
							"calls",
							callId,
							"candidates",
							"remote",
						);

						setDoc(
							candidateRef,
							{
								candidates: arrayUnion(event.candidate.toJSON()),
							},
							{ merge: true },
						);
						console.log("Candidate added successfully");
					} catch (error) {
						console.error("Error adding candidate: ", error);
					}
				}
			};
			console.log(callDoc.data());
			const offer = callDoc.data().offer;
			await peerConnection.current.setRemoteDescription(offer);

			// console.log("setRemoteDescription", callId);
			const answer = await peerConnection.current.createAnswer();
			await peerConnection.current.setLocalDescription(answer);
			await updateDoc(doc(db, "calls", callId), { answer });

			onSnapshot(
				doc(db, "calls", callId, "candidates", "local"),
				(snapshot) => {
					// console.log(snapshot.data());
					const data = snapshot.data();
					console.log(data, "localCandidate is running");
					if (data) {
						// console.log(data.candidates, "localCandidate is running");
						for (const candidate of data.candidates) {
							console.log(candidate, "candidate");
							peerConnection.current.addIceCandidate(
								new RTCIceCandidate(candidate),
							);
						}
						// console.log(data, "localCandidate is running");
						// peerConnection.current.addIceCandidate(
						// 	new RTCIceCandidate(data.localCandidate),
						// );
					}
				},
			);

			// setupConnection(callId);
		} else {
			console.log("Call ID not found");
			alert(`Call ID not found ${callId}`);
		}
	};
	const [isCameraOn, setIsCameraOn] = useState(true);
	const [isAudioOn, setIsAudioOn] = useState(true);
	const toggleCamera = () => {
		if (localVideoRef.current && localVideoRef.current.srcObject) {
			const stream = localVideoRef.current.srcObject;
			const videoTrack = stream
				.getTracks()
				.find((track) => track.kind === "video");
			if (videoTrack) {
				videoTrack.enabled = !videoTrack.enabled;
				setIsCameraOn(videoTrack.enabled);
			}
		}
	};
	const toggleMic = () => {
		if (localVideoRef.current && localVideoRef.current.srcObject) {
			const stream = localVideoRef.current.srcObject;
			const audioTrack = stream
				.getTracks()
				.find((track) => track.kind === "audio");
			if (audioTrack) {
				audioTrack.enabled = !audioTrack.enabled;
				setIsAudioOn(audioTrack.enabled);
			}
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

			<div className="control">
				<input
					type="text"
					placeholder="Enter Call ID"
					value={callId}
					onChange={(e) => setCallId(e.target.value.trim())}
				/>
				<button onClick={joinCall}>Join Call</button>
			</div>
			<button onClick={createOffer}>Create Call</button>
			<div className="videos">
				<video
					className="video"
					ref={localVideoRef}
					autoPlay
					playsInline
					muted
				/>
				<video className="video" ref={remoteVideoRef} autoPlay playsInline />
			</div>
			<div className="control">
				<button className="btn" onClick={toggleCamera}>
					{isCameraOn ? (
						<BiCamera size={25} />
					) : (
						<BiCameraOff size={25} color="red" />
					)}
				</button>
				<button className="btn" onClick={toggleMic}>
					{isAudioOn ? (
						<BiMicrophone size={25} />
					) : (
						<BiMicrophoneOff color="red" size={25} />
					)}
				</button>
			</div>
		</div>
	);
};

export { VideoCall };
