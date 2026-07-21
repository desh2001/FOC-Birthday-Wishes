import React from 'react';
import { Sparkles, Calendar, Gift, MessageCircle, User, Image as ImageIcon } from 'lucide-react';
import { getThumbnailUrl, calculateCountdown } from '../utils.js';

export default function Spotlight({ student, onStudentClick, onGenerateCard }) {
  if (!student) {
    return (
      <section className="spotlight-section">
        <h2 className="section-title"><Sparkles size={24} style={{ marginRight: '10px', color: 'var(--color-accent)' }} /> Birthday Spotlight</h2>
        <div className="spotlight-card glass-panel">
          <div className="skeleton-loader spotlight-skeleton"></div>
        </div>
      </section>
    );
  }

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
  
  const courseGlowClass = student.course ? `${student.course.toLowerCase()}-glow` : '';

  return (
    <section className="spotlight-section">
      <h2 className="section-title">
        <Sparkles size={24} style={{ marginRight: '10px', color: 'var(--color-accent)' }} /> 
        Birthday Spotlight
      </h2>
      <div className={`spotlight-card glass-panel ${courseGlowClass}`}>
        <div className="spotlight-avatar-area">
          <div className="spotlight-img-wrapper">
            <img 
              src={thumbUrl} 
              alt={student.featured_name} 
              className="spotlight-img"
              onError={(e) => { 
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            <div className="spotlight-img-fallback" style={{ display: 'none' }}>
              <User size={48} />
            </div>
          </div>
          <div className="spotlight-badge-container">
            {student.course && (
              <span className={`badge ${student.course.toLowerCase()}`}>{student.course}</span>
            )}
            {student.gender && (
              <span className={`badge ${student.gender.toLowerCase()}`}>{student.gender}</span>
            )}
          </div>
        </div>
        
        <div className="spotlight-info-area">
          {countdownHtml}
          
          <div className="spotlight-title-group">
            <h3>{student.featured_name}</h3>
            <p>{student.name}</p>
          </div>
          
          <div className="spotlight-details">
            <div className="detail-item">
              <span className="detail-label">Birthday</span>
              <span className="detail-value">{student.birthday}</span>
            </div>
            {student.whatsapp && (
              <div className="detail-item">
                <span className="detail-label">WhatsApp</span>
                <span className="detail-value">{student.whatsapp}</span>
              </div>
            )}
          </div>

          <div className="spotlight-actions">
            <button className="primary-btn" onClick={() => onStudentClick(student)}>
              <Gift size={18} style={{ marginRight: '8px' }} /> Wish Now
            </button>
            <button className="secondary-btn" onClick={() => onGenerateCard(student)}>
              <ImageIcon size={18} style={{ marginRight: '8px' }} /> Generate Card
            </button>
            {student.whatsapp && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="secondary-btn whatsapp-btn" title="Message on WhatsApp" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none' }}>
                <MessageCircle size={20} style={{ marginRight: '8px' }}/> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
