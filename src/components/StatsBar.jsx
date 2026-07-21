import React, { useMemo } from 'react';
import { Users, Gift, Award } from 'lucide-react';
import { calculateCountdown } from '../utils.js';

export default function StatsBar({ students }) {
  const stats = useMemo(() => {
    const total = students.length;
    let thisMonth = 0;
    let cs = 0;
    let se = 0;
    let is = 0;
    let minDaysToNext = null;

    const currentMonth = new Date().getMonth(); // 0-indexed

    students.forEach(student => {
      // Course counts
      if (student.course === 'CS') cs++;
      if (student.course === 'SE') se++;
      if (student.course === 'IS') is++;

      // This month
      if (student.birthday) {
        const parts = student.birthday.split('/');
        if (parts.length === 3) {
          const m = parseInt(parts[1], 10) - 1;
          if (m === currentMonth) thisMonth++;
        }
      }

      // Next birthday countdown
      const countdown = calculateCountdown(student.birthday);
      if (countdown && (minDaysToNext === null || countdown.days < minDaysToNext)) {
        minDaysToNext = countdown.days;
      }
    });

    return {
      total,
      thisMonth,
      cs,
      se,
      is,
      nextDays: minDaysToNext !== null ? minDaysToNext : 0
    };
  }, [students]);

  return (
    <section className="stats-section">
      <div className="stat-card">
        <div className="stat-icon cs-color"><Users size={24} /></div>
        <div className="stat-info">
          <h3>{stats.total}</h3>
          <p>Total Members</p>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon se-color"><Gift size={24} /></div>
        <div className="stat-info">
          <h3>{stats.thisMonth}</h3>
          <p>Birthdays This Month</p>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon is-color"><Award size={24} /></div>
        <div className="stat-info">
          <h3>{stats.nextDays}</h3>
          <p>Days to Next Birthday</p>
        </div>
      </div>
      <div className="stat-card course-distribution">
        <div className="course-stat">
          <span className="badge cs">CS</span>
          <span>{stats.cs}</span>
        </div>
        <div className="course-stat">
          <span className="badge se">SE</span>
          <span>{stats.se}</span>
        </div>
        <div className="course-stat">
          <span className="badge is">IS</span>
          <span>{stats.is}</span>
        </div>
      </div>
    </section>
  );
}
