import React, { useState, useRef } from 'react';
import { X, User, Sparkles, Calendar as CalendarIcon, Phone, BookOpen, UserCircle, UploadCloud, Link } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase.js';

export default function AddBirthdayModal({ onClose, onBirthdayAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    featured_name: '',
    birthday: '',
    whatsapp: '',
    course: 'SE',
    gender: 'Male',
  });
  const [method, setMethod] = useState('upload');
  const [photoUrl, setPhotoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [previewSrc, setPreviewSrc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef(null);

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

  // Save image to local disk via the whatsapp-bot Express server (port 3001).
  // Silent — if the bot isn't running, this is a no-op and Firebase Storage is used instead.
  const saveImageLocally = async (base64, name, featured_name) => {
    try {
      const response = await fetch('http://localhost:3001/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, name, featured_name }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.localPath || null; // e.g. "/img/Pasindu - Pasindu Udana.jpeg"
      }
    } catch {
      console.warn('Local image save skipped — whatsapp-bot server not running.');
    }
    return null;
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      setFileName(selected.name);
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewSrc(ev.target.result);
      reader.readAsDataURL(selected);
    } else {
      setFile(null);
      setFileName('No file chosen');
      setPreviewSrc('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.featured_name || !formData.birthday || !formData.whatsapp) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    let finalUrl = '';
    let localPath = null;
    
    try {
      if (method === 'upload' && file) {
        const compressedBase64 = await compressImage(file);
        // 1. Save locally to public/img/ (requires whatsapp-bot to be running)
        localPath = await saveImageLocally(compressedBase64, formData.name, formData.featured_name);
        // 2. Upload to Firebase Storage as cloud backup
        finalUrl = await uploadBase64ToFirebase(compressedBase64, formData.name);
      } else if (method === 'url') {
        finalUrl = photoUrl.trim();
      }

      // Format date YYYY-MM-DD to DD/MM/YYYY
      const parts = formData.birthday.split('-');
      const formattedBirthday = `${parts[2]}/${parts[1]}/${parts[0]}`;

      const newStudent = {
        timestamp: new Date().toLocaleString('en-GB'),
        name: formData.name.trim(),
        featured_name: formData.featured_name.trim(),
        birthday: formattedBirthday,
        whatsapp: formData.whatsapp.trim(),
        course: formData.course,
        gender: formData.gender,
        photo_url: finalUrl,
        ...(localPath && { local_photo_path: localPath }), // store local path if saved
      };

      await addDoc(collection(db, 'students'), newStudent);
      onBirthdayAdded();
      onClose();
      alert(`Successfully added ${formData.featured_name}'s birthday! 🎉`);
    } catch (err) {
      console.error('Error adding birthday:', err);
      alert('Failed to add birthday.');
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
          <h2>Add New Birthday</h2>
          <p className="subtitle">Register a new FOC member to the portal</p>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="premium-form">
            <div className="form-group">
              <label><User size={16} className="input-icon"/> Full Name *</label>
              <input type="text" name="name" required placeholder="e.g. Pasindu Udana Mendis" value={formData.name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label><Sparkles size={16} className="input-icon"/> Preferred/Featured Name *</label>
              <input type="text" name="featured_name" required placeholder="e.g. Pasindu Udana" value={formData.featured_name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label><CalendarIcon size={16} className="input-icon"/> Date of Birth *</label>
              <input type="date" name="birthday" required value={formData.birthday} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label><Phone size={16} className="input-icon"/> WhatsApp Number *</label>
              <input type="tel" name="whatsapp" required placeholder="e.g. 0719367720" value={formData.whatsapp} onChange={handleChange} />
            </div>
            
            <div className="form-row">
              <div className="form-group half">
                <label><BookOpen size={16} className="input-icon"/> Course</label>
                <select name="course" value={formData.course} onChange={handleChange}>
                  <option value="SE">Software Engineering</option>
                  <option value="CS">Computer Science</option>
                  <option value="IS">Information Systems</option>
                </select>
              </div>
              <div className="form-group half">
                <label><UserCircle size={16} className="input-icon"/> Gender</label>
                <select name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="form-group photo-section">
              <label>Profile Photo</label>
              <div className="radio-group">
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
                  {previewSrc && (
                    <div className="photo-edit-preview-container" style={{ marginTop: '12px' }}>
                      <img src={previewSrc} alt="Preview" className="photo-edit-preview" />
                    </div>
                  )}
                </div>
              )}

              {method === 'url' && (
                <div className="form-group">
                  <label>Google Drive Link</label>
                  <input type="url" placeholder="https://drive.google.com/open?id=..." value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
                </div>
              )}
            </div>

            <button type="submit" className="primary-btn submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Add Birthday Record'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
