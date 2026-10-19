import React, { useState, useEffect } from 'react';
import { X, CalendarClock, Trash2, AlertCircle, Send, Edit2, Check } from 'lucide-react';
import { BOT_API_URL, getAdminKey, setAdminKey } from '../../utils.js';

export default function ScheduledMessagesModal({ onClose }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [editingJobId, setEditingJobId] = useState(null);
  const [editGroupValue, setEditGroupValue] = useState('');
  const [savingGroupId, setSavingGroupId] = useState(null);

  const fetchScheduledJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BOT_API_URL}/scheduled-cards`);
      const data = await response.json();
      
      if (data.success) {
        setJobs(data.jobs);
        setError(null);
      } else {
        setError(data.message || 'Failed to load scheduled messages');
      }
    } catch (err) {
      console.error("Error fetching scheduled jobs:", err);
      setError(`Could not connect to the WhatsApp Bot at ${BOT_API_URL}. Make sure it's running.`);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${BOT_API_URL}/groups`);
      const data = await response.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups);
      }
    } catch (e) {
      console.warn("Could not load groups list in modal:", e);
    }
  };

  useEffect(() => {
    fetchScheduledJobs();
    fetchGroups();
  }, []);

  const handleUpdateTargetGroup = async (id, newGroup) => {
    if (!newGroup || !newGroup.trim()) return;
    try {
      setSavingGroupId(id);
      let adminKey = getAdminKey();
      let response = await fetch(`${BOT_API_URL}/scheduled-cards/${id}/target-group`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(adminKey && { 'x-admin-key': adminKey }) 
        },
        body: JSON.stringify({ targetGroup: newGroup.trim() })
      });

      if (response.status === 401) {
        const enteredKey = prompt("Updating requires Admin Key. Please enter it:");
        if (enteredKey) {
          setAdminKey(enteredKey);
          response = await fetch(`${BOT_API_URL}/scheduled-cards/${id}/target-group`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'x-admin-key': enteredKey.trim() 
            },
            body: JSON.stringify({ targetGroup: newGroup.trim() })
          });
        }
      }

      const data = await response.json();
      if (data.success) {
        setJobs(jobs.map(j => j.id === id ? { ...j, targetGroup: newGroup.trim() } : j));
        setEditingJobId(null);
      } else {
        alert(`Failed to update group: ${data.message}`);
      }
    } catch (err) {
      console.error("Error updating target group:", err);
      alert("Network error: Could not update target group.");
    } finally {
      setSavingGroupId(null);
    }
  };

  const handleCancelJob = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled message?')) return;
    
    try {
      let adminKey = getAdminKey();
      let response = await fetch(`${BOT_API_URL}/scheduled-cards/${id}`, {
        method: 'DELETE',
        headers: { ...(adminKey && { 'x-admin-key': adminKey }) }
      });

      if (response.status === 401) {
        const enteredKey = prompt("Canceling a scheduled message requires the Admin Key. Please enter it:");
        if (enteredKey) {
          setAdminKey(enteredKey);
          response = await fetch(`${BOT_API_URL}/scheduled-cards/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-key': enteredKey.trim() }
          });
        }
      }

      const data = await response.json();
      
      if (data.success) {
        setJobs(jobs.filter(job => job.id !== id));
      } else {
        alert(`Failed to cancel: ${data.message}`);
      }
    } catch (err) {
      console.error("Error canceling job:", err);
      alert("Network error: Could not cancel the scheduled message.");
    }
  };

  const [sendingId, setSendingId] = useState(null);

  const handleSendNow = async (id, targetGroupName) => {
    const job = jobs.find(j => j.id === id);
    const groupToUse = targetGroupName || (job ? job.targetGroup : 'group');
    if (!window.confirm(`Send this card to WhatsApp group "${groupToUse}" right now?`)) return;
    try {
      setSendingId(id);
      let adminKey = getAdminKey();
      let response = await fetch(`${BOT_API_URL}/scheduled-cards/${id}/send-now`, {
        method: 'POST',
        headers: { ...(adminKey && { 'x-admin-key': adminKey }) }
      });

      if (response.status === 401) {
        const enteredKey = prompt("Sending requires the Admin Key. Please enter it:");
        if (enteredKey) {
          setAdminKey(enteredKey);
          response = await fetch(`${BOT_API_URL}/scheduled-cards/${id}/send-now`, {
            method: 'POST',
            headers: { 'x-admin-key': enteredKey.trim() }
          });
        }
      }

      const data = await response.json();
      if (data.success) {
        alert(data.message || 'Card sent to group successfully!');
        setJobs(jobs.filter(job => job.id !== id));
      } else {
        // If the group was not found and we have the list of detected groups, help the user pick
        if (data.availableGroups && data.availableGroups.length > 0) {
          const groupNames = data.availableGroups.map(g => `• ${g.name}`).join('\n');
          const chosen = prompt(
            `${data.message}\n\nAvailable WhatsApp Groups on your phone:\n${groupNames}\n\nEnter the correct group name to update and send now:`,
            data.availableGroups[0]?.name || ''
          );
          if (chosen && chosen.trim()) {
            await handleUpdateTargetGroup(id, chosen.trim());
            // Retry send immediately with the new group
            return handleSendNow(id, chosen.trim());
          }
        } else {
          alert(`Failed to send: ${data.message}`);
        }
      }
    } catch (err) {
      console.error("Error sending card now:", err);
      alert("Network error: Could not send the card.");
    } finally {
      setSendingId(null);
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>
                                        Target Group:
                                    </h3>
                                    {editingJobId === job.id ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <input
                                                type="text"
                                                list="modal-groups-list"
                                                value={editGroupValue}
                                                onChange={(e) => setEditGroupValue(e.target.value)}
                                                placeholder="Select or enter group name..."
                                                style={{
                                                    background: 'rgba(0,0,0,0.5)',
                                                    border: '1px solid var(--color-accent)',
                                                    borderRadius: '6px',
                                                    padding: '4px 10px',
                                                    color: '#fff',
                                                    fontSize: '0.9rem',
                                                    minWidth: '180px'
                                                }}
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleUpdateTargetGroup(job.id, editGroupValue)}
                                                disabled={savingGroupId === job.id}
                                                title="Save Group"
                                                style={{
                                                    background: 'rgba(16, 185, 129, 0.2)',
                                                    border: '1px solid #10B981',
                                                    color: '#10B981',
                                                    borderRadius: '6px',
                                                    padding: '6px 8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button
                                                onClick={() => setEditingJobId(null)}
                                                title="Cancel Edit"
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                    border: '1px solid #ef4444',
                                                    color: '#ef4444',
                                                    borderRadius: '6px',
                                                    padding: '6px 8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{job.targetGroup}</span>
                                            <button
                                                onClick={() => {
                                                    setEditingJobId(job.id);
                                                    setEditGroupValue(job.targetGroup);
                                                }}
                                                title="Change Target WhatsApp Group"
                                                style={{
                                                    background: 'rgba(255,255,255,0.06)',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    padding: '3px 6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontSize: '0.75rem'
                                                }}
                                            >
                                                <Edit2 size={12} /> Edit
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
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
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                              <button 
                                  onClick={() => handleSendNow(job.id)}
                                  disabled={sendingId === job.id}
                                  style={{ 
                                      background: 'rgba(16, 185, 129, 0.15)', 
                                      color: '#10B981', 
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      padding: '8px 14px',
                                      borderRadius: 'var(--radius-sm)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      fontSize: '0.85rem',
                                      opacity: sendingId === job.id ? 0.6 : 1,
                                      transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)' }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)' }}
                              >
                                  <Send size={16} /> {sendingId === job.id ? 'Sending...' : 'Send Now'}
                              </button>
                              <button 
                                  onClick={() => handleCancelJob(job.id)}
                                  style={{ 
                                      background: 'rgba(239, 68, 68, 0.1)', 
                                      color: '#ef4444', 
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      padding: '8px 14px',
                                      borderRadius: 'var(--radius-sm)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      fontSize: '0.85rem',
                                      transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                              >
                                  <Trash2 size={16} /> Cancel
                              </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        
        <datalist id="modal-groups-list">
          {groups.map(g => (
            <option key={g.id} value={g.name}>
              {g.name}
            </option>
          ))}
        </datalist>
      </div>
    </div>
  );
}
