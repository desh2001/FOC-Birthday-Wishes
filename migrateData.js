import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { BIRTHDAY_DATA } from "./src/data.js";

const firebaseConfig = {
  apiKey: "AIzaSyCj_2hn0T6R9Ye2N51iW_rA8I7J9C9Abbo",
  authDomain: "foc-birthday-450f1.firebaseapp.com",
  projectId: "foc-birthday-450f1",
  storageBucket: "foc-birthday-450f1.firebasestorage.app",
  messagingSenderId: "545529443768",
  appId: "1:545529443768:web:025b475edd2cee40b38b4d",
  measurementId: "G-MTETF8SHQ6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
    console.log("Connecting to Firebase Firestore...");
    const studentsRef = collection(db, "students");
    
    try {
        const snapshot = await getDocs(studentsRef);
        if (!snapshot.empty) {
            console.log(`Firestore already has ${snapshot.size} records inside the 'students' collection.`);
            console.log("Migration skipped to prevent duplicating your data.");
            process.exit(0);
        }

        console.log(`Found ${BIRTHDAY_DATA.length} records to migrate. Starting upload...`);
        let count = 0;
        
        // We run these in parallel chunks for speed, but sequentially is safer to avoid overwhelming the console.
        for (const student of BIRTHDAY_DATA) {
            await addDoc(studentsRef, student);
            count++;
            console.log(`[${count}/${BIRTHDAY_DATA.length}] Uploaded: ${student.featured_name || student.name}`);
        }
        
        console.log(`\n✅ Successfully migrated all ${count} records to your Firebase Database!`);
        process.exit(0);
    } catch (error) {
        console.error("Firebase Migration Error:", error.message);
        console.error("Make sure your Firestore database is created and security rules allow read/write in Test Mode.");
        process.exit(1);
    }
}

migrate();
