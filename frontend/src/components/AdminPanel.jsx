import { useState } from 'react';

export default function AdminPanel({ config, authToken, onConfigChange, onClose }) {
  const [newJob, setNewJob] = useState('');
  const [newEmpType, setNewEmpType] = useState('');
  const [newHonorific, setNewHonorific] = useState('');
  const [newSite, setNewSite] = useState('');
  const [newSiteGroup, setNewSiteGroup] = useState('');
  const [newActivityType, setNewActivityType] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedActivityAuths, setExpandedActivityAuths] = useState({});
  const [expandedSections, setExpandedSections] = useState({ groups: true, sites: true, jobs: false, empTypes: false, honorifics: false, activities: false, workerAuths: false });

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

  async function saveEdit(endpoint, id) {
    if (!editingValue.trim()) return;
    const res = await fetch(`${endpoint}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ value: editingValue.trim() }),
    });
    if (res.ok) {
      onConfigChange(await res.json());
      setEditingKey(null);
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
    } else {
      alert('שגיאה במחיקת אתר');
    }
  }

  async function updateSiteGroup(siteId, groupId) {
    const res = await fetch(`/api/config/sites/${siteId}/group`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ group_id: groupId || null }),
    });
    if (res.ok) {
      onConfigChange(await res.json());
    } else {
      alert('שגיאה בעדכון קבוצה');
    }
  }

  function toggleSection(section) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }


  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>הגדרות רשימות</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-grid settings-grid-5">

          <div className={`settings-card${expandedSections.groups ? ' expanded' : ''}`}>
            <h3 className="settings-card-header" onClick={() => toggleSection('groups')}>
              קבוצות אתרים
              <span className="settings-card-arrow">{expandedSections.groups ? '▲' : '▼'}</span>
            </h3>
            {expandedSections.groups && (
              <>
                <ul className="config-list">
                  {(config.site_groups || []).map(group => (
                    <li key={group.id}>
                      {editingKey === `group-${group.id}` ? (
                        <input
                          className="config-inline-edit"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit('/api/config/site-groups', group.id);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <span>{group.name}</span>
                      )}
                      <div className="config-item-actions">
                        {editingKey === `group-${group.id}` ? (
                          <>
                            <button className="btn-save-inline" onClick={() => saveEdit('/api/config/site-groups', group.id)}>שמור</button>
                            <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                          </>
                        ) : (
                          <>
                            <button className="btn-edit-inline" onClick={() => { setEditingKey(`group-${group.id}`); setEditingValue(group.name); }}>עריכה</button>
                            <button className="btn-remove" onClick={() => removeItem('/api/config/site-groups', group.id)}>✕</button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="config-add">
                  <input
                    value={newSiteGroup}
                    onChange={e => setNewSiteGroup(e.target.value)}
                    placeholder="קבוצה חדשה..."
                    onKeyDown={e => e.key === 'Enter' && addItem('/api/config/site-groups', newSiteGroup, setNewSiteGroup)}
                  />
                  <button className="btn-primary" onClick={() => addItem('/api/config/site-groups', newSiteGroup, setNewSiteGroup)}>הוסף</button>
                </div>
              </>
            )}
          </div>

          <div className={`settings-card${expandedSections.sites ? ' expanded' : ''}`}>
            <h3 className="settings-card-header" onClick={() => toggleSection('sites')}>
              אתרים
              <span className="settings-card-arrow">{expandedSections.sites ? '▲' : '▼'}</span>
            </h3>
            {expandedSections.sites && (
              <>
                <ul className="config-list">
                  {(config.sites || []).map(site => (
                    <li key={site.id} style={{display: 'flex', gap: '0.2rem', alignItems: 'center', flexWrap: 'wrap'}}>
                      {editingKey === `site-${site.id}` ? (
                        <input
                          className="config-inline-edit"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit('/api/config/sites', site.id);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                          autoFocus
                          style={{flex: 1, minWidth: '100px'}}
                        />
                      ) : (
                        <span style={{flex: 1, minWidth: '100px'}}>{site.name}</span>
                      )}
                      <select
                        value={site.group_id || ''}
                        onChange={e => updateSiteGroup(site.id, e.target.value ? parseInt(e.target.value) : null)}
                        style={{fontSize: '0.7rem', padding: '0.15rem 0.25rem', borderRadius: '3px', minWidth: '120px'}}
                      >
                        <option value="">ללא קבוצה</option>
                        {(config.site_groups || []).map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <div className="config-item-actions" style={{display: 'flex', gap: '0.15rem', flexShrink: 0}}>
                        {editingKey === `site-${site.id}` ? (
                          <>
                            <button className="btn-save-inline" onClick={() => saveEdit('/api/config/sites', site.id)}>שמור</button>
                            <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                          </>
                        ) : (
                          <>
                            <button className="btn-edit-inline" onClick={() => { setEditingKey(`site-${site.id}`); setEditingValue(site.name); }}>עריכה</button>
                            <button className="btn-remove" onClick={() => removeSite(site.id)}>✕</button>
                          </>
                        )}
                      </div>
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
              </>
            )}
          </div>

          <div className={`settings-card${expandedSections.jobs ? ' expanded' : ''}`}>
            <h3 className="settings-card-header" onClick={() => toggleSection('jobs')}>
              תפקידים
              <span className="settings-card-arrow">{expandedSections.jobs ? '▲' : '▼'}</span>
            </h3>
            {expandedSections.jobs && (
              <>
                <ul className="config-list">
              {config.jobs.map(job => (
                <li key={job.id}>
                  {editingKey === `job-${job.id}` ? (
                    <input
                      className="config-inline-edit"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit('/api/config/jobs', job.id);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span>{job.name}</span>
                  )}
                  <div className="config-item-actions">
                    {editingKey === `job-${job.id}` ? (
                      <>
                        <button className="btn-save-inline" onClick={() => saveEdit('/api/config/jobs', job.id)}>שמור</button>
                        <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-edit-inline" onClick={() => { setEditingKey(`job-${job.id}`); setEditingValue(job.name); }}>עריכה</button>
                        <button className="btn-remove" onClick={() => removeItem('/api/config/jobs', job.id)}>✕</button>
                      </>
                    )}
                  </div>
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
              </>
            )}
          </div>

          <div className={`settings-card${expandedSections.empTypes ? ' expanded' : ''}`}>
            <h3 className="settings-card-header" onClick={() => toggleSection('empTypes')}>
              סוגי העסקה
              <span className="settings-card-arrow">{expandedSections.empTypes ? '▲' : '▼'}</span>
            </h3>
            {expandedSections.empTypes && (
              <>
                <ul className="config-list">
              {config.employment_types.map(type => (
                <li key={type.id}>
                  {editingKey === `emptype-${type.id}` ? (
                    <input
                      className="config-inline-edit"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit('/api/config/employment-types', type.id);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span>{type.name}</span>
                  )}
                  <div className="config-item-actions">
                    {editingKey === `emptype-${type.id}` ? (
                      <>
                        <button className="btn-save-inline" onClick={() => saveEdit('/api/config/employment-types', type.id)}>שמור</button>
                        <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-edit-inline" onClick={() => { setEditingKey(`emptype-${type.id}`); setEditingValue(type.name); }}>עריכה</button>
                        <button className="btn-remove" onClick={() => removeItem('/api/config/employment-types', type.id)}>✕</button>
                      </>
                    )}
                  </div>
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
              </>
            )}
          </div>

          <div className={`settings-card${expandedSections.honorifics ? ' expanded' : ''}`}>
            <h3 className="settings-card-header" onClick={() => toggleSection('honorifics')}>
              תארים
              <span className="settings-card-arrow">{expandedSections.honorifics ? '▲' : '▼'}</span>
            </h3>
            {expandedSections.honorifics && (
              <>
                <ul className="config-list">
              {(config.honorifics || []).map(h => (
                <li key={h.id}>
                  {editingKey === `honorific-${h.id}` ? (
                    <input
                      className="config-inline-edit"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit('/api/config/honorifics', h.id);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span>{h.name}</span>
                  )}
                  <div className="config-item-actions">
                    {editingKey === `honorific-${h.id}` ? (
                      <>
                        <button className="btn-save-inline" onClick={() => saveEdit('/api/config/honorifics', h.id)}>שמור</button>
                        <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-edit-inline" onClick={() => { setEditingKey(`honorific-${h.id}`); setEditingValue(h.name); }}>עריכה</button>
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
              </>
            )}
          </div>

          <div className={`settings-card${expandedSections.activities ? ' expanded' : ''}`}>
            <h3 className="settings-card-header" onClick={() => toggleSection('activities')}>
              סוגי פעילות
              <span className="settings-card-arrow">{expandedSections.activities ? '▲' : '▼'}</span>
            </h3>
            {expandedSections.activities && (
              <>
                <ul className="config-list">
                  {(config.activity_types || []).map(actType => (
                    <li key={actType.id}>
                      {editingKey === `activity-${actType.id}` ? (
                        <input
                          className="config-inline-edit"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit('/api/config/activity-types', actType.id);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <span>{actType.name}</span>
                      )}
                      <div className="config-item-actions">
                        {editingKey === `activity-${actType.id}` ? (
                          <>
                            <button className="btn-save-inline" onClick={() => saveEdit('/api/config/activity-types', actType.id)}>שמור</button>
                            <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                          </>
                        ) : (
                          <>
                            <button className="btn-edit-inline" onClick={() => { setEditingKey(`activity-${actType.id}`); setEditingValue(actType.name); }}>עריכה</button>
                            <button className="btn-remove" onClick={() => removeItem('/api/config/activity-types', actType.id)}>✕</button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="config-add">
                  <input
                    value={newActivityType}
                    onChange={e => setNewActivityType(e.target.value)}
                    placeholder="סוג פעילות חדש..."
                    onKeyDown={e => e.key === 'Enter' && addItem('/api/config/activity-types', newActivityType, setNewActivityType)}
                  />
                  <button className="btn-primary" onClick={() => addItem('/api/config/activity-types', newActivityType, setNewActivityType)}>הוסף</button>
                </div>
              </>
            )}
          </div>

          <div className={`settings-card${expandedSections.workerAuths ? ' expanded' : ''}`}>
            <h3 className="settings-card-header" onClick={() => toggleSection('workerAuths')}>
              הרשאות עובדים לפעילויות
              <span className="settings-card-arrow">{expandedSections.workerAuths ? '▲' : '▼'}</span>
            </h3>
            {expandedSections.workerAuths && (
              <div style={{ fontSize: '0.85rem', padding: '0.5rem', lineHeight: '1.6' }}>
                <p style={{ color: '#666', marginBottom: '0.5rem' }}>הרשאות ניהול בדף ניהול העובדים</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
