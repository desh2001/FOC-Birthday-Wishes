import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getLocalImagePath } from "./src/data.js";

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
const storage = getStorage(app);

async function migrateImages() {
    console.log("Connecting to Firebase...");
    const studentsRef = collection(db, "students");
    const snapshot = await getDocs(studentsRef);
    
    console.log(`Found ${snapshot.size} students. Checking for local images to sync...`);
    let updatedCount = 0;
    
    for (const document of snapshot.docs) {
        const student = document.data();
        const localImagePath = getLocalImagePath(student);
        
        if (localImagePath && fs.existsSync(localImagePath)) {
            try {
                const fileBuffer = fs.readFileSync(localImagePath);
                const fileExtension = localImagePath.split('.').pop();
                
                const safeName = (student.name || "unknown").replace(/[^a-z0-9]/gi, '_');
                const sRef = ref(storage, `photos/${Date.now()}_${safeName}.${fileExtension}`);
                
                const metadata = {
                    contentType: `image/${fileExtension.toLowerCase() === 'png' ? 'png' : 'jpeg'}`
                };
                
                // Convert Node Buffer to Uint8Array for Firebase Storage
                const uint8Array = new Uint8Array(fileBuffer);
                
                await uploadBytes(sRef, uint8Array, metadata);
                const downloadURL = await getDownloadURL(sRef);
                
                // Update Firestore document
                await updateDoc(doc(db, "students", document.id), {
                    photo_url: downloadURL
                });
                
                updatedCount++;
                console.log(`✅ Synced photo: ${student.featured_name || student.name}`);
            } catch (err) {
                console.error(`❌ Failed to sync photo for ${student.featured_name || student.name}:`, err.message);
            }
        }
    }
    
    console.log(`\n🎉 Image Sync Complete! Successfully uploaded ${updatedCount} local images to Firebase Storage.`);
    process.exit(0);
}

migrateImages();
