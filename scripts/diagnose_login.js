
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyB2zMUjWWLodrD0DNKMu2q9lFLWjsbNZGU",
    authDomain: "bel-air-habitat.firebaseapp.com",
    projectId: "bel-air-habitat",
    storageBucket: "bel-air-habitat.firebasestorage.app",
    messagingSenderId: "653532514900",
    appId: "1:653532514900:web:e11b20153e7a37decb7bc1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = "anwishamukhtar@gmail.com";
const password = "Paris786@";

console.log(`Attempting login for: ${email}`);

signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
        console.log("SUCCESS: User logged in successfully!");
        console.log("UID:", userCredential.user.uid);
        process.exit(0);
    })
    .catch((error) => {
        console.error("FAILURE: Login failed.");
        console.error("Code:", error.code);
        console.error("Message:", error.message);
        process.exit(1);
    });
