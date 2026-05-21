// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB1VhQwGotEI8BHt8wp8FvtPpUY5FsI0qA",
  authDomain: "kumondb-f4377.firebaseapp.com",
  databaseURL: "https://kumondb-f4377-default-rtdb.firebaseio.com",
  projectId: "kumondb-f4377",
  storageBucket: "kumondb-f4377.firebasestorage.app",
  messagingSenderId: "838725994916",
  appId: "1:838725994916:web:87326ba7bec87a0e6b5931",
  measurementId: "G-EY7L54FTS1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Simple password auth (for demo - use Firebase Auth in production)
const CORRECT_PASSWORD = "1111";

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  
  if (password === CORRECT_PASSWORD) {
    sessionStorage.setItem('kumonAuth', 'true');
    // Initialize centers if not exists
    await initializeCenters();
    window.location.href = 'dashboard.html';
  } else {
    errorMsg.textContent = 'Incorrect password. Please try again.';
  }
});

async function initializeCenters() {
  const centersRef = ref(db, 'centers');
  const snapshot = await get(centersRef);
  if (!snapshot.exists()) {
    await set(centersRef, {
      'kumon-taipa-mei-keng': {
        id: 'kumon-taipa-mei-keng',
        name: 'Kumon Taipa Mei Keng',
        createdAt: new Date().toISOString()
      },
      'kumon-taipa-pac-tat': {
        id: 'kumon-taipa-pac-tat',
        name: 'Kumon Taipa Pac Tat',
        createdAt: new Date().toISOString()
      }
    });
  }
}

// Auth guard for protected pages
export function requireAuth() {
  if (sessionStorage.getItem('kumonAuth') !== 'true') {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

export { db };
