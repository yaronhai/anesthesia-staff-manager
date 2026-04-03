import { useState } from 'react';

export default function AdminPanel({ config, authToken, onConfigChange, onClose }) {
  const [newJob, setNewJob] = useState('');
  const [newEmpType, setNewEmpType] = useState('');
  const [newHonorific, setNewHonorific] = useState('');
  const [newSite, setNewSite] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  async function addItem(endpoint, value, setter) {
    if (!value.trim()) return;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ value: value.trim() }),
    });
    if (res.ok) {
      onConfigChange(await res.json());
      setter('');
    } else {
      const error = await res.json();
      alert('שגיאה: ' + (error.error || res.statusText));
    }
  }

  async function removeItem(endpoint, id) {
    const res = await fetch(`${endpoint}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) {
      onConfigChange(await res.json());
    } else {
      alert('שגיאה במחיקה');
    }
  }

  async function saveEdit(id) {
    if (!editingValue.trim()) return;
    const res = await fetch(`/api/config/honorifics/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ value: editingValue.trim() }),
    });
    if (res.ok) {
      onConfigChange(await res.json());
      setEditingId(null);
    } else {
      alert('שגיאה בשמירה');
    }
  }

  async function addSite() {
    console.log('addSite called, newSite:', newSite);
    if (!newSite.trim()) {
      alert('אנא הזן שם אתר');
      return;
    }
    try {
      const res = await fetch('/api/config/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: newSite.trim() }),
      });
      console.log('Add site response:', res.status, res.statusText);
      if (res.ok) {
        const data = await res.json();
        console.log('New config:', data);
        onConfigChange(data);
        setNewSite('');
        setSelectedSiteId(null);
        alert('אתר נוסף בהצלחה');
      } else {
        const error = await res.json();
        console.error('API error:', error);
        alert('שגיאה: ' + (error.error || res.statusText));
      }
    } catch (err) {
      console.error('Network error:', err);
      alert('שגיאת רשת: ' + err.message);
    }
  }

  async function removeSite(id) {
    const res = await fetch(`/api/config/sites/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) {
      onConfigChange(await res.json());
      if (selectedSiteId === id) setSelectedSiteId(null);
    } else {
      alert('שגיאה במחיקת אתר');
    }
  }

  async function addPosition() {
    if (!selectedSiteId || !newPosition.trim()) {
      alert('בחר אתר והזן שם תפקיד');
      return;
    }
    const res = await fetch(`/api/config/sites/${selectedSiteId}/positions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ position_name: newPosition.trim() }),
    });
    if (res.ok) {
      onConfigChange(await res.json());
      setNewPosition('');
    } else {
      const error = await res.json();
      alert('שגיאה: ' + (error.error || res.statusText));
    }
  }

  async function removePosition(siteId, positionId) {
    const res = await fetch(`/api/config/sites/${siteId}/positions/${positionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) {
      onConfigChange(await res.json());
    } else {
      alert('שגיאה במחיקת תפקיד');
    }
  }

  const selectedSite = config.sites?.find(s => s.id === selectedSiteId);
  const sitePositions = config.site_positions?.filter(p => p.site_id === selectedSiteId) || [];

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>הגדרות רשימות</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-grid settings-grid-5">

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

          <div className="settings-card">
            <h3>אתרים</h3>
            <ul className="config-list">
              {(config.sites || []).map(site => (
                <li key={site.id}>
                  <span>{site.name}</span>
                  <button className="btn-remove" onClick={() => removeSite(site.id)}>✕</button>
                </li>
              ))}
            </ul>
            <div className="config-add">
              <input
                value={newSite}
                onChange={e => setNewSite(e.target.value)}
                placeholder="אתר חדש..."
                onKeyDown={e => e.key === 'Enter' && addSite()}
              />
              <button className="btn-primary" onClick={addSite}>הוסף</button>
            </div>
          </div>

          <div className="settings-card">
            <h3>תפקידים באתר</h3>
            <div className="site-selector">
              <select value={selectedSiteId || ''} onChange={e => setSelectedSiteId(e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">בחר אתר...</option>
                {(config.sites || []).map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
            {selectedSite && (
              <>
                <ul className="config-list">
                  {sitePositions.map(pos => (
                    <li key={pos.id}>
                      <span>{pos.position_name}</span>
                      <button className="btn-remove" onClick={() => removePosition(selectedSiteId, pos.id)}>✕</button>
                    </li>
                  ))}
                </ul>
                <div className="config-add">
                  <input
                    value={newPosition}
                    onChange={e => setNewPosition(e.target.value)}
                    placeholder="תפקיד חדש..."
                    onKeyDown={e => e.key === 'Enter' && addPosition()}
                  />
                  <button className="btn-primary" onClick={addPosition}>הוסף</button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
