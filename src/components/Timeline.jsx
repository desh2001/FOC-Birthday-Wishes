import React from 'react';
import { Hourglass } from 'lucide-react';
import { getThumbnailUrl, calculateCountdown } from '../utils.js';

export default function Timeline({ upcomingStudents, onStudentClick }) {
  if (!upcomingStudents || upcomingStudents.length === 0) {
    return (
      <section className="timeline-section">
        <h2 className="section-title"><Hourglass size={24} style={{ marginRight: '10px', color: 'var(--color-accent)' }} /> Coming Up Next</h2>
        <div className="timeline-container">
          <div className="skeleton-loader timeline-skeleton"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="timeline-section">
      <h2 className="section-title">
        <Hourglass size={24} style={{ marginRight: '10px', color: 'var(--color-accent)' }} /> 
        Coming Up Next
      </h2>
      <div className="timeline-container">
        {upcomingStudents.map((student, index) => {
          const thumbUrl = getThumbnailUrl(student);
          const countdown = calculateCountdown(student.birthday);
          
          let daysClass = '';
          if (countdown.isToday) daysClass = 'today';
          else if (countdown.days <= 7) daysClass = 'soon';
          else daysClass = 'far';

          return (
            <div 
              key={student.id || student.name + index} 
              className="timeline-card" 
              onClick={() => onStudentClick(student)}
            >
              <img 
                src={thumbUrl} 
                alt={student.featured_name} 
                onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"; }}
              />
              <div className="timeline-info">
                <h4>{student.featured_name}</h4>
                <span className="timeline-date">{student.birthday}</span>
                <span className={`timeline-days ${daysClass}`}>{countdown.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
