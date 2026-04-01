import { useState } from 'react';

export default function AdminPanel({ config, onConfigChange, onClose }) {
  const [newJob, setNewJob] = useState('');
  const [newEmpType, setNewEmpType] = useState('');
  const [newHonorific, setNewHonorific] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  async function addItem(endpoint, value, setter) {
    if (!value.trim()) return;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: value.trim() }),
    });
    if (res.ok) {
      onConfigChange(await res.json());
      setter('');
    }
  }

  async function removeItem(endpoint, id) {
    const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
    if (res.ok) onConfigChange(await res.json());
  }

  async function saveEdit(id) {
    if (!editingValue.trim()) return;
    const res = await fetch(`/api/config/honorifics/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: editingValue.trim() }),
    });
    if (res.ok) {
      onConfigChange(await res.json());
      setEditingId(null);
    }
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>הגדרות רשימות</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-grid settings-grid-3">

          <div className="settings-card">
            <h3>תפקידים</h3>
            <ul className="config-list">
              {config.jobs.map(job => (
                <li key={job.id}>
                  <span>{job.name}</span>
                  <button className="btn-remove" onClick={() => removeItem('/api/config/jobs', job.id)}>✕</button>
                </li>
              ))}
            </ul>
            <div className="config-add">
              <input
                value={newJob}
                onChange={e => setNewJob(e.target.value)}
                placeholder="תפקיד חדש..."
                onKeyDown={e => e.key === 'Enter' && addItem('/api/config/jobs', newJob, setNewJob)}
              />
              <button className="btn-primary" onClick={() => addItem('/api/config/jobs', newJob, setNewJob)}>הוסף</button>
            </div>
          </div>

          <div className="settings-card">
            <h3>סוגי העסקה</h3>
            <ul className="config-list">
              {config.employment_types.map(type => (
                <li key={type.id}>
                  <span>{type.name}</span>
                  <button className="btn-remove" onClick={() => removeItem('/api/config/employment-types', type.id)}>✕</button>
                </li>
              ))}
            </ul>
            <div className="config-add">
              <input
                value={newEmpType}
                onChange={e => setNewEmpType(e.target.value)}
                placeholder="סוג העסקה חדש..."
                onKeyDown={e => e.key === 'Enter' && addItem('/api/config/employment-types', newEmpType, setNewEmpType)}
              />
              <button className="btn-primary" onClick={() => addItem('/api/config/employment-types', newEmpType, setNewEmpType)}>הוסף</button>
            </div>
          </div>

          <div className="settings-card">
            <h3>תארים</h3>
            <ul className="config-list">
              {(config.honorifics || []).map(h => (
                <li key={h.id}>
                  {editingId === h.id ? (
                    <input
                      className="config-inline-edit"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(h.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span>{h.name}</span>
                  )}
                  <div className="config-item-actions">
                    {editingId === h.id ? (
                      <>
                        <button className="btn-save-inline" onClick={() => saveEdit(h.id)}>שמור</button>
                        <button className="btn-remove" onClick={() => setEditingId(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-edit-inline" onClick={() => { setEditingId(h.id); setEditingValue(h.name); }}>עריכה</button>
                        <button className="btn-remove" onClick={() => removeItem('/api/config/honorifics', h.id)}>✕</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="config-add">
              <input
                value={newHonorific}
                onChange={e => setNewHonorific(e.target.value)}
                placeholder="תואר חדש..."
                onKeyDown={e => e.key === 'Enter' && addItem('/api/config/honorifics', newHonorific, setNewHonorific)}
              />
              <button className="btn-primary" onClick={() => addItem('/api/config/honorifics', newHonorific, setNewHonorific)}>הוסף</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
