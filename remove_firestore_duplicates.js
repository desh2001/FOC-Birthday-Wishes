import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCj_2hn0T6R9Ye2N51iW_rA8I7J9C9Abbo",
  authDomain: "foc-birthday-450f1.firebaseapp.com",
  projectId: "foc-birthday-450f1",
  storageBucket: "foc-birthday-450f1.firebasestorage.app",
  messagingSenderId: "545529443768",
  appId: "1:545529443768:web:025b475edd2cee40b38b4d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function removeDuplicates() {
  console.log("Fetching documents...");
  const studentsRef = collection(db, 'students');
  const snapshot = await getDocs(studentsRef);
  
  const docs = [];
  snapshot.forEach(d => {
    docs.push({ id: d.id, ...d.data() });
  });
  
  console.log(`Found ${docs.length} documents in Firestore.`);
  
  const uniqueMap = new Map();
  const duplicateIds = [];
  
  docs.forEach(student => {
    const key = (student.name || '').trim().toLowerCase() + '|' + (student.birthday || '').trim();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, student);
    } else {
      duplicateIds.push(student.id);
    }
  });
  
  console.log(`Found ${duplicateIds.length} duplicate documents. Deleting them...`);
  
  let deletedCount = 0;
  for (const id of duplicateIds) {
    await deleteDoc(doc(db, 'students', id));
    deletedCount++;
    if (deletedCount % 10 === 0) {
      console.log(`Deleted ${deletedCount} / ${duplicateIds.length}...`);
    }
  }
  
  console.log("Finished deleting duplicates.");
  process.exit(0);
}

removeDuplicates().catch(console.error);
