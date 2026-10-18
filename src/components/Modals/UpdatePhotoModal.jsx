import React, { useState, useRef } from 'react';
import { X, UploadCloud, Link } from 'lucide-react';
import { getThumbnailUrl, BOT_API_URL, getAdminKey } from '../../utils.js';

export default function UpdatePhotoModal({ student, onClose, onPhotoUpdated }) {
  const [method, setMethod] = useState('upload');
  const [photoUrl, setPhotoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [previewSrc, setPreviewSrc] = useState(''); // live preview before upload
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
    setIsSubmitting(true);

    let finalUrl;
    let localPath = null;
    try {
      if (method === 'upload') {
        if (!file) {
          alert('Please select an image file.');
          setIsSubmitting(false);
          return;
        }
        const compressedBase64 = await compressImage(file);
        localPath = await saveImageLocally(compressedBase64, student.name, student.featured_name);
        finalUrl = localPath || '';
      } else {
        finalUrl = photoUrl.trim();
        if (!finalUrl) {
          alert('Please enter a valid URL.');
          setIsSubmitting(false);
          return;
        }
      }

      const adminKey = getAdminKey();
      const response = await fetch(`${BOT_API_URL}/students/${student.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(adminKey && { 'x-admin-key': adminKey })
        },
        body: JSON.stringify({
          photo_url: finalUrl,
          local_photo_path: localPath || (finalUrl.startsWith('/img/') ? finalUrl : null)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update student photo');
      }

      onPhotoUpdated(finalUrl);
      onClose();
    } catch (err) {
      console.error('Error updating photo:', err);
      alert('Failed to update photo: ' + err.message);
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
          <h2>Update Photo</h2>
          <p className="subtitle">Change profile picture for {student.featured_name}</p>
        </div>

        <div className="current-photo-preview" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img 
            src={previewSrc || thumbUrl} 
            alt="Current" 
            style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)' }}
            onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"; }}
          />
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '5px' }}>
            {previewSrc ? 'New Image Preview' : 'Current Photo'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="modal-body-form">
          <div className="form-group photo-upload-group">
            <div className="segmented-control">
              <button 
                type="button" 
                className={`segment-btn ${method === 'upload' ? 'active' : ''}`}
                onClick={() => setMethod('upload')}
              >
                <UploadCloud size={16} /> Upload New Image
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
              {isSubmitting ? 'Saving...' : 'Save Photo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
