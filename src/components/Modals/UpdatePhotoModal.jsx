import React, { useState, useRef } from 'react';
import { X, UploadCloud, Link } from 'lucide-react';
import { getThumbnailUrl } from '../../utils.js';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase.js';

export default function UpdatePhotoModal({ student, onClose, onPhotoUpdated }) {
  const [method, setMethod] = useState('upload');
  const [photoUrl, setPhotoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  if (!student) return null;

  const thumbUrl = getThumbnailUrl(student);

  const compressImage = (file, maxWidth = 480, maxHeight = 480, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const uploadBase64ToFirebase = async (base64String, studentName) => {
    const byteString = atob(base64String.split(',')[1]);
    const mimeString = base64String.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], {type: mimeString});
    const sRef = storageRef(storage, `photos/${Date.now()}_${studentName.replace(/[^a-z0-9]/gi, '_')}.jpg`);
    await uploadBytes(sRef, blob);
    return await getDownloadURL(sRef);
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    } else {
      setFile(null);
      setFileName('No file chosen');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    let finalUrl = '';
    try {
      if (method === 'upload') {
        if (!file) {
          alert('Please select an image file.');
          setIsSubmitting(false);
          return;
        }
        const compressedBase64 = await compressImage(file);
        finalUrl = await uploadBase64ToFirebase(compressedBase64, student.name);
      } else {
        finalUrl = photoUrl.trim();
        if (!finalUrl) {
          alert('Please enter a valid URL.');
          setIsSubmitting(false);
          return;
        }
      }

      // Update Firestore
      if (student.id) {
        const studentDocRef = doc(db, 'students', student.id);
        await updateDoc(studentDocRef, { photo_url: finalUrl });
      } else {
        // Fallback if data hasn't been uploaded yet or id is missing
        alert('Cannot update photo because this student record is not properly synced to Firebase yet.');
      }

      onPhotoUpdated(finalUrl);
      onClose();
    } catch (err) {
      console.error('Error updating photo:', err);
      alert('Failed to update photo.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => {
      if (e.target.className === 'modal-overlay') onClose();
    }}>
      <div className="modal-content">
        <button className="close-modal" onClick={onClose}><X size={24} /></button>
        <div className="modal-header">
          <h2>Update Profile Photo</h2>
          <p className="subtitle">Upload a new image or link a Google Drive photo</p>
        </div>
        <div className="modal-body">
          <div className="photo-edit-preview-container">
            <img 
              src={thumbUrl} 
              alt="Preview" 
              className="photo-edit-preview" 
              onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"; }}
            />
            <h3 id="photo-edit-name">{student.featured_name}</h3>
          </div>
          <form onSubmit={handleSubmit} className="premium-form">
            <div className="form-group radio-group">
              <label className="radio-label">
                <input type="radio" value="upload" checked={method === 'upload'} onChange={() => setMethod('upload')} />
                <span className="radio-custom"><UploadCloud size={16}/> Upload File</span>
              </label>
              <label className="radio-label">
                <input type="radio" value="url" checked={method === 'url'} onChange={() => setMethod('url')} />
                <span className="radio-custom"><Link size={16}/> Drive URL</span>
              </label>
            </div>

            {method === 'upload' && (
              <div className="form-group">
                <label className="file-upload-label" onClick={() => fileInputRef.current.click()}>
                  <UploadCloud size={24} /> Select Image File
                </label>
                <input type="file" style={{ display: 'none' }} accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
                <span className="file-name-indicator">{fileName}</span>
              </div>
            )}

            {method === 'url' && (
              <div className="form-group">
                <label>Google Drive Link</label>
                <input type="url" placeholder="https://drive.google.com/open?id=..." value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
              </div>
            )}

            <button type="submit" className="primary-btn submit-btn" style={{ width: '100%', marginTop: '16px' }} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
