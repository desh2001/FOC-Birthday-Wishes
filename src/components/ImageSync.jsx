import React, { useState } from 'react';
import { Cloud, UploadCloud, CheckCircle } from 'lucide-react';
import { db, storage } from '../firebase.js';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getLocalImagePath } from '../data.js';

export default function ImageSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [isComplete, setIsComplete] = useState(false);

  const startSync = async () => {
    setIsSyncing(true);
    setProgress({ current: 0, total: '...', status: 'Connecting to Firestore...' });
    
    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const docsToSync = [];

      // Find all students that need a local image synced
      snapshot.forEach(document => {
        const student = document.data();
        const localPath = getLocalImagePath(student);
        // If they have a local path and their photo_url isn't already a firebase storage link
        if (localPath && (!student.photo_url || !student.photo_url.includes('firebasestorage'))) {
          docsToSync.push({ id: document.id, student, localPath });
        }
      });

      if (docsToSync.length === 0) {
        setProgress({ current: 0, total: 0, status: 'All images are already synced to the cloud!' });
        setIsComplete(true);
        setIsSyncing(false);
        return;
      }

      setProgress({ current: 0, total: docsToSync.length, status: 'Starting upload...' });

      let currentCount = 0;
      for (const item of docsToSync) {
        const { id, student, localPath } = item;
        
        try {
          // Fetch the local file from the public folder
          // Using a relative path which resolves to the Vite public directory
          const response = await fetch(`/${localPath}`);
          if (!response.ok) throw new Error('File not found locally');
          
          const blob = await response.blob();
          const fileExtension = localPath.split('.').pop() || 'jpg';
          const safeName = (student.name || "unknown").replace(/[^a-z0-9]/gi, '_');
          
          const sRef = storageRef(storage, `photos/${Date.now()}_${safeName}.${fileExtension}`);
          
          await uploadBytes(sRef, blob);
          const downloadURL = await getDownloadURL(sRef);
          
          await updateDoc(doc(db, "students", id), {
            photo_url: downloadURL
          });

          currentCount++;
          setProgress({ 
            current: currentCount, 
            total: docsToSync.length, 
            status: `Synced ${student.featured_name || student.name}...` 
          });

        } catch (err) {
          console.error(`Failed to sync ${student.name}:`, err);
        }
      }

      setProgress({ current: currentCount, total: docsToSync.length, status: 'Sync Complete!' });
      setIsComplete(true);
    } catch (error) {
      console.error("Sync error:", error);
      setProgress({ current: 0, total: 0, status: 'Error occurred during sync. Check console.' });
    }
    
    setIsSyncing(false);
  };

  if (isComplete) {
    return (
      <section className="glass-panel" style={{ padding: '20px', textAlign: 'center', marginBottom: '20px', borderLeft: '4px solid #10b981' }}>
        <CheckCircle size={32} color="#10b981" style={{ marginBottom: '10px' }} />
        <h3 style={{ margin: 0, color: '#10b981' }}>Cloud Synchronization Complete</h3>
        <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>All your profile pictures are now safely stored in Firebase Storage!</p>
      </section>
    );
  }

  return (
    <section className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: '#3b82f6' }}>
          <Cloud size={32} />
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Firebase Cloud Sync</h3>
          <p style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
            Your local images need to be uploaded to Firebase Storage so they work for everyone.
          </p>
        </div>
        <button 
          className="primary-btn" 
          onClick={startSync} 
          disabled={isSyncing}
          style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
        >
          {isSyncing ? 'Syncing...' : <><UploadCloud size={20} /> Start Sync</>}
        </button>
      </div>

      {isSyncing && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem' }}>
            <span>{progress.status}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--bg-glass)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${(progress.current / progress.total) * 100}%`, 
              background: 'var(--color-accent)',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
        </div>
      )}
    </section>
  );
}
