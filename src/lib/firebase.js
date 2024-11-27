import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Follow this pattern to import other Firebase services
// import { } from 'firebase/<service>';

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
	apiKey: "AIzaSyA7JgKShUqUlCy-wi7HKP3i3B_bOMzOwvo",
	authDomain: "webrtc-99664.firebaseapp.com",
	projectId: "webrtc-99664",
	storageBucket: "webrtc-99664.firebasestorage.app",
	messagingSenderId: "78450952042",
	appId: "1:78450952042:web:917845072690a7de2dc713",
	measurementId: "G-QKYLVZBD3L",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
