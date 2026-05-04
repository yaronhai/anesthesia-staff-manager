import { useState, useEffect } from 'react';
import RolesManagement from './RolesManagement';
import styles from '../styles/AdminPanel.module.scss';

export default function AdminPanel({ config, authToken, branchId, isSuperAdmin, branches = [], onConfigChange, onBranchesChange, onClose, roles = [], onRolesChange }) {
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
  const [editingComplexityLevel, setEditingComplexityLevel] = useState(1);
  const [newActivityTypeComplexityByGroup, setNewActivityTypeComplexityByGroup] = useState({});
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

  async function saveActivityTypeEdit(id) {
    if (!editingValue.trim()) return;
    const res = await fetch(`/api/config/activity-types/${id}${branchParam()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ value: editingValue.trim(), complexity_level: editingComplexityLevel }),
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
      body: JSON.stringify({ value: name, group_id: groupId || null, complexity_level: newActivityTypeComplexityByGroup[key] || 1 }),
    });
    if (res.ok) { onConfigChange(await res.json()); setNewActivityTypeByGroup(prev => ({ ...prev, [key]: '' })); setNewActivityTypeComplexityByGroup(prev => ({ ...prev, [key]: 1 })); }
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

  async function updateActivityTypeComplexity(activityTypeId, complexityLevel) {
    const res = await fetch(`/api/config/activity-types/${activityTypeId}${branchParam()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ value: (config.activity_types?.find(at => at.id === activityTypeId)?.name || ''), complexity_level: complexityLevel }),
    });
    if (res.ok) onConfigChange(await res.json());
    else alert('שגיאה בעדכון רמה');
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
      <div className={styles.tabDesc}>ℹ️ {text}</div>
    );
  }

  const tabs = [
    ...(isSuperAdmin ? [{ key: 'branches', label: 'סניפים' }] : []),
    ...(isSuperAdmin ? [{ key: 'hierarchy', label: 'היררכיה' }] : []),
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
              className={styles.branchSelect}
            >
              <option value="">— בחר אתר —</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalFlex}>
          {/* Tabs */}
          <div className={styles.tabBar}>
            {tabs.map(tab => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  className={styles.tabBtn}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    '--tab-border-color': active ? '#cbd5e1' : 'transparent',
                    '--tab-border-bottom': active ? '2px solid white' : '2px solid transparent',
                    '--tab-bg': active ? 'white' : 'transparent',
                    '--tab-color': active ? '#1a2e4a' : '#64748b',
                    '--tab-weight': active ? 700 : 400,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className={styles.tabContent}>
            {activeTab === 'hierarchy' && isSuperAdmin && (
              <RolesManagement roles={roles} authToken={authToken} onRolesChange={onRolesChange} />
            )}

            {activeTab === 'branches' && isSuperAdmin && (
              <>
                <TabDescription tabKey="branches" />
                <ul className="config-list">
                  {branches.map(b => (
                    <li key={b.id}>
                      <div>
                        <div className={styles.branchName}>{b.name}</div>
                        {b.description && <div className={styles.branchDesc}>{b.description}</div>}
                      </div>
                      <button className="btn-remove" onClick={() => deleteBranch(b.id)}>✕</button>
                    </li>
                  ))}
                </ul>
                <div className={`add-item-row ${styles.addItemColFlex}`}>
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
                <div className={styles.fairnessRow}>
                  <button
                    className={`btn-primary ${styles.fairnessBtnSm}`}
                    onClick={fetchFairnessReport}
                    disabled={fairnessReportLoading}
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
                      <li key={site.id} className={styles.itemRow}>
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
                          <span className={styles.itemName}>{site.name}</span>
                        )}
                        <label title="כלול באיזון עומס (צדק)" className={styles.fairnessLabel}>
                          <input type="checkbox" checked={isFairness} onChange={e => toggleFairnessSite(site.id, e.target.checked)} />
                          ⚖️
                        </label>
                        <div className={`config-item-actions ${styles.itemActions}`}>
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
                      <div className={styles.addRow}>
                        <input
                          className="config-inline-edit"
                          style={{flex: 1, fontSize: '0.82rem'}}
                          value={newSiteByGroup[key] || ''}
                          onChange={e => setNewSiteByGroup(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder="אתר חדש..."
                          onKeyDown={e => e.key === 'Enter' && addSiteInGroup(groupId)}
                        />
                        <button className={`btn-add-config ${styles.addRowBtn}`} onClick={() => addSiteInGroup(groupId)}>הוסף</button>
                      </div>
                    );
                  }

                  const groups = config.site_groups || [];
                  const ungroupedSites = (config.sites || []).filter(s => !s.group_id);

                  return (
                    <div className={styles.columnGap2}>
                      {groups.map(group => {
                        const groupSites = (config.sites || []).filter(s => s.group_id === group.id);
                        return (
                          <div key={group.id} className={styles.groupCard}>
                            <div className={styles.groupHeader}>
                              {editingKey === `group-${group.id}` ? (
                                <div className={styles.groupHeaderEditRow}>
                                  <input
                                    className="config-inline-edit"
                                    value={editingValue}
                                    onChange={e => setEditingValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveSiteGroupEdit(group.id); if (e.key === 'Escape') setEditingKey(null); }}
                                    autoFocus
                                    style={{ flex: 1 }}
                                  />
                                  <select className={styles.groupTypeSelect} value={editingGroupType} onChange={e => setEditingGroupType(e.target.value)}>
                                    <option value="regular">רגיל</option>
                                    <option value="night">⭐ תורנות</option>
                                    <option value="oncall">📞 כוננות</option>
                                  </select>
                                </div>
                              ) : (
                                <span className={styles.groupNameDisplay}>
                                  {group.name}
                                  {group.group_type && group.group_type !== 'regular' && (
                                    <span
                                      className={styles.groupTypeBadge}
                                      style={{ '--badge-bg': typeBadgeColor[group.group_type], '--badge-color': typeTextColor[group.group_type] }}
                                    >
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
                            <div className={styles.groupContent}>
                              {groupSites.length > 0 && (
                                <ul className={`config-list ${styles.configListReset}`}>
                                  {groupSites.map(renderSiteRow)}
                                </ul>
                              )}
                              {renderAddSiteRow(group.id)}
                            </div>
                          </div>
                        );
                      })}

                      {ungroupedSites.length > 0 && (
                        <div className={styles.groupCard}>
                          <div className={styles.ungroupedHeader}>ללא קבוצה</div>
                          <div className={styles.groupContent}>
                            <ul className={`config-list ${styles.configListReset}`}>
                              {ungroupedSites.map(renderSiteRow)}
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className={styles.addGroupBox}>
                        <div className={styles.addGroupLabel}>הוספת קבוצה חדשה</div>
                        <div className={`config-add ${styles.configAddReset}`}>
                          <input
                            value={newSiteGroup}
                            onChange={e => setNewSiteGroup(e.target.value)}
                            placeholder="שם קבוצה..."
                            onKeyDown={e => e.key === 'Enter' && addSiteGroup()}
                          />
                          <select className={styles.newGroupTypeSelect} value={newSiteGroupType} onChange={e => setNewSiteGroupType(e.target.value)}>
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
                <div className={`settings-modal ${styles.fairnessModal}`} onClick={e => e.stopPropagation()}>
                  <div className="settings-header">
                    <h2>⚖️ טבלת צדק</h2>
                    <button className="btn-close" onClick={() => setFairnessReport(null)}>✕</button>
                  </div>
                  <div className={styles.fairnessContent}>
                    {fairnessReport.sites.length === 0 ? (
                      <p className={styles.fairnessEmpty}>לא הוגדרו אתרי צדק.</p>
                    ) : (
                      <div className={styles.fairnessTableWrap}>
                        <table className={styles.fairnessTable}>
                          <thead className={styles.fairnessThead}>
                            <tr>
                              <th className={styles.fairnessTh}>עובד</th>
                              {fairnessReport.sites.map(s => (
                                <th key={s.site_id} className={styles.fairnessTh}>{s.site_name}</th>
                              ))}
                              <th className={`${styles.fairnessTh} ${styles.fairnessThBold}`}>סה"כ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fairnessReport.workers.map(w => (
                              <tr key={w.worker_id} className={styles.fairnessTr}>
                                <td className={styles.fairnessTd}>{w.name}</td>
                                {fairnessReport.sites.map(s => (
                                  <td key={s.site_id} className={styles.fairnessTdCenter}>
                                    {w.counts[s.site_id] || 0}
                                  </td>
                                ))}
                                <td className={styles.fairnessTdTotal}>{w.total}</td>
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
                      <li key={actType.id} className={styles.itemRow}>
                        {editingKey === `activity-${actType.id}` ? (
                          <input className="config-inline-edit" value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={e => { if (e.key==='Enter') saveActivityTypeEdit(actType.id); if (e.key==='Escape') setEditingKey(null); }}
                            autoFocus style={{flex:1}} />
                        ) : (
                          <span className={styles.itemName}>{actType.name}</span>
                        )}
                        <select className={styles.groupMoveSelect}
                          value={actType.complexity_level || 1}
                          onChange={e => updateActivityTypeComplexity(actType.id, parseInt(e.target.value))}
                          title="רמת מורכבות">
                          <option value={1}>רמה 1</option>
                          <option value={2}>רמה 2</option>
                          <option value={3}>רמה 3</option>
                        </select>
                        {actGroups.length > 0 && editingKey !== `activity-${actType.id}` && (
                          <select
                            className={styles.groupMoveSelect}
                            value={actType.group_id || ''}
                            onChange={e => moveActivityTypeToGroup(actType.id, e.target.value ? parseInt(e.target.value) : null)}
                            title="העבר לקבוצה"
                          >
                            <option value="">ללא קבוצה</option>
                            {actGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                        )}
                        <div className="config-item-actions">
                          {editingKey === `activity-${actType.id}` ? (
                            <><button className="btn-save-inline" onClick={() => saveActivityTypeEdit(actType.id)}>שמור</button>
                              <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button></>
                          ) : (
                            <><button className="btn-edit-inline" onClick={() => { setEditingKey(`activity-${actType.id}`); setEditingValue(actType.name); setEditingComplexityLevel(actType.complexity_level || 1); }}>עריכה</button>
                              <button className="btn-remove" onClick={() => removeActivityType(actType.id, actType.name)}>✕</button></>
                          )}
                        </div>
                      </li>
                    );
                  }

                  function renderAddRow(groupId) {
                    const key = groupId ?? 'ungrouped';
                    return (
                      <div className={styles.addRow}>
                        <input className="config-inline-edit" style={{flex:1,fontSize:'0.82rem'}}
                          value={newActivityTypeByGroup[key] || ''}
                          onChange={e => setNewActivityTypeByGroup(prev => ({...prev,[key]:e.target.value}))}
                          placeholder="סוג פעילות חדש..."
                          onKeyDown={e => e.key==='Enter' && addActivityTypeInGroup(groupId)} />
                        <select className="config-inline-edit" style={{minWidth:'80px',fontSize:'0.82rem'}} value={newActivityTypeComplexityByGroup[key] || 1}
                          onChange={e => setNewActivityTypeComplexityByGroup(prev => ({...prev,[key]:parseInt(e.target.value)}))}>
                          <option value={1}>רמה 1</option>
                          <option value={2}>רמה 2</option>
                          <option value={3}>רמה 3</option>
                        </select>
                        <button className={`btn-add-config ${styles.addRowBtn}`} onClick={() => addActivityTypeInGroup(groupId)}>הוסף</button>
                      </div>
                    );
                  }

                  const actGroups = config.activity_type_groups || [];
                  const ungrouped = (config.activity_types || []).filter(at => !at.group_id);

                  return (
                    <div className={styles.columnGap2}>
                      {actGroups.map(group => {
                        const members = (config.activity_types || []).filter(at => at.group_id === group.id);
                        return (
                          <div key={group.id} className={styles.groupCard}>
                            <div className={styles.groupHeader}>
                              {editingKey === `actgroup-${group.id}` ? (
                                <input className="config-inline-edit" value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  onKeyDown={e => { if (e.key==='Enter') saveActivityTypeGroupEdit(group.id); if (e.key==='Escape') setEditingKey(null); }}
                                  autoFocus style={{flex:1}} />
                              ) : (
                                <span className={styles.actGroupNameDisplay}>{group.name}</span>
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
                            <div className={styles.groupContent}>
                              {members.length > 0 && (
                                <ul className={`config-list ${styles.configListReset}`}>{members.map(renderActivityTypeRow)}</ul>
                              )}
                              {renderAddRow(group.id)}
                            </div>
                          </div>
                        );
                      })}

                      {ungrouped.length > 0 && (
                        <div className={styles.groupCard}>
                          <div className={styles.groupHeader}>
                            <span className={styles.actGroupNameUngrouped}>ללא קבוצה</span>
                          </div>
                          <div className={styles.groupContent}>
                            <ul className={`config-list ${styles.configListReset}`}>{ungrouped.map(renderActivityTypeRow)}</ul>
                            {renderAddRow(null)}
                          </div>
                        </div>
                      )}

                      <div className={styles.addGroupBox}>
                        <div className={styles.addActGroupLabel}>הוספת קבוצה חדשה</div>
                        <div className={`config-add ${styles.configAddReset}`}>
                          <input value={newActivityTypeGroup} onChange={e => setNewActivityTypeGroup(e.target.value)}
                            placeholder="שם קבוצה..." onKeyDown={e => e.key==='Enter' && addActivityTypeGroup()} />
                          <button className="btn-primary" onClick={addActivityTypeGroup}>הוסף קבוצה</button>
                        </div>
                      </div>

                      {actGroups.length === 0 && ungrouped.length === 0 && (
                        <div className={styles.noActivities}>אין סוגי פעילות עדיין.</div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {activeTab === 'shifts' && (
              <div className={styles.shiftsTab}>
                <h3 className={styles.shiftsTitle}>שעות ברירת מחדל למשמרות</h3>
                <div className={styles.shiftsList}>
                  {(config.shift_types || []).filter(st => ['night', 'oncall'].includes(st.key)).map(st => {
                    const edit = shiftTimesEdits[st.key] || { default_start: st.default_start || '', default_end: st.default_end || '' };
                    const isDirty = !!shiftTimesEdits[st.key];
                    return (
                      <div key={st.key} className={styles.shiftCard}>
                        <div className={styles.shiftCardTitle}>{st.icon} {st.label_he}</div>
                        <div className={styles.shiftFields}>
                          <div className={styles.shiftField}>
                            <label className={styles.shiftLabel}>שעת התחלה</label>
                            <input
                              type="time"
                              className={styles.shiftInput}
                              value={edit.default_start}
                              onChange={e => setShiftTimesEdits(prev => ({...prev, [st.key]: {...edit, default_start: e.target.value}}))}
                            />
                          </div>
                          <div className={styles.shiftField}>
                            <label className={styles.shiftLabel}>שעת סיום (לחישוב משך)</label>
                            <input
                              type="time"
                              className={styles.shiftInput}
                              value={edit.default_end}
                              onChange={e => setShiftTimesEdits(prev => ({...prev, [st.key]: {...edit, default_end: e.target.value}}))}
                            />
                          </div>
                          <button
                            className="btn-primary"
                            onClick={() => saveShiftTimes(st.key)}
                            disabled={!isDirty}
                            style={{ '--btn-opacity': isDirty ? 1 : 0.4, opacity: 'var(--btn-opacity)' }}
                          >שמור</button>
                        </div>
                      </div>
                    );
                  })}
                  {(config.shift_types || []).filter(st => ['night', 'oncall'].includes(st.key)).length === 0 && (
                    <p className={styles.noShifts}>אין משמרות תורנות/כוננות מוגדרות במערכת.</p>
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
      <div className={`detail-modal ${styles.allowedJobsModal}`} onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>תפקידים מורשים — {site.name}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className={styles.allowedJobsContent}>
          {loading ? <p>טוען...</p> : (
            <>
              <div className={styles.allowedSection}>
                <h4 className={styles.allowedSectionTitle}>תפקידים מורשים:</h4>
                {allowedJobs.length === 0 ? (
                  <p className={styles.allowedEmpty}>ללא הגבלה — כל התפקידים מורשים לאתר זה</p>
                ) : (
                  <div className={styles.allowedList}>
                    {allowedJobs.map(j => (
                      <div key={j.job_id} className={styles.allowedItem}>
                        <span>{j.name}</span>
                        <button className={`btn-remove ${styles.allowedRemoveBtn}`}
                          onClick={() => removeAllowedJob(j.job_id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className={styles.allowedSectionTitle}>הוסף תפקיד:</h4>
                {availableJobs.length === 0 ? (
                  <p className={styles.allowedEmpty}>כל התפקידים כבר מורשים</p>
                ) : (
                  <div className={styles.allowedList}>
                    {availableJobs.map(j => (
                      <button key={j.id} className={styles.allowedAddBtn} onClick={() => addAllowedJob(j.id)}>
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
