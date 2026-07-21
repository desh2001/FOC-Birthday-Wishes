import React, { useState, useEffect } from 'react';
import { X, CalendarClock, Trash2, AlertCircle } from 'lucide-react';

export default function ScheduledMessagesModal({ onClose }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchScheduledJobs();
  }, []);

  const fetchScheduledJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/scheduled-cards');
      const data = await response.json();
      
      if (data.success) {
        setJobs(data.jobs);
        setError(null);
      } else {
        setError(data.message || 'Failed to load scheduled messages');
      }
    } catch (err) {
      console.error("Error fetching scheduled jobs:", err);
      setError("Could not connect to the WhatsApp Bot. Make sure it's running on port 3001.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled message?')) return;
    
    try {
      const response = await fetch(`http://localhost:3001/scheduled-cards/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        // Remove from list immediately
        setJobs(jobs.filter(job => job.id !== id));
      } else {
        alert(`Failed to cancel: ${data.message}`);
      }
    } catch (err) {
      console.error("Error canceling job:", err);
      alert("Network error: Could not cancel the scheduled message.");
    }
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '800px', width: '90%' }}>
        <div className="modal-header">
          <h2><CalendarClock size={20} /> Scheduled Messages</h2>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Loading scheduled messages...
                </div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <AlertCircle size={48} />
                    <p>{error}</p>
                </div>
            ) : jobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <CalendarClock size={64} style={{ opacity: 0.2 }} />
                    <h3>No Scheduled Messages</h3>
                    <p>When you schedule a birthday card, it will appear here until it gets sent.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {jobs.map(job => (
                        <div key={job.id} style={{ 
                            display: 'flex', 
                            gap: '20px', 
                            padding: '16px', 
                            background: 'var(--bg-surface)', 
                            border: '1px solid var(--border-glass)', 
                            borderRadius: 'var(--radius-md)',
                            alignItems: 'center'
                        }}>
                            <div style={{ 
                                width: '120px', 
                                height: '150px', 
                                borderRadius: 'var(--radius-sm)', 
                                overflow: 'hidden',
                                flexShrink: 0,
                                background: '#000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <img 
                                    src={job.imageUrl} 
                                    alt="Card Preview" 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                    onError={(e) => { e.target.style.display = 'none' }}
                                />
                            </div>
                            
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                                    Target Group: <span style={{ color: 'var(--color-accent)' }}>{job.targetGroup}</span>
                                </h3>
                                
                                <div style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px', 
                                    background: 'rgba(16, 185, 129, 0.1)', 
                                    color: '#10B981', 
                                    padding: '6px 12px', 
                                    borderRadius: '20px', 
                                    fontSize: '0.85rem', 
                                    fontWeight: 'bold',
                                    alignSelf: 'flex-start'
                                }}>
                                    <CalendarClock size={14} />
                                    {formatDateTime(job.scheduledTime)}
                                </div>
                                
                                <div style={{ 
                                    fontSize: '0.85rem', 
                                    color: 'var(--text-secondary)', 
                                    marginTop: '8px',
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '80px',
                                    overflowY: 'auto'
                                }}>
                                    {job.caption}
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => handleCancelJob(job.id)}
                                style={{ 
                                    background: 'rgba(239, 68, 68, 0.1)', 
                                    color: '#ef4444', 
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    padding: '10px 16px',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                            >
                                <Trash2 size={18} /> Cancel
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
