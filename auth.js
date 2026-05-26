import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// ✅ CLEANED CONFIG (Zero trailing spaces)
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

// ✅ SAFE INIT (Prevents app/duplicate-app error)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);
const CORRECT_PASSWORD = "1111";

console.log("🔌 Firebase ready:", app.name);

// Loader
window.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('page-loader');
  if (loader) setTimeout(() => loader.classList.add('hidden'), 300);
});

// Login handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  
  if (password === CORRECT_PASSWORD) {
    sessionStorage.setItem('kumonAuth', 'true');
    await initializeCenters();
    window.location.href = 'centers.html';
  } else {
    if (errorMsg) errorMsg.textContent = 'Incorrect password. Please try again.';
  }
});

// ✅ ADDITIVE CENTER INITIALIZATION
async function initializeCenters() {
  try {
    const centersRef = ref(db, 'centers');
    const snapshot = await get(centersRef);
    const currentCenters = snapshot.exists() ? snapshot.val() : {};

    const newCenters = {
      'kumon-taipa-mei-keng': { id: 'kumon-taipa-mei-keng', name: 'Kumon Taipa Mei Keng', createdAt: new Date().toISOString() },
      'kumon-taipa-pac-tat': { id: 'kumon-taipa-pac-tat', name: 'Kumon Taipa Pac Tat', createdAt: new Date().toISOString() },
      'kumon-tap-siac':      { id: 'kumon-tap-siac',      name: 'Kumon Tap Siac',      createdAt: new Date().toISOString() },
      'kumon-champs':        { id: 'kumon-champs',        name: 'Kumon Champs',        createdAt: new Date().toISOString() }
    };

    // Only queue centers that don't already exist
    const updates = {};
    for (const [key, val] of Object.entries(newCenters)) {
      if (!currentCenters[key]) {
        updates[key] = val;
      }
    }

    if (Object.keys(updates).length > 0) {
      await update(centersRef, updates);
      console.log("✅ Added to Firebase:", Object.keys(updates));
    } else {
      console.log("ℹ️ All centers already exist in DB.");
    }
  } catch (err) {
    console.error("❌ Firebase Error:", err);
  }
}

// Auth guard
export function requireAuth() {
  if (sessionStorage.getItem('kumonAuth') !== 'true') {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

export { db };