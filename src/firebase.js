import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCj_2hn0T6R9Ye2N51iW_rA8I7J9C9Abbo",
  authDomain: "foc-birthday-450f1.firebaseapp.com",
  projectId: "foc-birthday-450f1",
  storageBucket: "foc-birthday-450f1.firebasestorage.app",
  messagingSenderId: "545529443768",
  appId: "1:545529443768:web:025b475edd2cee40b38b4d",
  measurementId: "G-MTETF8SHQ6"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
