import React, { useEffect, useState } from 'react';
import { Cake, Plus, Calendar, Moon, Sun, CalendarClock } from 'lucide-react';

export default function Header({ onAddClick, onViewScheduledClick }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [currentDate, setCurrentDate] = useState('Loading date...');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(today.toLocaleDateString('en-US', options));
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="main-header glass-panel" style={{ padding: '20px 24px', borderRadius: 'var(--radius-lg)', borderBottom: 'none' }}>
      <div className="logo-area">
        <div className="logo-icon pulse-animation" style={{ background: 'var(--gradient-hero)' }}>
          <Cake size={28} color="white" />
        </div>
        <div className="logo-text">
          <h1>FOC Birthday <span>Portal</span></h1>
          <p>Celebrating the Faculty of Computing Family</p>
        </div>
      </div>
      
      <div className="header-actions">
        <button className="secondary-btn header-scheduled-btn" onClick={onViewScheduledClick}>
          <CalendarClock size={20} />
          <span className="btn-label">Scheduled</span>
        </button>
        <button className="primary-btn add-birthday-header-btn" onClick={onAddClick}>
          <Plus size={20} />
          <span className="btn-label">Add Birthday</span>
        </button>
        <div className="current-date-badge">
          <Calendar size={18} />
          <span>{currentDate}</span>
        </div>
        <button 
          className="icon-btn" 
          aria-label="Toggle Theme"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={20} className="sun-icon" /> : <Moon size={20} className="moon-icon" />}
        </button>
      </div>
    </header>
  );
}
