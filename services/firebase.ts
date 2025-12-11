import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, increment as firestoreIncrement } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDRtc-t1Fe1vmXXRGQOtU5kNmaa0J8QLiI",
  authDomain: "moizic.firebaseapp.com",
  projectId: "moizic",
  storageBucket: "moizic.firebasestorage.app",
  messagingSenderId: "928612020325",
  appId: "1:928612020325:web:727cc0e1dff885012c968c",
  measurementId: "G-RQMB3PZ783"
};

export const API_KEY = firebaseConfig.apiKey;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// Re-export increment for convenience
export const increment = firestoreIncrement;

export default app;