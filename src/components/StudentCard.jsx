import React from 'react';
import { Calendar, Cake, User } from 'lucide-react';
import { getThumbnailUrl, calculateCountdown } from '../utils.js';

export default function StudentCard({ student, onClick }) {
  const thumbUrl = getThumbnailUrl(student);
  const countdown = calculateCountdown(student.birthday);
  
  let countdownClass = 'card-upcoming-tag ';
  if (countdown.isToday || countdown.days <= 7) {
    countdownClass += 'imminent';
  }

  const courseClass = student.course ? `${student.course.toLowerCase()}-card` : '';

  return (
    <div className={`student-card ${courseClass}`} onClick={() => onClick(student)}>
      <div className="card-image-area">
        <img 
          src={thumbUrl} 
          alt={student.featured_name} 
          className="card-img" 
          onError={(e) => { 
            e.target.style.display = 'none';
            e.target.nextElementSibling.style.display = 'flex';
          }}
        />
        <div className="card-img-fallback" style={{ display: 'none' }}>
          <User size={36} />
        </div>
        
        <div className="card-badges">
          {student.course && (
            <span className={`badge ${student.course.toLowerCase()}`}>{student.course}</span>
          )}
          {student.gender && (
            <span className={`badge ${student.gender.toLowerCase()}`}>{student.gender}</span>
          )}
        </div>
        
        <div className={countdownClass}>
          {countdown.isToday ? 'Today!' : `${countdown.days} days left`}
        </div>
      </div>
      
      <div className="card-content">
        <div className="card-info">
          <h3>{student.featured_name}</h3>
          <p>{student.name}</p>
        </div>
        
        <div className="card-meta">
          <div className="card-meta-item">
            <Calendar size={14} />
            <span>{student.birthday}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
