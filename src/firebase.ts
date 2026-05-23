import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD3BDm3-_uIMB1sFc-P3osGiwukVBnzdjw",
  authDomain: "petty-cash-ichibot-2026.firebaseapp.com",
  databaseURL: "https://petty-cash-ichibot-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "petty-cash-ichibot-2026",
  storageBucket: "petty-cash-ichibot-2026.firebasestorage.app",
  messagingSenderId: "544480785924",
  appId: "1:544480785924:web:759c67dea530b428536751",
  measurementId: "G-W0RMLPNM7S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
