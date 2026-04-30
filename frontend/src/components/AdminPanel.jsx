import { useState, useEffect } from 'react';

export default function AdminPanel({ config, authToken, branchId, isSuperAdmin, branches = [], onConfigChange, onBranchesChange, onClose }) {
  const [newJob, setNewJob] = useState('');
  const [newEmpType, setNewEmpType] = useState('');
  const [newHonorific, setNewHonorific] = useState('');
  const [newSiteByGroup, setNewSiteByGroup] = useState({});
  const [newSiteGroup, setNewSiteGroup] = useState('');
  const [newSiteGroupType, setNewSiteGroupType] = useState('regular');
  const [editingGroupType, setEditingGroupType] = useState('regular');
  const [newActivityTypeGroup, setNewActivityTypeGroup] = useState('');
  const [newActivityTypeByGroup, setNewActivityTypeByGroup] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedActivityAuths, setExpandedActivityAuths] = useState({});
  const [siteAllowedJobsModal, setSiteAllowedJobsModal] = useState(null);
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'branches' : 'groups');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDesc, setNewBranchDesc] = useState('');
  const [localBranchId, setLocalBranchId] = useState(branchId);
  const [shiftTimesEdits, setShiftTimesEdits] = useState({});

  function branchParam(bid) {
    const id = bid !== undefined ? bid : localBranchId;
    if (isSuperAdmin && id) return `?branch_id=${id}`;
    return '';
  }

  useEffect(() => {
    if (!isSuperAdmin || !localBranchId) return;
    fetch(`/api/config?branch_id=${localBranchId}`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) onConfigChange(data); })
      .catch(() => {});
  }, [localBranchId]);

  async function createBranch() {
    if (!newBranchName.trim()) return;
    const res = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ name: newBranchName.trim(), description: newBranchDesc.trim() || null }),
    });
    if (res.ok) {
      const branch = await res.json();
      onBranchesChange?.([...branches, branch]);
      setNewBranchName('');
      setNewBranchDesc('');
    } else {
      const err = await res.json();
      alert('שגיאה: ' + (err.error || 'שגיאה'));
    }
  }

  async function deleteBranch(id) {
    if (!confirm('למחוק את הסניף? פעולה זו בלתי הפיכה.')) return;
    const res = await fetch(`/api/branches/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      onBranchesChange?.(branches.filter(b => b.id !== id));
    } else {
      const err = await res.json();
      alert('שגיאה: ' + (err.error || 'שגיאה'));
    }
  }


  async function addItem(endpoint, value, setter) {
    if (!value.trim()) return;
    const res = await fetch(`${endpoint}${branchParam()}`, {
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
    const res = await fetch(`${endpoint}/${id}${branchParam()}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) {
      onConfigChange(await res.json());
    } else {
      alert('שגיאה במחיקה');
    }
  }

  async function removeActivityType(id, name) {
    if (!window.confirm(`למחוק את סוג הפעילות "${name}"?\n\nשיבוצי אתרים קיימים ישמרו ללא סוג פעילות.\nהרשאות עובדים לפעילות זו יימחקו.`)) return;
    const res = await fetch(`/api/config/activity-types/${id}${branchParam()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) onConfigChange(await res.json());
    else alert('שגיאה במחיקה');
  }

  async function saveEdit(endpoint, id) {
    if (!editingValue.trim()) return;
    const res = await fetch(`${endpoint}/${id}${branchParam()}`, {
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

  async function addSiteGroup() {
    if (!newSiteGroup.trim()) return;
    const res = await fetch(`/api/config/site-groups${branchParam()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ value: newSiteGroup.trim(), group_type: newSiteGroupType }),
    });
    if (res.ok) { onConfigChange(await res.json()); setNewSiteGroup(''); setNewSiteGroupType('regular'); }
    else { const e = await res.json(); alert('שגיאה: ' + (e.error || 'שגיאה')); }
  }

  async function saveSiteGroupEdit(id) {
    if (!editingValue.trim()) return;
    const res = await fetch(`/api/config/site-groups/${id}${branchParam()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ value: editingValue.trim(), group_type: editingGroupType }),
    });
    if (res.ok) { onConfigChange(await res.json()); setEditingKey(null); }
    else alert('שגיאה בשמירה');
  }

  async function addActivityTypeGroup() {
    if (!newActivityTypeGroup.trim()) return;
    const res = await fetch(`/api/config/activity-type-groups${branchParam()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ value: newActivityTypeGroup.trim() }),
    });
    if (res.ok) { onConfigChange(await res.json()); setNewActivityTypeGroup(''); }
    else { const e = await res.json(); alert('שגיאה: ' + (e.error || 'שגיאה')); }
  }

  async function saveActivityTypeGroupEdit(id) {
    if (!editingValue.trim()) return;
    const res = await fetch(`/api/config/activity-type-groups/${id}${branchParam()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ value: editingValue.trim() }),
    });
    if (res.ok) { onConfigChange(await res.json()); setEditingKey(null); }
    else alert('שגיאה בשמירה');
  }

  async function addActivityTypeInGroup(groupId) {
    const key = groupId ?? 'ungrouped';
    const name = (newActivityTypeByGroup[key] || '').trim();
    if (!name) return;
    const res = await fetch(`/api/config/activity-types${branchParam()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ value: name, group_id: groupId || null }),
    });
    if (res.ok) { onConfigChange(await res.json()); setNewActivityTypeByGroup(prev => ({ ...prev, [key]: '' })); }
    else { const e = await res.json(); alert('שגיאה: ' + (e.error || 'שגיאה')); }
  }

  async function moveActivityTypeToGroup(activityTypeId, groupId) {
    const res = await fetch(`/api/config/activity-types/${activityTypeId}/group${branchParam()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ group_id: groupId || null }),
    });
    if (res.ok) onConfigChange(await res.json());
    else alert('שגיאה בהעברת פעילות');
  }

  async function addSiteInGroup(groupId) {
    const key = groupId ?? 'ungrouped';
    const name = (newSiteByGroup[key] || '').trim();
    if (!name) return;
    const res = await fetch(`/api/config/sites${branchParam()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ name, group_id: groupId || null }),
    });
    if (res.ok) { onConfigChange(await res.json()); setNewSiteByGroup(prev => ({ ...prev, [key]: '' })); }
    else { const e = await res.json(); alert('שגיאה: ' + (e.error || 'שגיאה')); }
  }

  async function removeSite(id) {
    const res = await fetch(`/api/config/sites/${id}${branchParam()}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) {
      onConfigChange(await res.json());
    } else {
      alert('שגיאה במחיקת אתר');
    }
  }

  async function toggleFairnessSite(siteId, enable) {
    const res = await fetch(`/api/config/fairness-sites/${siteId}${branchParam()}`, {
      method: enable ? 'POST' : 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) onConfigChange(await res.json());
    else alert('שגיאה בעדכון הגדרות צדק');
  }

  const [fairnessReport, setFairnessReport] = useState(null);
  const [fairnessReportLoading, setFairnessReportLoading] = useState(false);

  async function fetchFairnessReport() {
    setFairnessReportLoading(true);
    try {
      const res = await fetch(`/api/fairness-report${branchParam()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (res.ok) setFairnessReport(await res.json());
      else alert('שגיאה בטעינת דוח צדק');
    } finally {
      setFairnessReportLoading(false);
    }
  }

  async function updateSiteGroup(siteId, groupId) {
    const res = await fetch(`/api/config/sites/${siteId}/group${branchParam()}`, {
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

  async function saveShiftTimes(key) {
    const edit = shiftTimesEdits[key];
    if (!edit) return;
    try {
      const res = await fetch(`/api/config/shift-types/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ default_start: edit.default_start, default_end: edit.default_end }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onConfigChange(updated);
      setShiftTimesEdits(prev => { const n = {...prev}; delete n[key]; return n; });
    } catch {
      alert('שגיאה בשמירת שעות משמרת');
    }
  }

  const thStyle = { padding: '0.3rem 0.5rem', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' };

  const tabDescriptions = {
    branches: 'ניהול סניפים במערכת. כל סניף הוא יחידה עצמאית עם עובדים, אתרים והגדרות משלו. הוספת סניף מאפשרת לנהל יחידות ארגוניות נפרדות; מחיקת סניף תסיר את כל הנתונים הקשורים אליו.',
    groups: 'קבוצות אתרים מאגדות מספר אתרים לקטגוריה משותפת (לדוג׳ תורנות, כוננות). ניתן לשייך כל אתר לקבוצה דרך כרטיסיית האתרים.',
    sites: 'אתרים הם מקומות העבודה הפיזיים (לדוג׳ חדר ניתוח 1, IVF). ניתן להגביל לכל אתר אילו תפקידים מורשים לשמש בו — שינוי זה ישפיע על סינון עובדים בהצעות האוטומטיות. סימון ⚖️ צדק יגרום למערכת לאזן שיבוצים לאתר זה.',
    jobs: 'תפקידים מגדירים את סוגי התפקידים האפשריים לעובד (לדוג׳ רופא מרדים, אחות). שינויים ישפיעו על אפשרויות הבחירה בטופס עובד חדש ועל הרשאות שיבוץ לאתרים.',
    empTypes: 'סוגי העסקה מגדירים את מעמד ההעסקה של העובד (לדוג׳ קבוע, חלקי, חוזה). שינוי הרשימה ישפיע על אפשרויות הבחירה בעת יצירה או עריכה של עובד.',
    honorifics: 'תארים מגדירים את הכינוי הרשמי של העובד (לדוג׳ ד״ר, פרופ׳). שינויים ישפיעו על האופן שבו שמות העובדים מוצגים בכל חלקי המערכת.',
    activities: 'סוגי פעילות מגדירים סוגי עבודה ספציפיים שניתן להרשות לעובדים (לדוג׳ אנסתזיה כללית, ספינל). הרשאות אלו מיועדות לעובדים בנפרד ומשפיעות על הצעות השיבוץ האוטומטיות.',
  };

  function TabDescription({ tabKey }) {
    const text = tabDescriptions[tabKey];
    if (!text) return null;
    return (
      <div style={{
        background: '#f0f7ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '0.6rem 0.85rem',
        marginBottom: '0.85rem',
        fontSize: '0.8rem',
        color: '#1e3a5f',
        lineHeight: 1.6,
        direction: 'rtl',
      }}>
        ℹ️ {text}
      </div>
    );
  }

  const tabs = [
    ...(isSuperAdmin ? [{ key: 'branches', label: 'סניפים' }] : []),
    { key: 'groups', label: 'קבוצות אתרים' },
    { key: 'jobs', label: 'תפקידים' },
    { key: 'empTypes', label: 'סוגי העסקה' },
    { key: 'honorifics', label: 'תארים' },
    { key: 'activities', label: 'סוגי פעילות' },
    { key: 'shifts', label: 'שעות משמרות' },
  ];

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>הגדרות רשימות</h2>
          {isSuperAdmin && branches.length > 0 && (
            <select
              value={localBranchId || ''}
              onChange={(e) => setLocalBranchId(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', marginRight: 'auto', marginLeft: '12px' }}
            >
              <option value="">— בחר אתר —</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', flex: 1}}>
          {/* Tabs */}
          <div style={{display: 'flex', gap: '0.15rem', borderBottom: '2px solid #e2e8f0', padding: '0.5rem 0.75rem 0', background: '#f1f5f9', overflowX: 'auto'}}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '0.25rem 0.55rem',
                  border: '1px solid',
                  borderColor: activeTab === tab.key ? '#cbd5e1' : 'transparent',
                  borderBottom: activeTab === tab.key ? '2px solid white' : '2px solid transparent',
                  background: activeTab === tab.key ? 'white' : 'transparent',
                  color: activeTab === tab.key ? '#1a2e4a' : '#64748b',
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  cursor: 'pointer',
                  borderRadius: '7px 7px 0 0',
                  whiteSpace: 'nowrap',
                  fontSize: '0.82rem',
                  marginBottom: '-2px',
                  transition: 'all 0.12s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{flex: 1, overflow: 'auto', padding: '0.6rem 0.85rem 0.85rem'}}>
            {activeTab === 'branches' && isSuperAdmin && (
              <>
                <TabDescription tabKey="branches" />
                <ul className="config-list">
                  {branches.map(b => (
                    <li key={b.id}>
                      <div>
                        <div style={{fontWeight: 500}}>{b.name}</div>
                        {b.description && <div style={{fontSize: '0.8rem', color: '#6b7280'}}>{b.description}</div>}
                      </div>
                      <button className="btn-remove" onClick={() => deleteBranch(b.id)}>✕</button>
                    </li>
                  ))}
                </ul>
                <div className="add-item-row" style={{flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch'}}>
                  <input
                    className="config-input"
                    placeholder="שם סניף חדש"
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createBranch()}
                  />
                  <input
                    className="config-input"
                    placeholder="תיאור (אופציונלי)"
                    value={newBranchDesc}
                    onChange={e => setNewBranchDesc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createBranch()}
                  />
                  <button className="btn-add-config" onClick={createBranch}>הוסף סניף</button>
                </div>
              </>
            )}
            {activeTab === 'groups' && (
              <>
                <TabDescription tabKey="groups" />
                <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem'}}>
                  <button
                    className="btn-primary"
                    onClick={fetchFairnessReport}
                    disabled={fairnessReportLoading}
                    style={{fontSize: '0.8rem', whiteSpace: 'nowrap'}}
                  >
                    {fairnessReportLoading ? 'טוען...' : '⚖️ טבלת צדק'}
                  </button>
                </div>
                {(() => {
                  const typeLabel = { regular: 'רגיל', night: '⭐ תורנות', oncall: '📞 כוננות' };
                  const typeBadgeColor = { regular: '#e5e7eb', night: '#ede9fe', oncall: '#dbeafe' };
                  const typeTextColor  = { regular: '#555', night: '#6d28d9', oncall: '#0369a1' };

                  function renderSiteRow(site) {
                    const isFairness = (config.fairness_sites || []).includes(site.id);
                    return (
                      <li key={site.id} style={{display: 'flex', gap: '0.15rem', alignItems: 'center', flexWrap: 'wrap', paddingRight: '1rem', background: '#f8fafc', borderRadius: '4px', marginBottom: '0.1rem'}}>
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
                          <span style={{flex: 1, minWidth: '100px', fontSize: '0.85rem'}}>{site.name}</span>
                        )}
                        <label title="כלול באיזון עומס (צדק)" style={{display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0}}>
                          <input type="checkbox" checked={isFairness} onChange={e => toggleFairnessSite(site.id, e.target.checked)} />
                          ⚖️
                        </label>
                        <div className="config-item-actions" style={{display: 'flex', gap: '0.15rem', flexShrink: 0}}>
                          {editingKey === `site-${site.id}` ? (
                            <>
                              <button className="btn-save-inline" onClick={() => saveEdit('/api/config/sites', site.id)}>שמור</button>
                              <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-edit-inline" onClick={() => setSiteAllowedJobsModal(site)} title="הגדר תפקידים מורשים">תפקידים</button>
                              <button className="btn-edit-inline" onClick={() => { setEditingKey(`site-${site.id}`); setEditingValue(site.name); }}>עריכה</button>
                              <button className="btn-remove" onClick={() => removeSite(site.id)}>✕</button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  }

                  function renderAddSiteRow(groupId) {
                    const key = groupId ?? 'ungrouped';
                    return (
                      <div style={{display: 'flex', gap: '0.2rem', paddingRight: '0.5rem', marginTop: '1px'}}>
                        <input
                          className="config-inline-edit"
                          style={{flex: 1, fontSize: '0.82rem'}}
                          value={newSiteByGroup[key] || ''}
                          onChange={e => setNewSiteByGroup(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder="אתר חדש..."
                          onKeyDown={e => e.key === 'Enter' && addSiteInGroup(groupId)}
                        />
                        <button className="btn-add-config" style={{fontSize: '0.78rem'}} onClick={() => addSiteInGroup(groupId)}>הוסף</button>
                      </div>
                    );
                  }

                  const groups = config.site_groups || [];
                  const ungroupedSites = (config.sites || []).filter(s => !s.group_id);

                  return (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                      {groups.map(group => {
                        const groupSites = (config.sites || []).filter(s => s.group_id === group.id);
                        return (
                          <div key={group.id} style={{border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden'}}>
                            <div style={{display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.1rem 0.5rem', gap: '0.3rem'}}>
                              {editingKey === `group-${group.id}` ? (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                                  <input
                                    className="config-inline-edit"
                                    value={editingValue}
                                    onChange={e => setEditingValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveSiteGroupEdit(group.id); if (e.key === 'Escape') setEditingKey(null); }}
                                    autoFocus
                                    style={{ flex: 1 }}
                                  />
                                  <select value={editingGroupType} onChange={e => setEditingGroupType(e.target.value)} style={{ fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #d1d5db', padding: '0.2rem 0.4rem' }}>
                                    <option value="regular">רגיל</option>
                                    <option value="night">⭐ תורנות</option>
                                    <option value="oncall">📞 כוננות</option>
                                  </select>
                                </div>
                              ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, fontWeight: 600, fontSize: '0.8rem', color: '#7f1d1d' }}>
                                  {group.name}
                                  {group.group_type && group.group_type !== 'regular' && (
                                    <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: '10px', background: typeBadgeColor[group.group_type], color: typeTextColor[group.group_type], fontWeight: 600 }}>
                                      {typeLabel[group.group_type]}
                                    </span>
                                  )}
                                </span>
                              )}
                              <div className="config-item-actions">
                                {editingKey === `group-${group.id}` ? (
                                  <>
                                    <button className="btn-save-inline" onClick={() => saveSiteGroupEdit(group.id)}>שמור</button>
                                    <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                                  </>
                                ) : (
                                  <>
                                    <button className="btn-edit-inline" onClick={() => { setEditingKey(`group-${group.id}`); setEditingValue(group.name); setEditingGroupType(group.group_type || 'regular'); }}>עריכה</button>
                                    <button className="btn-remove" onClick={() => removeItem('/api/config/site-groups', group.id)}>✕</button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{padding: '0.1rem 0.5rem 0.15rem'}}>
                              {groupSites.length > 0 && (
                                <ul className="config-list" style={{margin: '0 0 0.1rem', padding: 0}}>
                                  {groupSites.map(renderSiteRow)}
                                </ul>
                              )}
                              {renderAddSiteRow(group.id)}
                            </div>
                          </div>
                        );
                      })}

                      {ungroupedSites.length > 0 && (
                        <div style={{border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden'}}>
                          <div style={{background: '#f1f5f9', padding: '0.1rem 0.5rem', fontWeight: 600, fontSize: '0.78rem', color: '#64748b'}}>ללא קבוצה</div>
                          <div style={{padding: '0.1rem 0.5rem 0.15rem'}}>
                            <ul className="config-list" style={{margin: '0 0 0.1rem', padding: 0}}>
                              {ungroupedSites.map(renderSiteRow)}
                            </ul>
                          </div>
                        </div>
                      )}

                      <div style={{border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.2rem 0.5rem'}}>
                        <div style={{fontSize: '0.75rem', color: '#64748b', marginBottom: '2px', fontWeight: 500}}>הוספת קבוצה חדשה</div>
                        <div className="config-add" style={{margin: 0}}>
                          <input
                            value={newSiteGroup}
                            onChange={e => setNewSiteGroup(e.target.value)}
                            placeholder="שם קבוצה..."
                            onKeyDown={e => e.key === 'Enter' && addSiteGroup()}
                          />
                          <select value={newSiteGroupType} onChange={e => setNewSiteGroupType(e.target.value)} style={{ fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #d1d5db', padding: '0.25rem 0.5rem' }}>
                            <option value="regular">רגיל</option>
                            <option value="night">⭐ תורנות</option>
                            <option value="oncall">📞 כוננות</option>
                          </select>
                          <button className="btn-primary" onClick={addSiteGroup}>הוסף</button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {siteAllowedJobsModal && (
                  <SiteAllowedJobsModal
                    site={siteAllowedJobsModal}
                    authToken={authToken}
                    config={config}
                    onClose={() => setSiteAllowedJobsModal(null)}
                  />
                )}
              </>
            )}

            {fairnessReport && (
              <div className="form-overlay" onClick={() => setFairnessReport(null)}>
                <div className="settings-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '700px', direction: 'rtl'}}>
                  <div className="settings-header">
                    <h2>⚖️ טבלת צדק</h2>
                    <button className="btn-close" onClick={() => setFairnessReport(null)}>✕</button>
                  </div>
                  <div style={{padding: '1rem 1.25rem', overflow: 'auto'}}>
                    {fairnessReport.sites.length === 0 ? (
                      <p style={{fontSize: '0.85rem', color: '#666'}}>לא הוגדרו אתרי צדק.</p>
                    ) : (
                      <div style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', direction: 'rtl'}}>
                          <thead>
                            <tr style={{background: '#f8fafc'}}>
                              <th style={thStyle}>עובד</th>
                              {fairnessReport.sites.map(s => (
                                <th key={s.site_id} style={thStyle}>{s.site_name}</th>
                              ))}
                              <th style={{...thStyle, fontWeight: 700}}>סה"כ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fairnessReport.workers.map(w => (
                              <tr key={w.worker_id} style={{borderBottom: '1px solid #f1f5f9'}}>
                                <td style={tdStyle}>{w.name}</td>
                                {fairnessReport.sites.map(s => (
                                  <td key={s.site_id} style={{...tdStyle, textAlign: 'center'}}>
                                    {w.counts[s.site_id] || 0}
                                  </td>
                                ))}
                                <td style={{...tdStyle, textAlign: 'center', fontWeight: 700}}>{w.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'jobs' && (
              <>
                <TabDescription tabKey="jobs" />
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

            {activeTab === 'empTypes' && (
              <>
                <TabDescription tabKey="empTypes" />
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

            {activeTab === 'honorifics' && (
              <>
                <TabDescription tabKey="honorifics" />
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

            {activeTab === 'activities' && (
              <>
                <TabDescription tabKey="activities" />
                {(() => {
                  function renderActivityTypeRow(actType) {
                    return (
                      <li key={actType.id} style={{display:'flex',gap:'0.15rem',alignItems:'center',paddingRight:'1rem',background:'#f8fafc',borderRadius:'4px',marginBottom:'1px'}}>
                        {editingKey === `activity-${actType.id}` ? (
                          <input className="config-inline-edit" value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={e => { if (e.key==='Enter') saveEdit('/api/config/activity-types', actType.id); if (e.key==='Escape') setEditingKey(null); }}
                            autoFocus style={{flex:1}} />
                        ) : (
                          <span style={{flex:1,fontSize:'0.85rem'}}>{actType.name}</span>
                        )}
                        {actGroups.length > 0 && editingKey !== `activity-${actType.id}` && (
                          <select
                            value={actType.group_id || ''}
                            onChange={e => moveActivityTypeToGroup(actType.id, e.target.value ? parseInt(e.target.value) : null)}
                            style={{fontSize:'0.75rem',padding:'0.1rem 0.25rem',border:'1px solid #d1d5db',borderRadius:'4px',background:'#fff',maxWidth:'100px'}}
                            title="העבר לקבוצה"
                          >
                            <option value="">ללא קבוצה</option>
                            {actGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                        )}
                        <div className="config-item-actions">
                          {editingKey === `activity-${actType.id}` ? (
                            <><button className="btn-save-inline" onClick={() => saveEdit('/api/config/activity-types', actType.id)}>שמור</button>
                              <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button></>
                          ) : (
                            <><button className="btn-edit-inline" onClick={() => { setEditingKey(`activity-${actType.id}`); setEditingValue(actType.name); }}>עריכה</button>
                              <button className="btn-remove" onClick={() => removeActivityType(actType.id, actType.name)}>✕</button></>
                          )}
                        </div>
                      </li>
                    );
                  }

                  function renderAddRow(groupId) {
                    const key = groupId ?? 'ungrouped';
                    return (
                      <div style={{display:'flex',gap:'0.2rem',paddingRight:'0.5rem',marginTop:'1px'}}>
                        <input className="config-inline-edit" style={{flex:1,fontSize:'0.82rem'}}
                          value={newActivityTypeByGroup[key] || ''}
                          onChange={e => setNewActivityTypeByGroup(prev => ({...prev,[key]:e.target.value}))}
                          placeholder="סוג פעילות חדש..."
                          onKeyDown={e => e.key==='Enter' && addActivityTypeInGroup(groupId)} />
                        <button className="btn-add-config" style={{fontSize:'0.78rem'}} onClick={() => addActivityTypeInGroup(groupId)}>הוסף</button>
                      </div>
                    );
                  }

                  const actGroups = config.activity_type_groups || [];
                  const ungrouped = (config.activity_types || []).filter(at => !at.group_id);

                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                      {actGroups.map(group => {
                        const members = (config.activity_types || []).filter(at => at.group_id === group.id);
                        return (
                          <div key={group.id} style={{border:'1px solid #e2e8f0',borderRadius:'4px',overflow:'hidden'}}>
                            <div style={{display:'flex',alignItems:'center',background:'#f1f5f9',padding:'0.1rem 0.5rem',gap:'0.3rem'}}>
                              {editingKey === `actgroup-${group.id}` ? (
                                <input className="config-inline-edit" value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  onKeyDown={e => { if (e.key==='Enter') saveActivityTypeGroupEdit(group.id); if (e.key==='Escape') setEditingKey(null); }}
                                  autoFocus style={{flex:1}} />
                              ) : (
                                <span style={{flex:1,fontWeight:600,fontSize:'0.8rem',color:'#7f1d1d'}}>{group.name}</span>
                              )}
                              <div className="config-item-actions">
                                {editingKey === `actgroup-${group.id}` ? (
                                  <><button className="btn-save-inline" onClick={() => saveActivityTypeGroupEdit(group.id)}>שמור</button>
                                    <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button></>
                                ) : (
                                  <><button className="btn-edit-inline" onClick={() => { setEditingKey(`actgroup-${group.id}`); setEditingValue(group.name); }}>עריכה</button>
                                    <button className="btn-remove" onClick={() => removeItem('/api/config/activity-type-groups', group.id)}>✕</button></>
                                )}
                              </div>
                            </div>
                            <div style={{padding:'0.1rem 0.5rem 0.15rem'}}>
                              {members.length > 0 && (
                                <ul className="config-list" style={{margin:'0 0 0.1rem',padding:0}}>{members.map(renderActivityTypeRow)}</ul>
                              )}
                              {renderAddRow(group.id)}
                            </div>
                          </div>
                        );
                      })}

                      {ungrouped.length > 0 && (
                        <div style={{border:'1px solid #e2e8f0',borderRadius:'4px',overflow:'hidden'}}>
                          <div style={{background:'#f1f5f9',padding:'0.1rem 0.5rem',fontWeight:600,fontSize:'0.78rem',color:'#7f1d1d'}}>ללא קבוצה</div>
                          <div style={{padding:'0.1rem 0.5rem 0.15rem'}}>
                            <ul className="config-list" style={{margin:'0 0 0.1rem',padding:0}}>{ungrouped.map(renderActivityTypeRow)}</ul>
                            {renderAddRow(null)}
                          </div>
                        </div>
                      )}

                      <div style={{border:'1px dashed #cbd5e1',borderRadius:'4px',padding:'0.2rem 0.5rem'}}>
                        <div style={{fontSize:'0.75rem',color:'#7f1d1d',marginBottom:'2px',fontWeight:600}}>הוספת קבוצה חדשה</div>
                        <div className="config-add" style={{margin:0}}>
                          <input value={newActivityTypeGroup} onChange={e => setNewActivityTypeGroup(e.target.value)}
                            placeholder="שם קבוצה..." onKeyDown={e => e.key==='Enter' && addActivityTypeGroup()} />
                          <button className="btn-primary" onClick={addActivityTypeGroup}>הוסף קבוצה</button>
                        </div>
                      </div>

                      {actGroups.length === 0 && ungrouped.length === 0 && (
                        <div style={{color:'#64748b',fontSize:'0.85rem',padding:'0.5rem'}}>אין סוגי פעילות עדיין.</div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {activeTab === 'shifts' && (
              <div style={{padding: '1rem'}}>
                <h3 style={{marginBottom: '1rem', color: '#1a2e4a', fontSize: '1rem'}}>שעות ברירת מחדל למשמרות</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {(config.shift_types || []).filter(st => ['night', 'oncall'].includes(st.key)).map(st => {
                    const edit = shiftTimesEdits[st.key] || { default_start: st.default_start || '', default_end: st.default_end || '' };
                    const isDirty = !!shiftTimesEdits[st.key];
                    return (
                      <div key={st.key} style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem'}}>
                        <div style={{fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem'}}>
                          {st.icon} {st.label_he}
                        </div>
                        <div style={{display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap'}}>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                            <label style={{fontSize: '0.8rem', color: '#64748b'}}>שעת התחלה</label>
                            <input
                              type="time"
                              value={edit.default_start}
                              onChange={e => setShiftTimesEdits(prev => ({...prev, [st.key]: {...edit, default_start: e.target.value}}))}
                              style={{padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem'}}
                            />
                          </div>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                            <label style={{fontSize: '0.8rem', color: '#64748b'}}>שעת סיום (לחישוב משך)</label>
                            <input
                              type="time"
                              value={edit.default_end}
                              onChange={e => setShiftTimesEdits(prev => ({...prev, [st.key]: {...edit, default_end: e.target.value}}))}
                              style={{padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem'}}
                            />
                          </div>
                          <button
                            className="btn-primary"
                            onClick={() => saveShiftTimes(st.key)}
                            disabled={!isDirty}
                            style={{opacity: isDirty ? 1 : 0.4}}
                          >שמור</button>
                        </div>
                      </div>
                    );
                  })}
                  {(config.shift_types || []).filter(st => ['night', 'oncall'].includes(st.key)).length === 0 && (
                    <p style={{color: '#64748b', fontSize: '0.9rem'}}>אין משמרות תורנות/כוננות מוגדרות במערכת.</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function SiteAllowedJobsModal({ site, authToken, config, onClose }) {
  const [allowedJobs, setAllowedJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAllowedJobs(); }, [site.id]);

  async function fetchAllowedJobs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/config/sites/${site.id}/allowed-jobs`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setAllowedJobs(await res.json());
    } catch (err) {
      console.error('Error fetching allowed jobs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function addAllowedJob(jobId) {
    const res = await fetch(`/api/config/sites/${site.id}/allowed-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ job_id: jobId }),
    });
    if (res.ok) setAllowedJobs(await res.json());
    else { const err = await res.json(); alert('שגיאה: ' + (err.error || 'לא ניתן להוסיף')); }
  }

  async function removeAllowedJob(jobId) {
    const res = await fetch(`/api/config/sites/${site.id}/allowed-jobs/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) setAllowedJobs(await res.json());
  }

  const allowedIds = new Set(allowedJobs.map(j => j.job_id));
  const availableJobs = (config.jobs || []).filter(j => !allowedIds.has(j.id));

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="settings-header">
          <h2>תפקידים מורשים — {site.name}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '1rem', fontSize: '0.9rem' }}>
          {loading ? <p>טוען...</p> : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem', color: '#1a2e4a' }}>תפקידים מורשים:</h4>
                {allowedJobs.length === 0 ? (
                  <p style={{ color: '#666' }}>ללא הגבלה — כל התפקידים מורשים לאתר זה</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {allowedJobs.map(j => (
                      <div key={j.job_id} style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', padding: '0.5rem',
                        background: '#dbeafe', borderRadius: '4px', border: '1px solid #0369a1'
                      }}>
                        <span>{j.name}</span>
                        <button className="btn-remove"
                          onClick={() => removeAllowedJob(j.job_id)}
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 style={{ marginBottom: '0.5rem', color: '#1a2e4a' }}>הוסף תפקיד:</h4>
                {availableJobs.length === 0 ? (
                  <p style={{ color: '#666' }}>כל התפקידים כבר מורשים</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {availableJobs.map(j => (
                      <button key={j.id} onClick={() => addAllowedJob(j.id)}
                        style={{
                          padding: '0.5rem', background: '#f3f4f6',
                          border: '1px solid #d1d5db', borderRadius: '4px',
                          cursor: 'pointer', textAlign: 'right'
                        }}>
                        {j.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="form-actions">
          <button className="btn-primary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}
