import { useState, useEffect } from 'react';

export default function AdminPanel({ config, authToken, branchId, isSuperAdmin, branches = [], onConfigChange, onBranchesChange, onClose }) {
  const [newJob, setNewJob] = useState('');
  const [newEmpType, setNewEmpType] = useState('');
  const [newHonorific, setNewHonorific] = useState('');
  const [newSite, setNewSite] = useState('');
  const [newSiteGroup, setNewSiteGroup] = useState('');
  const [newActivityType, setNewActivityType] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [templateItems, setTemplateItems] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedActivityAuths, setExpandedActivityAuths] = useState({});
  const [groupAllowedJobsModal, setGroupAllowedJobsModal] = useState(null);
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'branches' : 'groups');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDesc, setNewBranchDesc] = useState('');
  const [localBranchId, setLocalBranchId] = useState(branchId);

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

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab, authToken]);

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

  async function addSite() {
    console.log('addSite called, newSite:', newSite);
    if (!newSite.trim()) {
      alert('אנא הזן שם אתר');
      return;
    }
    try {
      const res = await fetch(`/api/config/sites${branchParam()}`, {
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

  async function loadTemplates() {
    try {
      const res = await fetch(`/api/config/activity-templates${branchParam()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  async function createTemplate() {
    if (!newTemplateName.trim()) return;
    try {
      const res = await fetch(`/api/config/activity-templates${branchParam()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: newTemplateName.trim() }),
      });
      if (res.ok) {
        setNewTemplateName('');
        await loadTemplates();
      } else {
        const error = await res.json();
        alert('שגיאה: ' + (error.error || res.statusText));
      }
    } catch (error) {
      console.error('Error creating template:', error);
      alert('שגיאה בשמירת התבנית');
    }
  }

  async function renameTemplate(id, newName) {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`/api/config/activity-templates/${id}${branchParam()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setEditingKey(null);
        await loadTemplates();
      } else {
        const err = await res.json();
        alert('שגיאה: ' + (err.error || res.statusText));
      }
    } catch (error) {
      console.error('Error renaming template:', error);
      alert('שגיאה בשינוי שם');
    }
  }

  async function deleteTemplate(id) {
    if (!confirm('האם אתה בטוח?')) return;
    try {
      const res = await fetch(`/api/config/activity-templates/${id}${branchParam()}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (res.ok) {
        setSelectedTemplateId(null);
        await loadTemplates();
      } else {
        alert('שגיאה במחיקת התבנית');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('שגיאה במחיקת התבנית');
    }
  }

  async function selectTemplate(id) {
    setSelectedTemplateId(id);
    const template = templates.find(t => t.id === id);
    if (template) {
      const items = {};
      template.items.forEach(item => {
        items[`${item.site_id}-${item.shift_type}`] = item.activity_type_id;
      });
      setTemplateItems(items);
    }
  }

  async function saveTemplateItems() {
    if (!selectedTemplateId) return;
    const itemsArray = Object.entries(templateItems).map(([key, activityTypeId]) => {
      const [siteId, shiftType] = key.split('-');
      return {
        site_id: parseInt(siteId),
        shift_type: shiftType,
        activity_type_id: activityTypeId,
      };
    });

    try {
      const res = await fetch(`/api/config/activity-templates/${selectedTemplateId}/items${branchParam()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ items: itemsArray }),
      });
      if (res.ok) {
        await loadTemplates();
        alert('תבנית נשמרה בהצלחה');
      } else {
        alert('שגיאה בשמירת התבנית');
      }
    } catch (error) {
      console.error('Error saving template items:', error);
      alert('שגיאה בשמירת התבנית');
    }
  }

  const thStyle = { padding: '0.3rem 0.5rem', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' };

  const tabDescriptions = {
    branches: 'ניהול סניפים במערכת. כל סניף הוא יחידה עצמאית עם עובדים, אתרים והגדרות משלו. הוספת סניף מאפשרת לנהל יחידות ארגוניות נפרדות; מחיקת סניף תסיר את כל הנתונים הקשורים אליו.',
    groups: 'קבוצות אתרים מאגדות מספר אתרים לקטגוריה משותפת. ניתן להגביל לכל קבוצה אילו תפקידים מורשים לשמש בה — שינוי זה ישפיע על סינון עובדים בהצעות האוטומטיות.',
    sites: 'אתרים הם מקומות העבודה הפיזיים (לדוג׳ חדר ניתוח 1, IVF). הוספה/מחיקה משפיעה על לוח השיבוצים. סימון ⚖️ צדק יגרום למערכת לאזן שיבוצים לאתר זה בין עובדים בהצעות האוטומטיות.',
    jobs: 'תפקידים מגדירים את סוגי התפקידים האפשריים לעובד (לדוג׳ רופא מרדים, אחות). שינויים ישפיעו על אפשרויות הבחירה בטופס עובד חדש ועל הרשאות שיבוץ לקבוצות אתרים.',
    empTypes: 'סוגי העסקה מגדירים את מעמד ההעסקה של העובד (לדוג׳ קבוע, חלקי, חוזה). שינוי הרשימה ישפיע על אפשרויות הבחירה בעת יצירה או עריכה של עובד.',
    honorifics: 'תארים מגדירים את הכינוי הרשמי של העובד (לדוג׳ ד״ר, פרופ׳). שינויים ישפיעו על האופן שבו שמות העובדים מוצגים בכל חלקי המערכת.',
    activities: 'סוגי פעילות מגדירים סוגי עבודה ספציפיים שניתן להרשות לעובדים (לדוג׳ אנסתזיה כללית, ספינל). הרשאות אלו מיועדות לעובדים בנפרד ומשפיעות על הצעות השיבוץ האוטומטיות.',
    templates: 'תבניות מאפשרות לשמור הרכב מוגדר מראש של סוגי פעילות לאתרים ומשמרות. כשמיישמים תבנית על יום עבודה, כל האתרים מקבלים אוטומטית את סוג הפעילות שהוגדר בתבנית.',
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
    { key: 'sites', label: 'אתרים' },
    { key: 'jobs', label: 'תפקידים' },
    { key: 'empTypes', label: 'סוגי העסקה' },
    { key: 'honorifics', label: 'תארים' },
    { key: 'activities', label: 'סוגי פעילות' },
    { key: 'templates', label: 'תבניות' },
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
          <div style={{display: 'flex', gap: '0.2rem', borderBottom: '2px solid #e2e8f0', flexWrap: 'wrap', padding: '0.6rem 1rem 0', background: '#f1f5f9'}}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '0.5rem 0.9rem',
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
          <div style={{flex: 1, overflow: 'auto', padding: '1rem 1.25rem 1.25rem'}}>
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
                            <button
                              className="btn-edit-inline"
                              onClick={() => setGroupAllowedJobsModal(group)}
                              title="הגדר תפקידים מורשים"
                            >
                              תפקידים
                            </button>
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
                {groupAllowedJobsModal && (
                  <SiteGroupAllowedJobsModal
                    group={groupAllowedJobsModal}
                    authToken={authToken}
                    config={config}
                    onClose={() => setGroupAllowedJobsModal(null)}
                  />
                )}
              </>
            )}

            {activeTab === 'sites' && (
              <>
                <TabDescription tabKey="sites" />
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem'}}>
                  <div style={{width: 0}} />
                  <button
                    className="btn-primary"
                    onClick={fetchFairnessReport}
                    disabled={fairnessReportLoading}
                    style={{fontSize: '0.8rem', whiteSpace: 'nowrap', marginRight: '0.75rem', flexShrink: 0}}
                  >
                    {fairnessReportLoading ? 'טוען...' : '⚖️ טבלת צדק'}
                  </button>
                </div>
                <ul className="config-list">
                  {(config.sites || []).map(site => {
                    const isFairness = (config.fairness_sites || []).includes(site.id);
                    return (
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
                      <label title="כלול באיזון עומס (צדק)" style={{display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0}}>
                        <input type="checkbox" checked={isFairness} onChange={e => toggleFairnessSite(site.id, e.target.checked)} />
                        ⚖️ צדק
                      </label>
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
                    );
                  })}
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

            {activeTab === 'templates' && (
              <>
                <TabDescription tabKey="templates" />
                <div style={{display: 'flex', gap: '1rem', height: '100%'}}>
                  {/* Template list */}
                  <div style={{flex: '0 0 250px', borderRight: '1px solid #e5e7eb', paddingRight: '1rem', overflow: 'auto'}}>
                    <div className="config-add" style={{marginBottom: '1rem'}}>
                      <input
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        placeholder="שם תבנית חדשה..."
                        onKeyDown={e => e.key === 'Enter' && createTemplate()}
                      />
                      <button className="btn-primary" onClick={createTemplate} style={{width: '100%'}}>הוסף</button>
                    </div>
                    <ul className="config-list" style={{borderRight: 'none'}}>
                      {templates.map(template => (
                        <li key={template.id} style={{marginBottom: '0.5rem'}}>
                          {editingKey === `template-${template.id}` ? (
                            <div style={{display: 'flex', gap: '0.25rem', alignItems: 'center'}}>
                              <input
                                className="config-inline-edit"
                                style={{flex: 1}}
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') renameTemplate(template.id, editingValue);
                                  if (e.key === 'Escape') setEditingKey(null);
                                }}
                                autoFocus
                              />
                              <button className="btn-save-inline" onClick={() => renameTemplate(template.id, editingValue)}>שמור</button>
                              <button className="btn-remove" onClick={() => setEditingKey(null)}>✕</button>
                            </div>
                          ) : (
                            <div style={{display: 'flex', gap: '0.25rem', alignItems: 'center'}}>
                              <button
                                onClick={() => selectTemplate(template.id)}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  background: selectedTemplateId === template.id ? '#1a2e4a' : '#f3f4f6',
                                  color: selectedTemplateId === template.id ? 'white' : '#333',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  textAlign: 'right',
                                }}
                              >
                                {template.name}
                              </button>
                              <button className="btn-edit-inline" onClick={() => { setEditingKey(`template-${template.id}`); setEditingValue(template.name); }}>עריכה</button>
                              <button className="btn-remove" onClick={() => deleteTemplate(template.id)}>✕</button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Template editor */}
                  {selectedTemplateId && (
                    <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                      <h3 style={{margin: 0}}>עריכת תבנית</h3>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        flex: 1,
                        overflow: 'auto',
                      }}>
                        {(config.sites || []).map(site => (
                          <div key={site.id} style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                            <div style={{fontSize: '0.8rem', fontWeight: 600}}>{site.name}</div>
                            {(config.shift_types || []).filter(st => ['morning', 'evening'].includes(st.key)).map(st => (
                              <div key={st.key} style={{display: 'flex', gap: '0.25rem', alignItems: 'center', fontSize: '0.75rem'}}>
                                <label style={{flex: '0 0 40px'}}>{st.label_he}</label>
                                <select
                                  value={templateItems[`${site.id}-${st.key}`] || ''}
                                  onChange={e => {
                                    const key = `${site.id}-${st.key}`;
                                    if (e.target.value) {
                                      setTemplateItems({...templateItems, [key]: parseInt(e.target.value)});
                                    } else {
                                      const newItems = {...templateItems};
                                      delete newItems[key];
                                      setTemplateItems(newItems);
                                    }
                                  }}
                                  style={{flex: 1, fontSize: '0.75rem', padding: '0.25rem'}}
                                >
                                  <option value="">ללא</option>
                                  {(config.activity_types || []).map(at => (
                                    <option key={at.id} value={at.id}>{at.name}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <button className="btn-primary" onClick={saveTemplateItems} style={{alignSelf: 'flex-start'}}>שמור תבנית</button>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function SiteGroupAllowedJobsModal({ group, authToken, config, onClose }) {
  const [allowedJobs, setAllowedJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAllowedJobs(); }, [group.id]);

  async function fetchAllowedJobs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/config/site-groups/${group.id}/allowed-jobs`, {
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
    const res = await fetch(`/api/config/site-groups/${group.id}/allowed-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ job_id: jobId }),
    });
    if (res.ok) setAllowedJobs(await res.json());
    else { const err = await res.json(); alert('שגיאה: ' + (err.error || 'לא ניתן להוסיף')); }
  }

  async function removeAllowedJob(jobId) {
    const res = await fetch(`/api/config/site-groups/${group.id}/allowed-jobs/${jobId}`, {
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
          <h2>תפקידים מורשים — {group.name}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '1rem', fontSize: '0.9rem' }}>
          {loading ? <p>טוען...</p> : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem', color: '#1a2e4a' }}>תפקידים מורשים:</h4>
                {allowedJobs.length === 0 ? (
                  <p style={{ color: '#666' }}>ללא הגבלה — כל התפקידים מורשים</p>
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
