import React from 'react';
import { X, User, Calendar, BookOpen, MessageSquare, Download, Camera, Image as ImageIcon } from 'lucide-react';
import { getThumbnailUrl, calculateCountdown } from '../../utils.js';

export default function StudentDetailModal({ student, onClose, onUpdatePhoto, onGenerateCard }) {
  if (!student) return null;

  const thumbUrl = getThumbnailUrl(student);
  const countdown = calculateCountdown(student.birthday);
  
  let countdownHtml;
  if (countdown.isToday) {
      countdownHtml = <div className="countdown-badge today"><span className="bounce">🎉</span> Today is the day!</div>;
  } else if (countdown.days <= 7) {
      countdownHtml = <div className="countdown-badge soon">Coming up in {countdown.days} days!</div>;
  } else {
      countdownHtml = <div className="countdown-badge far">{countdown.text}</div>;
  }

  const whatsappMessage = encodeURIComponent(`Happy Birthday ${student.featured_name}! 🎉 Wishing you a fantastic day!`);
  const whatsappLink = `https://wa.me/94${student.whatsapp.substring(1)}?text=${whatsappMessage}`;

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => {
      if (e.target.className === 'modal-overlay') onClose();
    }}>
      <div className="modal-content">
        <button className="close-modal" onClick={onClose}>
          <X size={24} />
        </button>
        <div className="modal-header">
          <div className="modal-avatar-wrapper">
            <img 
              src={thumbUrl} 
              alt={student.featured_name} 
              className="modal-avatar"
              onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"; }}
            />
          </div>
          <h2>{student.featured_name}</h2>
          {countdownHtml}
        </div>
        <div className="modal-body">
          <div className="modal-data-table">
            <div className="data-row">
              <User size={16} className="data-icon" />
              <div className="data-content">
                <span className="data-label">Full Name</span>
                <span className="data-value">{student.name}</span>
              </div>
            </div>
            <div className="data-row">
              <Calendar size={16} className="data-icon" />
              <div className="data-content">
                <span className="data-label">Date of Birth</span>
                <span className="data-value">{student.birthday}</span>
              </div>
            </div>
            <div className="data-row">
              <BookOpen size={16} className="data-icon" />
              <div className="data-content">
                <span className="data-label">Course</span>
                <span className="data-value">{student.course}</span>
              </div>
            </div>
            <div className="data-row">
              <MessageSquare size={16} className="data-icon" />
              <div className="data-content">
                <span className="data-label">WhatsApp</span>
                <span className="data-value">{student.whatsapp}</span>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            {student.photo_url && student.photo_url.includes('drive.google.com') && (
              <a href={student.photo_url} target="_blank" rel="noopener noreferrer" className="secondary-btn">
                <i data-lucide="external-link"></i> Google Drive
              </a>
            )}
            <a href={thumbUrl} target="_blank" download={`${student.featured_name}_photo`} className="primary-btn download-btn">
              <Download size={20} /> Download
            </a>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="secondary-btn whatsapp-btn">
              <MessageSquare size={20} /> WhatsApp
            </a>
            <button className="secondary-btn edit-photo-btn" onClick={() => onUpdatePhoto(student)}>
              <Camera size={20} /> Update Photo
            </button>
            <button className="secondary-btn" onClick={() => onGenerateCard(student)}>
              <ImageIcon size={20} /> Generate Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
