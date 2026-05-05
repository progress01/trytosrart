import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAIY9PU-bDLktkTpLSmFKRe1uepvWCKEiU",
    authDomain: "maplestoryboss.firebaseapp.com",
    projectId: "maplestoryboss",
    storageBucket: "maplestoryboss.firebasestorage.app",
    messagingSenderId: "198034430854",
    appId: "1:198034430854:web:527ffcee039e223b972a07",
    measurementId: "G-SG0DN633FC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 💡 啟動 Firestore 本地快取 (離線支援)
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("多個分頁開啟，無法啟用快取。");
    } else if (err.code == 'unimplemented') {
        console.warn("瀏覽器不支援 IndexedDB。");
    }
});

export { db, auth, provider, signInWithPopup, onAuthStateChanged, signOut };
