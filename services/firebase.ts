import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/analytics";

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

// Initialize Firebase (check if already initialized for hot-reload safety)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const app = firebase.app();

export const auth = firebase.auth();
export const db = firebase.firestore();
export const analytics = firebase.analytics();

// Re-export increment for convenience
export const increment = firebase.firestore.FieldValue.increment;

export default app;