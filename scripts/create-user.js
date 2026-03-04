const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB2zMUjWWLodrD0DNKMu2q9lFLWjsbNZGU",
  authDomain: "bel-air-habitat.firebaseapp.com",
  projectId: "bel-air-habitat",
  storageBucket: "bel-air-habitat.firebasestorage.app",
  messagingSenderId: "653532514900",
  appId: "1:653532514900:web:e11b20153e7a37decb7bc1"
};

const email = process.argv[2];
const password = process.argv[3];
const displayName = process.argv[4] || email.split('@')[0];

if (!email || !password) {
  console.error('Usage: node create-user.js <email> <password> [displayName]');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createUser() {
  try {
    console.log(`Creating user: ${email}`);
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log(`✓ User created with UID: ${user.uid}`);
    
    const userDoc = {
      uid: user.uid,
      email: email,
      displayName: displayName,
      role: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await setDoc(doc(db, 'users', user.uid), userDoc);
    
    console.log(`✓ User document created in Firestore`);
    console.log(`✓ User ${email} created successfully!`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  }
}

createUser();
