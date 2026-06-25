// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBjTvL8JIoqlepSXDBgF4wg2UADehBApvc",
  authDomain: "voyage-group-531b6.firebaseapp.com",
  databaseURL: "https://voyage-group-531b6-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "voyage-group-531b6",
  storageBucket: "voyage-group-531b6.firebasestorage.app",
  messagingSenderId: "385902161597",
  appId: "1:385902161597:web:0b69b85d87ebf73a3411d4",
  measurementId: "G-Y9JEYH9XJE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);