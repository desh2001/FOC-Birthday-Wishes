import React, { useState, useRef } from 'react';
import { X, User, Sparkles, Calendar as CalendarIcon, Phone, BookOpen, UserCircle, UploadCloud, Link } from 'lucide-react';
import { BOT_API_URL, getAdminKey } from '../../utils.js';

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

  // Save image to local disk via the whatsapp-bot Express server
  const saveImageLocally = async (base64, name, featured_name) => {
    try {
      const response = await fetch(`${BOT_API_URL}/save-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, name, featured_name }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.localPath || null;
      }
    } catch {
      console.warn('Local image save skipped — backend API not available.');
    }
    return null;
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
        localPath = await saveImageLocally(compressedBase64, formData.name, formData.featured_name);
        finalUrl = localPath || '';
      } else if (method === 'url') {
        finalUrl = photoUrl.trim();
      }

      // Format date YYYY-MM-DD to DD/MM/YYYY
      const parts = formData.birthday.split('-');
      const formattedBirthday = `${parts[2]}/${parts[1]}/${parts[0]}`;

      const newStudent = {
        name: formData.name.trim(),
        featured_name: formData.featured_name.trim(),
        birthday: formattedBirthday,
        whatsapp: formData.whatsapp.trim(),
        course: formData.course,
        gender: formData.gender,
        photo_url: finalUrl,
        local_photo_path: localPath || (finalUrl.startsWith('/img/') ? finalUrl : '')
      };

      const adminKey = getAdminKey();
      const response = await fetch(`${BOT_API_URL}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminKey && { 'x-admin-key': adminKey })
        },
        body: JSON.stringify(newStudent)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save student record');
      }

      if (onBirthdayAdded) onBirthdayAdded();
      onClose();
      alert(`Successfully added ${formData.featured_name}'s birthday! 🎉`);
    } catch (err) {
      console.error('Error adding birthday:', err);
      alert('Failed to add birthday: ' + err.message);
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

        <form onSubmit={handleSubmit} className="modal-body-form">
          <div className="form-group">
            <label><User size={16} /> Full Name</label>
            <input 
              type="text" 
              name="name" 
              placeholder="e.g. W.D. Chamindu Sandeepa Gunathunga" 
              value={formData.name} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="form-group">
            <label><Sparkles size={16} /> Featured / Short Name (Shown on Cards)</label>
            <input 
              type="text" 
              name="featured_name" 
              placeholder="e.g. Chamindu Sandeepa" 
              value={formData.featured_name} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label><CalendarIcon size={16} /> Date of Birth</label>
              <input 
                type="date" 
                name="birthday" 
                value={formData.birthday} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label><Phone size={16} /> WhatsApp Number</label>
              <input 
                type="tel" 
                name="whatsapp" 
                placeholder="e.g. 0771234567" 
                value={formData.whatsapp} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label><BookOpen size={16} /> Degree Programme</label>
              <select name="course" value={formData.course} onChange={handleChange}>
                <option value="SE">Software Engineering (SE)</option>
                <option value="CS">Computer Science (CS)</option>
                <option value="IS">Information Systems (IS)</option>
                <option value="DS">Data Science (DS)</option>
              </select>
            </div>
            <div className="form-group">
              <label><UserCircle size={16} /> Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div className="form-group photo-upload-group">
            <label>Profile Picture</label>
            <div className="segmented-control">
              <button 
                type="button" 
                className={`segment-btn ${method === 'upload' ? 'active' : ''}`}
                onClick={() => setMethod('upload')}
              >
                <UploadCloud size={16} /> Upload Image
              </button>
              <button 
                type="button" 
                className={`segment-btn ${method === 'url' ? 'active' : ''}`}
                onClick={() => setMethod('url')}
              >
                <Link size={16} /> Image Link
              </button>
            </div>

            {method === 'upload' ? (
              <div className="file-dropzone" onClick={() => fileInputRef.current.click()}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/jpeg,image/png,image/webp" 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange} 
                />
                {previewSrc ? (
                  <div className="preview-container">
                    <img src={previewSrc} alt="Preview" className="image-preview" />
                    <span>Click to change: {fileName}</span>
                  </div>
                ) : (
                  <div className="dropzone-placeholder">
                    <UploadCloud size={32} />
                    <span>Select an image (Max 10MB)</span>
                  </div>
                )}
              </div>
            ) : (
              <input 
                type="url" 
                placeholder="Direct image URL or Google Drive link" 
                value={photoUrl} 
                onChange={(e) => setPhotoUrl(e.target.value)} 
              />
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary-btn submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Birthday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
