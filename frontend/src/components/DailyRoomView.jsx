import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDraggableModal } from '../hooks/useDraggableModal';
import TimePickerInput from './TimePickerInput';

function Tip({ text, children }) {
  const [pos, setPos] = useState(null);
  const tipRef = useRef(null);

  useEffect(() => {
    if (!tipRef.current || !pos) return;
    const r = tipRef.current.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) {
      tipRef.current.style.left = (window.innerWidth - 8 - r.width) + 'px';
      tipRef.current.style.transform = 'none';
    }
    if (r.left < 8) {
      tipRef.current.style.left = '8px';
      tipRef.current.style.transform = 'none';
    }
  }, [pos]);

  return (
    <div style={{ display: 'contents' }}
      onMouseEnter={e => { const r = e.currentTarget.firstElementChild.getBoundingClientRect(); setPos({ x: r.left + r.width / 2, y: r.bottom }); }}
      onMouseLeave={() => setPos(null)}>
      {children}
      {pos && createPortal(
        <div ref={tipRef} style={{
          position: 'fixed', left: pos.x, top: pos.y + 6,
          transform: 'translateX(-50%)',
          background: '#fffde7', color: '#333', border: '1px solid #ccc',
          fontSize: '0.78rem', padding: '0.25rem 0.55rem',
          borderRadius: '4px', whiteSpace: 'nowrap',
          zIndex: 2147483647, pointerEvents: 'none',
          direction: 'rtl', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}>{text}</div>,
        document.body
      )}
    </div>
  );
}

const GROUP_PALETTE = ['#7c3aed', '#0369a1', '#0e7490', '#b45309', '#15803d', '#be185d', '#6d28d9', '#b45309'];
const PALETTE_BG    = ['#f5f3ff', '#eff6ff', '#f0fdfa', '#fffbeb', '#f0fdf4', '#fdf2f8', '#f5f3ff', '#fffbeb'];

function TemplateItemsEditor({ config, items, onChange }) {
  const siteGroups = config.site_groups || [];
  const sites = config.sites || [];
  const activityTypes = config.activity_types || [];
  const shiftTypes = (config.shift_types || []).filter(st => ['morning', 'evening'].includes(st.key));

  // Assign a stable color to each group by its position in siteGroups
  const groupColorMap = Object.fromEntries(
    siteGroups.map((g, i) => [g.id, { color: GROUP_PALETTE[i % GROUP_PALETTE.length], bg: PALETTE_BG[i % PALETTE_BG.length] }])
  );
  const ungroupedColor = { color: '#6b7280', bg: '#f9fafb' };

  function getGroupColor(groupId) {
    return groupId && groupColorMap[groupId] ? groupColorMap[groupId] : ungroupedColor;
  }

  const [shownSiteIds, setShownSiteIds] = useState(() =>
    new Set(Object.keys(items).map(k => parseInt(k.split('-')[0])))
  );
  const [groupFilter, setGroupFilter] = useState(null); // null = הכל

  const shownSites = sites.filter(s => shownSiteIds.has(s.id));
  const availableSites = sites.filter(s => !shownSiteIds.has(s.id));

  // Groups that have at least one available site
  const availableGroups = siteGroups.filter(g => availableSites.some(s => s.group_id === g.id));
  const hasUngroupedAvailable = availableSites.some(s => !s.group_id && !siteGroups.some(g => g.id === s.group_id));

  const filteredAvailable = groupFilter === null
    ? availableSites
    : groupFilter === '__none__'
      ? availableSites.filter(s => !siteGroups.some(g => g.id === s.group_id))
      : availableSites.filter(s => s.group_id === groupFilter);

  function groupSites(list) {
    const result = [];
    const used = new Set();
    siteGroups.forEach(g => {
      const gs = list.filter(s => s.group_id === g.id);
      if (gs.length) { result.push({ label: g.name, groupId: g.id, sites: gs }); gs.forEach(s => used.add(s.id)); }
    });
    const rest = list.filter(s => !used.has(s.id));
    if (rest.length) result.push({ label: 'כללי', groupId: null, sites: rest });
    return result;
  }

  function addSite(siteId) {
    setShownSiteIds(prev => new Set([...prev, siteId]));
  }

  function removeSite(siteId) {
    setShownSiteIds(prev => { const n = new Set(prev); n.delete(siteId); return n; });
    const next = { ...items };
    Object.keys(next).forEach(k => { if (parseInt(k.split('-')[0]) === siteId) delete next[k]; });
    onChange(next);
  }

  function handleShiftChange(siteId, shiftKey, value) {
    const key = `${siteId}-${shiftKey}`;
    if (value) {
      onChange({ ...items, [key]: parseInt(value) });
    } else {
      const next = { ...items };
      delete next[key];
      onChange(next);
    }
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {shownSites.length === 0 ? (
        <p style={{ color: '#d1d5db', textAlign: 'center', margin: '1.5rem 0', fontSize: '0.85rem' }}>
          אין חדרים בתבנית — הוסף חדרים מהרשימה למטה
        </p>
      ) : (
        groupSites(shownSites).map(group => {
          const { color, bg } = getGroupColor(group.groupId);
          return (
          <div key={group.label} style={{ marginBottom: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.7rem', color, background: bg, borderRight: `3px solid ${color}`, paddingRight: '0.35rem', paddingBottom: '0.1rem', paddingTop: '0.1rem', marginBottom: '0.25rem', borderRadius: '0 3px 3px 0' }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.25rem' }}>
              {group.sites.map(site => (
                <div key={site.id} style={{ background: '#fff', border: `1.5px solid ${color}`, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ background: color, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.15rem 0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#fff' }}>{site.name}</span>
                    <button onClick={() => removeSite(site.id)} title="הסר חדר מהתבנית"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: '0.7rem', lineHeight: 1, padding: 0 }}>✕</button>
                  </div>
                  <div style={{ padding: '0.2rem 0.35rem' }}>
                  {shiftTypes.map(st => (
                    <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.1rem', fontSize: '0.68rem' }}>
                      <label style={{ flex: '0 0 28px', color: '#6b7280' }}>{st.label_he}</label>
                      <select
                        value={items[`${site.id}-${st.key}`] || ''}
                        onChange={e => handleShiftChange(site.id, st.key, e.target.value)}
                        style={{ flex: 1, fontSize: '0.68rem', padding: '0.1rem' }}
                      >
                        <option value="">ללא</option>
                        {activityTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
                      </select>
                    </div>
                  ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );})
      )}

      {availableSites.length > 0 && (
        <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#1a2e4a', background: '#f1f5f9', borderRight: '3px solid #1a2e4a', paddingRight: '0.4rem', paddingTop: '0.1rem', paddingBottom: '0.1rem', borderRadius: '0 3px 3px 0', marginBottom: '0.25rem' }}>הוסף חדר לתבנית</div>
          {(availableGroups.length > 0 || hasUngroupedAvailable) && (
            <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
              {(() => {
                const active = groupFilter === null;
                return (
                  <button onClick={() => setGroupFilter(null)}
                    style={{ padding: '0.1rem 0.4rem', fontSize: '0.66rem', borderRadius: '999px', border: '1.5px solid #374151', background: active ? '#374151' : '#d1d5db', color: active ? '#fff' : '#374151', cursor: 'pointer', fontWeight: 600, boxShadow: active ? '0 0 0 2px #37415133' : 'none' }}>
                    הכל
                  </button>
                );
              })()}
              {availableGroups.map(g => {
                const { color, bg } = getGroupColor(g.id);
                const active = groupFilter === g.id;
                return (
                  <button key={g.id} onClick={() => setGroupFilter(g.id)}
                    style={{ padding: '0.1rem 0.4rem', fontSize: '0.66rem', borderRadius: '999px', border: `1.5px solid ${color}`, background: active ? color : bg, color: active ? '#fff' : color, cursor: 'pointer', fontWeight: 600, boxShadow: active ? `0 0 0 2px ${color}33` : 'none' }}>
                    {g.name}
                  </button>
                );
              })}
              {hasUngroupedAvailable && (() => {
                const { color, bg } = ungroupedColor;
                const active = groupFilter === '__none__';
                return (
                  <button onClick={() => setGroupFilter('__none__')}
                    style={{ padding: '0.1rem 0.4rem', fontSize: '0.66rem', borderRadius: '999px', border: `1.5px solid ${color}`, background: active ? color : bg, color: active ? '#fff' : color, cursor: 'pointer', fontWeight: 600, boxShadow: active ? `0 0 0 2px ${color}33` : 'none' }}>
                    כללי
                  </button>
                );
              })()}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {filteredAvailable.map(site => (
              <button key={site.id} onClick={() => addSite(site.id)}
                style={{ padding: '0.1rem 0.4rem', fontSize: '0.66rem', background: '#d1d5db', border: '1px dashed #d1d5db', borderRadius: '4px', cursor: 'pointer', color: '#374151' }}>
                + {site.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DrvTimePickerInput({ value, onChange }) {
  const [exactMode, setExactMode] = useState(false);
  const [exactRaw, setExactRaw] = useState('');
  const slots = Array.from({ length: 96 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  });
  const nearest = (() => {
    if (!value) return '00:00';
    const [hh, mm] = value.split(':').map(Number);
    const total = hh * 60 + mm;
    const rounded = Math.round(total / 15) * 15;
    const nh = Math.min(23, Math.floor(rounded / 60));
    const nm = rounded % 60;
    return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
  })();
  function commitExact(v) {
    const match = v.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const nh = Math.min(23, parseInt(match[1]));
      const nm = Math.min(59, parseInt(match[2]));
      onChange(`${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`);
    }
    setExactMode(false);
    setExactRaw('');
  }
  return (
    <span className="drv-tp-wrap" dir="ltr">
      {exactMode ? (
        <input
          className="drv-tp-exact"
          value={exactRaw}
          onChange={e => setExactRaw(e.target.value)}
          onBlur={e => commitExact(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setExactMode(false); setExactRaw(''); } }}
          placeholder={value?.slice(0,5) || '--:--'}
          maxLength={5}
          autoFocus
          dir="ltr"
        />
      ) : (
        <>
          <select value={value ? nearest : ''} onChange={e => onChange(e.target.value)} className="drv-tp-select">
            <option value="">--:--</option>
            {slots.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="drv-tp-exact-btn" title="הקלד שעה מדויקת"
            onClick={() => { setExactRaw(value?.slice(0,5) || ''); setExactMode(true); }}>✎</button>
        </>
      )}
    </span>
  );
}

export default function DailyRoomView({ config, authToken, branchId }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [shiftRequests, setShiftRequests] = useState([]);
  const [siteShiftActivities, setSiteShiftActivities] = useState([]);
  const [workerAuthorizations, setWorkerAuthorizations] = useState({}); // worker_id -> [activity_type_id]
  const [loading, setLoading] = useState(false);
  const [vacations, setVacations] = useState([]);

  // Derive shift time defaults from config
  const shiftDefaults = Object.fromEntries(
    (config.shift_types || []).map(st => [st.key, st])
  );
  const morningStart = shiftDefaults.morning?.default_start || '07:00';
  const morningEnd   = shiftDefaults.morning?.default_end   || '15:00';
  const eveningStart = shiftDefaults.evening?.default_start || '15:00';
  const eveningEnd   = shiftDefaults.evening?.default_end   || '23:00';
  const nightStart   = shiftDefaults.night?.default_start   || '23:00';
  const nightEnd     = shiftDefaults.night?.default_end     || '07:00';

  // Derive preference labels from config
  const prefLabel = Object.fromEntries(
    (config.preference_types || []).map(p => [p.key, p.label_he])
  );

  // Modal for group details
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // Modal for site details
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [modalPos, setModalPos] = useState(null); // {x, y} when dragged; null = centered
  const modalDragRef = useRef(null);
  const [siteActivityTypes, setSiteActivityTypes] = useState({}); // Map of site_id -> activity_type_id
  const [siteShiftTimes, setSiteShiftTimes] = useState({}); // Map of "site_id-shift_type" -> { start_time, end_time }
  const [editingShiftTimes, setEditingShiftTimes] = useState(null); // { site_id, shift_type, start_time, end_time } - for modal editing
  const dragShiftTimes    = useDraggableModal();
  const dragAssignment    = useDraggableModal();
  const dragSaveTemplate  = useDraggableModal();
  const dragTemplateSel   = useDraggableModal();
  const dragTemplateMgr   = useDraggableModal();
  const dragEditTemplate  = useDraggableModal();
  const dragCreateTpl     = useDraggableModal();
  const dragSuggestion    = useDraggableModal();
  const dragSendModal     = useDraggableModal();
  const dragFairness      = useDraggableModal();
  const [inlineEditingShift, setInlineEditingShift] = useState(null); // "site_id-shift_type" for inline time editing
  const [inlineEditTimes, setInlineEditTimes] = useState({ start_time: '', end_time: '' });
  const [inlineEditingActivity, setInlineEditingActivity] = useState(null); // "site_id-shift_type" for inline activity editing
  const [inlineActivityTypeId, setInlineActivityTypeId] = useState(null);
  const [inlineActivityGroupFilter, setInlineActivityGroupFilter] = useState('');
  const [shiftNotes, setShiftNotes] = useState({}); // Map of "site_id-shift_type" -> notes
  const [inlineEditingNotes, setInlineEditingNotes] = useState(null); // "site_id-shift_type" for inline notes editing
  const [inlineNotes, setInlineNotes] = useState('');
  const [addingToShiftInSite, setAddingToShiftInSite] = useState(null); // { site_id, shift_type } - for adding within site modal
  const [selectedShiftModal, setSelectedShiftModal] = useState(null); // { site_id, shift_type } for ShiftManagementModal
  const dragShiftMgmt = useDraggableModal();

  // Fairness report
  const [fairnessReport, setFairnessReport] = useState(null);
  const [fairnessLoading, setFairnessLoading] = useState(false);

  async function fetchFairnessReport() {
    setFairnessLoading(true);
    try {
      const res = await fetch(`/api/fairness-report${branchId ? `?branch_id=${branchId}` : ''}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setFairnessReport(await res.json());
      else alert('שגיאה בטעינת טבלת צדק');
    } finally {
      setFairnessLoading(false);
    }
  }

  // Add assignment state
  const [newAssignment, setNewAssignment] = useState({ worker_id: null });
  const [showAllWorkers, setShowAllWorkers] = useState(false);
  const [jobFilter, setJobFilter] = useState(null); // Filter by job when showing all workers
  const [barsCollapsed, setBarsCollapsed] = useState(true);

  // Edit times modal
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editTimes, setEditTimes] = useState({ start_time: '', end_time: '', notes: '' });


  const datePickerRef = useRef(null);

  // Report preview modal
  const [showReportPreview, setShowReportPreview] = useState(false);

  // Template selector modal
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplateName, setEditingTemplateName] = useState('');

  // Save as template modal
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [saveAsTemplateName, setSaveAsTemplateName] = useState('');
  const [saveAsTemplateGroupId, setSaveAsTemplateGroupId] = useState('');

  // Template manager modal (list)
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [managerEditingId, setManagerEditingId] = useState(null);
  const [managerEditingName, setManagerEditingName] = useState('');
  const [templateGroups, setTemplateGroups] = useState([]);

  // Template edit modal (full editor)
  const [editTemplateId, setEditTemplateId] = useState(null);
  const [editTemplateItems, setEditTemplateItems] = useState({});
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateGroupId, setEditTemplateGroupId] = useState(null);

  // Create new template modal
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateItems, setNewTemplateItems] = useState({});
  const [newTemplateGroupId, setNewTemplateGroupId] = useState(null);

  // Suggestions modal
  const [suggestionModal, setSuggestionModal] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Coverage needs (event session ↔ site assignment conflicts)
  const [coverageNeeds, setCoverageNeeds] = useState([]);
  const [coverageModal, setCoverageModal] = useState(null); // { need } | null

  // Send schedule modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendWorkerIds, setSendWorkerIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [previewMessages, setPreviewMessages] = useState(null); // null=selection, array=preview
  const [expandedPreviewId, setExpandedPreviewId] = useState(null);

  // Site card size
  const [cardSize, setCardSize] = useState(148);
  const MIN_CARD = 90;
  const MAX_CARD = 280;
  const STEP = 20;

  const [restWarning, setRestWarning] = useState(null);
  const checkMobile = () => {
    const isMobileCalc = window.innerWidth < 768;
    console.log('Mobile check:', { width: window.innerWidth, isMobile: isMobileCalc });
    return isMobileCalc;
  };
  const [isMobile, setIsMobile] = useState(checkMobile);


  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();
  const day = viewDate.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  useEffect(() => { fetchAll(); }, [month, year, authToken, branchId]);
  useEffect(() => { fetchCoverageNeeds(); }, [dateStr, authToken, branchId]);

  useEffect(() => {
    const handler = () => setIsMobile(checkMobile());
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Auto-select "all" on mount
  useEffect(() => {
    if (config.site_groups?.length && !selectedGroupId) {
      setSelectedGroupId('__all__');
    }
  }, [config.site_groups, config.sites]);

  async function fetchAll() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, year });
      if (branchId) params.set('branch_id', branchId);
      const [staffRes, shiftRes, vacRes] = await Promise.all([
        fetch(`/api/staffing/month-view?${params}`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`/api/shift-requests/admin/all-with-workers?${params}`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`/api/vacation-requests?status=approved${branchId ? `&branch_id=${branchId}` : ''}`, { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      if (staffRes.ok) {
        const d = await staffRes.json();
        setWorkers(d.workers || []);
        setAssignments(d.siteAssignments || []);
        setSiteShiftActivities(d.siteShiftActivities || []);
        setWorkerAuthorizations(d.workerAuthorizations || {});
      }
      if (shiftRes.ok) {
        const d = await shiftRes.json();
        setShiftRequests(d.requests || []);
      }
      if (vacRes.ok) setVacations(await vacRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCoverageNeeds() {
    try {
      const params = new URLSearchParams({ date: dateStr });
      if (branchId) params.set('branch_id', branchId);
      const res = await fetch(`/api/staffing/coverage-needs?${params}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCoverageNeeds(data.needs || []);
      }
    } catch (err) {
      console.error('Error fetching coverage needs:', err);
    }
  }

  async function assignCoverage(need, workerId) {
    try {
      await fetch('/api/staffing/coverage-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          original_assignment_id: need.original_assignment.id,
          event_session_id: need.session.id,
          coverage_worker_id: workerId,
          coverage_from_time: need.session.start_time,
          coverage_to_time: need.session.end_time,
          branch_id: branchId || null,
        }),
      });
      await fetchCoverageNeeds();
      setCoverageModal(null);
    } catch (err) {
      alert('שגיאה בשיבוץ מחליף');
    }
  }

  async function removeCoverage(coverageRequestId) {
    try {
      await fetch(`/api/staffing/coverage-requests/${coverageRequestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      await fetchCoverageNeeds();
      setCoverageModal(null);
    } catch (err) {
      alert('שגיאה בביטול כיסוי');
    }
  }

  async function fetchSuggestions() {
    setSuggestLoading(true);
    try {
      const suggestParams = new URLSearchParams({ date: dateStr });
      if (branchId) suggestParams.set('branch_id', branchId);
      const res = await fetch(`/api/staffing/suggest?${suggestParams}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const selected = {};
        (data.suggestions || []).forEach((_, i) => {
          selected[i] = true;
        });
        setSuggestionModal({
          suggestions: data.suggestions || [],
          unassignable: data.unassignable || [],
          selected
        });
      } else {
        // If endpoint returns 404, show helpful message
        if (res.status === 404) {
          alert('⚠️ הfeature עדיין לא זמין.\n\nאנא וודא שה-backend server רץ עם הקוד העדכני.\n\nפתרון: סגור את VSCode והפעל:\ncd backend && npm start');
        } else {
          try {
            const errData = await res.json();
            alert(`שגיאה: ${errData.error || 'שגיאה בserver'}`);
          } catch (parseErr) {
            alert('שגיאה בserver. אנא רענן את הדף ונסה שוב.');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      alert(`שגיאה בהצעת שיבוצים: ${err.message}`);
    } finally {
      setSuggestLoading(false);
    }
  }

  async function previewSchedule() {
    if (sendWorkerIds.length === 0) { alert('בחר לפחות עובד אחד'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/send-schedule-chat/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ date: dateStr, workerIds: sendWorkerIds }),
      });
      const data = await res.json();
      if (res.ok) { setPreviewMessages(data); setExpandedPreviewId(null); }
      else alert(`שגיאה: ${data.error || 'שגיאה בserver'}`);
    } catch (err) {
      alert(`שגיאה: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  async function sendSchedule() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/send-schedule-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ date: dateStr, workerIds: sendWorkerIds }),
      });
      const data = await res.json();
      if (res.ok) { setSendResult(data); setPreviewMessages(null); }
      else alert(`שגיאה: ${data.error || 'שגיאה בserver'}`);
    } catch (err) {
      alert(`שגיאה בשליחת תוכנית: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  function prevDay()   { setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)); }
  function nextDay()   { setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); }
  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate())); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate())); }
  function prevYear()  { setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), d.getDate())); }
  function nextYear()  { setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())); }

  function getSiteShiftAssignments(siteId, shiftType) {
    return assignments.filter(a => a.site_id === siteId && a.date === dateStr && a.shift_type === shiftType);
  }

  function compareTime(time1, time2) {
    const [h1 = 0, m1 = 0] = (time1 || '00:00').split(':').map(Number);
    const [h2 = 0, m2 = 0] = (time2 || '00:00').split(':').map(Number);
    const mins1 = h1 * 60 + m1;
    const mins2 = h2 * 60 + m2;
    if (mins1 < mins2) return -1;
    if (mins1 > mins2) return 1;
    return 0;
  }

  function isTimeRangeCovered(assignments, defaultStart, defaultEnd) {
    if (assignments.length === 0 || !defaultStart || !defaultEnd) return false;
    // Assignments with explicit times
    const withTimes = assignments.filter(a => a.start_time && a.end_time);
    // Assignments without any explicit times (assume full shift coverage)
    const withoutTimes = assignments.filter(a => !a.start_time && !a.end_time);

    // If we have workers without explicit times, they cover the full shift
    if (withoutTimes.length > 0) return true;

    // Otherwise, check if explicit times cover the full range
    if (withTimes.length === 0) return false;
    const sorted = withTimes.sort((a, b) => compareTime(a.start_time, b.start_time));
    console.log('Coverage check:', { defaultStart, defaultEnd, assignments: sorted.map(a => ({ name: `${a.first_name} ${a.family_name}`, start: a.start_time, end: a.end_time })) });
    if (compareTime(sorted[0].start_time, defaultStart) > 0) {
      console.log('NOT covered: first starts after default start', sorted[0].start_time, '>', defaultStart);
      return false;
    }
    if (compareTime(sorted[sorted.length - 1].end_time, defaultEnd) < 0) {
      console.log('NOT covered: last ends before default end', sorted[sorted.length - 1].end_time, '<', defaultEnd);
      return false;
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      if (compareTime(sorted[i].end_time, sorted[i + 1].start_time) < 0) {
        console.log('NOT covered: gap between assignments', sorted[i].end_time, 'to', sorted[i + 1].start_time);
        return false;
      }
    }
    console.log('COVERED: all checks passed');
    return true;
  }

  const dayRequests = shiftRequests.filter(r => r.date === dateStr);
  const assignedWorkerIdsByShift = assignments
    .filter(a => a.date === dateStr)
    .reduce((map, a) => {
      if (!map[a.shift_type]) map[a.shift_type] = new Set();
      map[a.shift_type].add(a.worker_id);
      return map;
    }, {});
  const availabilityShifts = (config.shift_types || []).filter(st => st.show_in_availability_bar);
  const requestsByShift = Object.fromEntries(
    availabilityShifts.map(st => [st.key, dayRequests.filter(r => r.shift_type === st.key && r.preference_type !== 'cannot')])
  );

  function resolveTime(assignment, shiftType, field) {
    if (assignment[field]) return assignment[field];
    const sd = shiftDefaults[shiftType];
    return field === 'start_time' ? (sd?.default_start || eveningStart) : (sd?.default_end || eveningEnd);
  }

  function openAddModalInSite(siteId, shiftType) {
    const shiftTimes = getSiteShiftTimes(siteId, shiftType);
    setAddingToShiftInSite({ site_id: siteId, shift_type: shiftType });
    setNewAssignment({ worker_id: null, start_time: shiftTimes.start_time, end_time: shiftTimes.end_time, notes: '' });
    setShowAllWorkers(false);
  }

  function openEditModal(assignment) {
    setEditingAssignment(assignment);
    const defaults = getSiteShiftTimes(assignment.site_id, assignment.shift_type);
    setEditTimes({
      start_time: assignment.start_time || defaults.start_time || '',
      end_time:   assignment.end_time   || defaults.end_time   || '',
      notes:      assignment.notes      || '',
    });
  }

  async function saveNewAssignment() {
    if (!addingToShiftInSite || !newAssignment.worker_id) {
      return;
    }

    // Check if worker has a shift request for this date+shift with can/prefer
    const hasRequest = didWorkerRequestShift(newAssignment.worker_id, addingToShiftInSite.shift_type);

    if (!hasRequest) {
      const worker = workers.find(w => w.id === newAssignment.worker_id);
      const shiftLabel = shiftDefaults[addingToShiftInSite.shift_type]?.label_he || addingToShiftInSite.shift_type;
      const confirmed = window.confirm(
        `⚠️ ${worker?.first_name} ${worker?.family_name} לא ביקש לעבוד ב${shiftLabel}.\n\nהאם אתה בטוח שברצונך לשבץ אותו?`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const res = await fetch('/api/worker-site-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          worker_id:               newAssignment.worker_id,
          date:                    dateStr,
          site_id:                 addingToShiftInSite.site_id,
          shift_type:              addingToShiftInSite.shift_type,
          start_time:              newAssignment.start_time || null,
          end_time:                newAssignment.end_time   || null,
          notes:                   null,
          site_shift_activity_id:  addingToShiftInSite.activity_id || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.warning) setRestWarning(data.warning);
        fetchAll();
        setAddingToShiftInSite(null);
        setNewAssignment({ worker_id: null });
        setShowAllWorkers(false);
      } else {
        const err = await res.json();
        console.error('POST error:', res.status, err);
        alert('שגיאה: ' + (err.error || 'לא ניתן להוסיף שיבוץ'));
      }
    } catch (err) {
      console.error('Network error:', err);
      alert('שגיאת חיבור לשרת: ' + err.message);
    }
  }

  function getSiteShiftActivities(siteId, shiftType) {
    return siteShiftActivities
      .filter(ssa => ssa.site_id === siteId && ssa.date === dateStr && ssa.shift_type === shiftType)
      .sort((a, b) => (a.sort_order - b.sort_order) || (a.start_time || '').localeCompare(b.start_time || ''));
  }

  function getSiteShiftActivity(siteId, shiftType) {
    const list = getSiteShiftActivities(siteId, shiftType);
    return list[0];
  }

  function getSiteShiftTimes(siteId, shiftType) {
    const key = `${siteId}-${shiftType}`;
    const custom = siteShiftTimes[key];
    if (custom) return custom;

    const sd = shiftDefaults[shiftType];
    const fallbacks = { morning: [morningStart, morningEnd], evening: [eveningStart, eveningEnd], night: [nightStart, nightEnd], oncall: [null, null] };
    const [fs, fe] = fallbacks[shiftType] || [morningStart, morningEnd];
    return { start_time: sd?.default_start || fs, end_time: sd?.default_end || fe };
  }

  function saveSiteShiftTimes(siteId, shiftType, startTime, endTime) {
    const key = `${siteId}-${shiftType}`;
    setSiteShiftTimes(prev => ({
      ...prev,
      [key]: { start_time: startTime, end_time: endTime }
    }));
  }

  function getShiftNotes(siteId, shiftType) {
    const key = `${siteId}-${shiftType}`;
    return shiftNotes[key] || '';
  }

  function saveShiftNotes(siteId, shiftType, notes) {
    const key = `${siteId}-${shiftType}`;
    setShiftNotes(prev => ({
      ...prev,
      [key]: notes
    }));
  }

  function isWorkerOnVacation(workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return null;
    const vac = vacations.find(v =>
      Number(v.worker_id) === Number(workerId) &&
      (v.status === 'approved' || v.status === 'partial') &&
      v.approved_start && v.approved_end &&
      v.approved_start <= dateStr && v.approved_end >= dateStr
    );
    return vac || null;
  }

  function didWorkerRequestShift(workerId, shiftType) {
    return shiftRequests.some(r =>
      r.worker_id === workerId &&
      r.date === dateStr &&
      r.shift_type === shiftType &&
      (r.preference_type === 'can' || r.preference_type === 'prefer')
    );
  }

  function getEligibleWorkers(siteId, shiftType) {
    // Find site's group
    const site = config.sites?.find(s => s.id === siteId);
    const groupId = site?.group_id;

    // Get allowed jobs for this group (if restrictions exist)
    const allowedJobs = groupId ? config.site_group_allowed_jobs?.[groupId] : null;
    const hasJobRestrictions = allowedJobs && allowedJobs.length > 0;

    // Get all activity types for this site/shift/date
    const shiftActivities = getSiteShiftActivities(siteId, shiftType).filter(a => a.activity_type_id);
    const activityTypeIds = shiftActivities.map(a => a.activity_type_id);

    const allWorkers = hasJobRestrictions
      ? workers.filter(w => allowedJobs.some(j => j.job_id === w.job_id))
      : workers;

    // Filter by activity authorization: worker must be authorized for ALL activity types.
    // If not fully authorized, they still appear (with warning) — handled by server on save.
    const authFiltered = activityTypeIds.length > 0
      ? allWorkers.filter(w => {
          const auths = workerAuthorizations[w.id] || [];
          return activityTypeIds.every(id => auths.includes(id));
        })
      : allWorkers;

    if (showAllWorkers) {
      return authFiltered;
    }

    // Get workers with shift request for today with can/prefer
    return authFiltered.filter(w => didWorkerRequestShift(w.id, shiftType));
  }

  function getWorkerOtherAssignments(workerId, shiftType) {
    // Get all other site assignments for this worker on the same shift today
    return assignments.filter(a =>
      a.worker_id === workerId &&
      a.date === dateStr &&
      a.shift_type === shiftType
    ).map(a => {
      const site = config.sites.find(s => s.id === a.site_id);
      return site ? site.name : `אתר לא ידוע (${a.site_id})`;
    });
  }

  async function saveEditTimes() {
    try {
      const res = await fetch(`/api/worker-site-assignments/${editingAssignment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(editTimes),
      });
      if (res.ok) { fetchAll(); setEditingAssignment(null); }
      else { const e = await res.json(); alert('שגיאה: ' + (e.error || 'עדכון נכשל')); }
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteAssignment(id) {
    try {
      const res = await fetch(`/api/worker-site-assignments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) fetchAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function updateSiteShiftActivity(siteId, shiftType, activityTypeId) {
    try {
      const res = await fetch('/api/site-shift-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          site_id: siteId,
          date: dateStr,
          shift_type: shiftType,
          activity_type_id: activityTypeId || null,
        }),
      });
      if (res.ok) fetchAll();
      else {
        const err = await res.json();
        console.error('Error updating activity:', err);
      }
    } catch (err) {
      console.error('Network error:', err);
    }
  }

  async function addShiftActivity(siteId, shiftType, activityTypeId) {
    const res = await fetch('/api/site-shift-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ site_id: siteId, date: dateStr, shift_type: shiftType, activity_type_id: activityTypeId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'שגיאה');
    }
    fetchAll();
  }

  async function deleteShiftActivity(activityId) {
    const res = await fetch(`/api/site-shift-activities/${activityId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) fetchAll();
  }

  async function updateShiftActivityTimes(activityId, fields) {
    const res = await fetch(`/api/site-shift-activities/${activityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'שגיאה');
    }
    fetchAll();
  }

  async function reorderShiftActivities(items) {
    const res = await fetch('/api/site-shift-activities/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(items),
    });
    if (res.ok) fetchAll();
  }


  function extractNumber(str) {
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  function calcDurationHours(start, end) {
    if (!start || !end) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h} שע'` : `${h}:${String(m).padStart(2,'0')} שע'`;
  }

  function sortSites(a, b) {
    const numA = extractNumber(a.name);
    const numB = extractNumber(b.name);

    // If both have numbers, sort numerically
    if (numA !== null && numB !== null) {
      return numA - numB;
    }
    // If only one has a number, put the one without number first
    if (numA === null && numB !== null) return -1;
    if (numA !== null && numB === null) return 1;
    // Otherwise sort alphabetically
    return a.name.localeCompare(b.name, 'he');
  }

  function groupSitesByGroup(sites) {
    const groups = {};
    sites.forEach(site => {
      const groupId = site.group_id ? String(site.group_id) : 'ungrouped';
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(site);
    });
    // Sort sites within each group with number-aware sorting
    Object.keys(groups).forEach(groupId => {
      groups[groupId].sort(sortSites);
    });
    return groups;
  }

  function getGroup(groupId) {
    if (groupId === 'ungrouped') return { name: 'ללא קבוצה', color: '#e5e7eb' };
    const group = config.site_groups?.find(g => g.id === parseInt(groupId));
    return group ? { name: group.name, color: group.color || '#667eea' } : { name: 'ללא קבוצה', color: '#e5e7eb' };
  }

  function groupRequestsByJob(requests) {
    const groups = {};
    requests.forEach(r => {
      const job = workers.find(w => w.id === r.worker_id)?.job || 'אחר';
      if (!groups[job]) groups[job] = [];
      groups[job].push(r);
    });
    return groups;
  }

  function groupWorkersByJob(workerList) {
    const groups = {};
    workerList.forEach(w => {
      const job = w.job || 'אחר';
      if (!groups[job]) groups[job] = [];
      groups[job].push(w);
    });
    return groups;
  }

  function openSendModal() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (dateStr < todayStr) {
      if (!window.confirm(`התאריך ${dateStr} הוא בעבר. האם לשלוח את ההודעות בכל זאת?`)) return;
    }

    const sitesInGroup = (selectedGroupId === '__all__' || !selectedGroupId)
      ? config.sites
      : selectedGroupId === 'ungrouped'
      ? config.sites.filter(s => !s.group_id)
      : config.sites.filter(s => s.group_id === parseInt(selectedGroupId));

    const configuredSlots = siteShiftActivities.filter(
      a => a.date === dateStr && a.activity_type_id && sitesInGroup.some(s => s.id === a.site_id)
    );
    const dayAssignments = assignments.filter(a => a.date === dateStr);
    const totalSlots = configuredSlots.length;
    const filledSlots = configuredSlots.filter(slot =>
      dayAssignments.some(a => a.site_id === slot.site_id && a.shift_type === slot.shift_type)
    ).length;

    if (totalSlots > 0 && filledSlots < totalSlots) {
      if (!window.confirm(`השיבוץ אינו מלא (${filledSlots}/${totalSlots} אתרים מאויישים). האם לשלוח בכל זאת?`)) return;
    }

    setShowSendModal(true);
    setPreviewMessages(null);
    setExpandedPreviewId(null);
    setSendResult(null);
    const todayAssignments = assignments.filter(a => a.date === dateStr);
    const workerIds = [...new Set(todayAssignments.map(a => a.worker_id))];
    setSendWorkerIds(workerIds);
  }

  function getUnassignedWorkers() {
    const assignedWorkerIds = new Set(assignments.filter(a => a.date === dateStr).map(a => a.worker_id));
    const requestedWorkerIds = new Set(
      shiftRequests.filter(r => r.date === dateStr && (r.preference_type === 'can' || r.preference_type === 'prefer')).map(r => r.worker_id)
    );
    return workers
      .filter(w => !assignedWorkerIds.has(w.id) && requestedWorkerIds.has(w.id))
      .sort((a, b) => a.first_name.localeCompare(b.first_name, 'he'));
  }


  function getVacationWorkersForDate() {
    const workerIds = new Set(workers.map(w => w.id));
    return vacations
      .filter(v => v.approved_start <= dateStr && v.approved_end >= dateStr && workerIds.has(v.worker_id))
      .map(v => {
        const worker = workers.find(w => w.id === v.worker_id);
        return {
          id: v.worker_id ?? `vac-${v.id}`,
          first_name: v.first_name ?? worker?.first_name ?? '',
          family_name: v.family_name ?? worker?.family_name ?? '',
          job: worker?.job ?? null,
        };
      })
      .sort((a, b) => a.first_name.localeCompare(b.first_name, 'he'));
  }

  function formatTime24(timeStr) {
    if (!timeStr) return '';
    // Handle various time formats and ensure HH:MM format (24-hour)
    let hours, minutes;

    if (timeStr.includes(':')) {
      [hours, minutes] = timeStr.split(':');
    } else if (timeStr.length === 4 && !isNaN(timeStr)) {
      // Format like "0700" or "1500"
      hours = timeStr.substring(0, 2);
      minutes = timeStr.substring(2, 4);
    } else if (timeStr.length === 3 && !isNaN(timeStr)) {
      // Format like "700" or "100"
      hours = timeStr.substring(0, 1);
      minutes = timeStr.substring(1, 3);
    } else {
      return timeStr;
    }

    hours = parseInt(hours) || 0;
    minutes = parseInt(minutes) || 0;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }


  const dateLabel = `${viewDate.toLocaleDateString('he-IL', { weekday: 'long' })} ${String(viewDate.getDate()).padStart(2, '0')}/${String(viewDate.getMonth() + 1).padStart(2, '0')}/${viewDate.getFullYear()}`;

  function isSaturday(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDay() === 6;
  }

  function openReportPreview() {
    setShowReportPreview(true);
  }

  const branchQS = branchId ? `?branch_id=${branchId}` : '';

  async function openSaveAsTemplate() {
    if (templateGroups.length === 0) {
      const r = await fetch(`/api/config/activity-template-groups${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (r.ok) setTemplateGroups(await r.json());
    }
    setShowSaveAsTemplate(true);
  }

  async function loadTemplates() {
    try {
      const [res, grpRes] = await Promise.all([
        fetch(`/api/config/activity-templates${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`/api/config/activity-template-groups${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      ]);
      if (res.ok) {
        setTemplates(await res.json());
        if (grpRes.ok) setTemplateGroups(await grpRes.json());
        setShowTemplateSelector(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert('שגיאה בטעינת תבניות: ' + (err.error || res.status));
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      alert('שגיאה בטעינת תבניות');
    }
  }

  async function renameTemplate(id, newName) {
    if (!newName.trim()) return;
    const res = await fetch(`/api/config/activity-templates/${id}${branchQS}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setEditingTemplateId(null);
      const updated = await fetch(`/api/config/activity-templates${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (updated.ok) setTemplates(await updated.json());
    } else {
      const err = await res.json().catch(() => ({}));
      alert('שגיאה: ' + (err.error || res.status));
    }
  }

  async function deleteTemplate(id) {
    if (!confirm('למחוק תבנית זו?')) return;
    const res = await fetch(`/api/config/activity-templates/${id}${branchQS}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) {
      const updated = await fetch(`/api/config/activity-templates${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (updated.ok) setTemplates(await updated.json());
    } else {
      alert('שגיאה במחיקה');
    }
  }

  async function saveCurrentAsTemplate() {
    const name = saveAsTemplateName.trim();
    if (!name) return;

    const dayActivities = siteShiftActivities.filter(a => a.date === dateStr && a.activity_type_id);
    if (dayActivities.length === 0) {
      alert('אין סוגי פעילות מוגדרים ליום זה');
      return;
    }

    try {
      const createRes = await fetch(`/api/config/activity-templates${branchQS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name, group_id: saveAsTemplateGroupId || null }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        alert('שגיאה: ' + (err.error || createRes.statusText));
        return;
      }
      const newTemplate = await createRes.json();

      const items = dayActivities.map(a => ({
        site_id: a.site_id,
        shift_type: a.shift_type,
        activity_type_id: a.activity_type_id,
      }));
      const itemsRes = await fetch(`/api/config/activity-templates/${newTemplate.id}/items${branchQS}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ items }),
      });
      if (itemsRes.ok) {
        setShowSaveAsTemplate(false);
        setSaveAsTemplateName('');
        setSaveAsTemplateGroupId('');
        alert(`תבנית "${name}" נשמרה בהצלחה`);
      } else {
        const err = await itemsRes.json().catch(() => ({}));
        alert('שגיאה בשמירת פעולות התבנית: ' + (err.error || itemsRes.status));
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('שגיאה בשמירת התבנית');
    }
  }

  async function clearDayAssignments() {
    if (!confirm(`⚠️ האם למחוק את כל השיבוצים של ${dateLabel}?\n\nכל נתוני השיבוץ ליום זה יימחקו לצמיתות ולא ניתן יהיה לשחזרם.`)) return;
    try {
      const res = await fetch(`/api/assignments-by-day/${dateStr}${branchQS}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error();
      await fetchAll();
    } catch {
      alert('שגיאה במחיקת שיבוצי היום');
    }
  }

  async function applyTemplate(templateId) {
    try {
      const res = await fetch(`/api/config/activity-templates/${templateId}/apply${branchQS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ date: dateStr }),
      });
      if (res.ok) {
        setShowTemplateSelector(false);
        await fetchAll();
        alert('תבנית הוחלה בהצלחה');
      } else {
        alert('שגיאה בהחלת התבנית');
      }
    } catch (error) {
      console.error('Error applying template:', error);
      alert('שגיאה בהחלת התבנית');
    }
  }

  async function openTemplateManager() {
    try {
      const [tmplRes, grpRes] = await Promise.all([
        fetch(`/api/config/activity-templates${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`/api/config/activity-template-groups${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      ]);
      if (tmplRes.ok && grpRes.ok) {
        setTemplates(await tmplRes.json());
        setTemplateGroups(await grpRes.json());
        setManagerEditingId(null);
        setShowTemplateManager(true);
      } else {
        alert('שגיאה בטעינת תבניות');
      }
    } catch {
      alert('שגיאה בטעינת תבניות');
    }
  }

  function openEditTemplate(id) {
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) return;
    const items = {};
    tmpl.items.forEach(item => { items[`${item.site_id}-${item.shift_type}`] = item.activity_type_id; });
    setEditTemplateId(id);
    setEditTemplateName(tmpl.name);
    setEditTemplateItems(items);
    setEditTemplateGroupId(tmpl.group_id || null);
  }

  async function saveEditTemplate() {
    if (!editTemplateId) return;
    const name = editTemplateName.trim();
    if (!name) return;
    const tmpl = templates.find(t => t.id === editTemplateId);
    const nameChanged = name !== tmpl?.name;
    const groupChanged = (editTemplateGroupId || null) !== (tmpl?.group_id || null);
    if (nameChanged || groupChanged) {
      const renameRes = await fetch(`/api/config/activity-templates/${editTemplateId}${branchQS}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name, group_id: editTemplateGroupId || null }),
      });
      if (!renameRes.ok) {
        const err = await renameRes.json().catch(() => ({}));
        alert('שגיאה בשמירה: ' + (err.error || renameRes.status));
        return;
      }
    }
    const itemsArray = Object.entries(editTemplateItems).map(([key, actId]) => {
      const [siteId, shiftType] = key.split('-');
      return { site_id: parseInt(siteId), shift_type: shiftType, activity_type_id: actId };
    });
    const res = await fetch(`/api/config/activity-templates/${editTemplateId}/items${branchQS}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ items: itemsArray }),
    });
    if (res.ok) {
      const updated = await fetch(`/api/config/activity-templates${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (updated.ok) setTemplates(await updated.json());
      setEditTemplateId(null);
    } else {
      alert('שגיאה בשמירת התבנית');
    }
  }

  async function renameManagerTemplate(id, name) {
    if (!name.trim()) return;
    const res = await fetch(`/api/config/activity-templates/${id}${branchQS}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setManagerEditingId(null);
      const updated = await fetch(`/api/config/activity-templates${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (updated.ok) setTemplates(await updated.json());
    } else {
      const err = await res.json().catch(() => ({}));
      alert('שגיאה: ' + (err.error || res.status));
    }
  }

  async function deleteManagerTemplate(id) {
    if (!confirm('למחוק תבנית זו?')) return;
    const res = await fetch(`/api/config/activity-templates/${id}${branchQS}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) {
      const updated = await fetch(`/api/config/activity-templates${branchQS}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (updated.ok) setTemplates(await updated.json());
    } else {
      alert('שגיאה במחיקה');
    }
  }

  function openCreateTemplate() {
    setNewTemplateName('');
    setNewTemplateItems({});
    setNewTemplateGroupId(null);
    setShowCreateTemplate(true);
  }

  async function saveNewTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    const createRes = await fetch(`/api/config/activity-templates${branchQS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ name, group_id: newTemplateGroupId || null }),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      alert('שגיאה: ' + (err.error || createRes.status));
      return;
    }
    const created = await createRes.json();
    const itemsArray = Object.entries(newTemplateItems).map(([key, actId]) => {
      const [siteId, shiftType] = key.split('-');
      return { site_id: parseInt(siteId), shift_type: shiftType, activity_type_id: actId };
    });
    await fetch(`/api/config/activity-templates/${created.id}/items${branchQS}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ items: itemsArray }),
    });
    setShowCreateTemplate(false);
    alert(`תבנית "${name}" נוצרה בהצלחה`);
  }

  function ReportPreview() {
    const title = `דו"ח שיבוצים לחדרים - ${dateLabel}`;

    // Group assignments by worker
    const workerAssignments = {};
    assignments.forEach(a => {
      if (a.date === dateStr) {
        if (!workerAssignments[a.worker_id]) {
          workerAssignments[a.worker_id] = {
            name: `${a.first_name} ${a.family_name}`,
            first_name: a.first_name,
            assignments: []
          };
        }
        workerAssignments[a.worker_id].assignments.push(a);
      }
    });

    // Get only workers who have at least one assignment, grouped by job
    const allWorkerAssignments = workers
      .filter(w => workerAssignments[w.id])
      .map(w => ({
        id: w.id,
        name: `${w.first_name} ${w.family_name}`,
        job: w.job || 'אחר',
        assignments: workerAssignments[w.id].assignments
      })).sort((a, b) => a.name.localeCompare(b.name, 'he'));

    const byJob = {};
    allWorkerAssignments.forEach(w => {
      if (!byJob[w.job]) byJob[w.job] = [];
      byJob[w.job].push(w);
    });

    function renderWorkerCard(worker) {
      return (
        <div key={worker.id} className="worker-report-section">
          <div className="worker-report-name">{worker.name}</div>
          <div className="worker-assignments">
            {worker.assignments.map((a) => {
              const site = config.sites.find(s => s.id === a.site_id);
              const sd = shiftDefaults[a.shift_type] || {};
              const shiftLabel = `${sd.icon || ''} ${sd.label_he || a.shift_type}`.trim();
              const shiftClass = a.shift_type;
              const startTime = a.start_time || sd.default_start || eveningStart;
              const endTime   = a.end_time   || sd.default_end   || eveningEnd;
              return (
                <div key={a.id} className="assignment-row">
                  <span className={`assignment-shift-badge ${shiftClass}`}>{shiftLabel}</span>
                  <span className="assignment-site">{site?.name}</span>
                  <span className="assignment-time">{formatTime24(startTime)}–{formatTime24(endTime)}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="form-overlay" onClick={() => setShowReportPreview(false)}>
        <div className="report-modal" onClick={e => e.stopPropagation()}>
          <div className="report-header">
            <h2>{title}</h2>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button onClick={() => window.print()} className="btn-primary btn-sm">🖨️ הדפס</button>
              <button onClick={() => setShowReportPreview(false)} className="btn-close">✕</button>
            </div>
          </div>
          <div className="report-content">
            <div className="report-wrapper">
              <div className="report-print-title">{title}</div>
              {Object.entries(byJob).map(([job, jobWorkers]) => (
                <div key={job} style={{marginBottom: '1rem'}}>
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 700, color: '#1a2e4a',
                    marginBottom: '0.5rem', letterSpacing: '0.03em'
                  }}>{job}</div>
                  <div className="workers-list">
                    {jobWorkers.map(renderWorkerCard)}
                  </div>
                </div>
              ))}
              <div style={{marginTop: '1rem', paddingTop: '0'}}>
                <h3 style={{fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem'}}>עובדים שלא משובצים:</h3>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                  {getUnassignedWorkers().length === 0 ? (
                    <div style={{color: '#059669', fontWeight: 500}}>כל העובדים משובצים ✓</div>
                  ) : (
                    getUnassignedWorkers().map(w => (
                      <div key={w.id} style={{padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#991b1b', borderRadius: '3px', fontSize: '0.85rem'}}>
                        {w.first_name} {w.family_name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function ShiftManagementModal() {
    const [addingActivity, setAddingActivity] = useState(false);
    const [newActivityId, setNewActivityId] = useState('');
    const [newActivityGroupFilter, setNewActivityGroupFilter] = useState('');
    const [activityError, setActivityError] = useState('');
    const [timeErrors, setTimeErrors] = useState({}); // actId-field -> error string

    if (!selectedShiftModal) return null;
    const { site_id, shift_type } = selectedShiftModal;
    const site = (config.sites || []).find(s => s.id === site_id);
    if (!site) return null;

    const isNight = shift_type === 'night';
    const isOncall = shift_type === 'oncall';
    const isMorning = shift_type === 'morning';
    const accentColor = isMorning ? '#92400e' : isNight ? '#6d28d9' : isOncall ? '#0369a1' : '#0369a1';
    const shiftLabel = shiftDefaults[shift_type]?.label_he || shift_type;
    const shiftIcon = isMorning ? '☀️' : shift_type === 'evening' ? '🌙' : isNight ? (shiftDefaults.night?.icon || '⭐') : (shiftDefaults.oncall?.icon || '📞');
    const shiftDefaultStart = shiftDefaults[shift_type]?.default_start || '';
    const shiftDefaultEnd = shiftDefaults[shift_type]?.default_end || '';
    const shiftTimes = getSiteShiftTimes(site_id, shift_type);
    const shiftStart = shiftTimes.start_time || shiftDefaultStart;
    const shiftEnd = shiftTimes.end_time || shiftDefaultEnd;

    const activities = getSiteShiftActivities(site_id, shift_type);
    const hasTimeOnAny = activities.some(a => a.start_time);

    const usedActivityIds = new Set(activities.map(a => a.activity_type_id));
    const availableActivityTypes = (config.activity_types || []).filter(at => !usedActivityIds.has(at.id));
    const filteredActivityTypes = newActivityGroupFilter
      ? availableActivityTypes.filter(at => String(at.group_id) === newActivityGroupFilter)
      : availableActivityTypes;

    const toMins = t => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };

    function validateActivityTime(timeStr) {
      if (!timeStr) return null;
      if (!/^\d{2}:\d{2}$/.test(timeStr)) return 'פורמט לא תקין';
      if (shiftStart && shiftEnd) {
        const s = toMins(shiftStart), e = toMins(shiftEnd);
        const t = toMins(timeStr);
        const dayEnd = e <= s ? e + 24 * 60 : e;
        const dayT = t < s ? t + 24 * 60 : t;
        if (dayT < s || dayT >= dayEnd) return `מחוץ לשעות המשמרת (${shiftStart}–${shiftEnd})`;
      }
      return null;
    }

    function getSequenceError() {
      const withTimes = activities.filter(a => a.start_time && a.end_time)
        .sort((a, b) => toMins(a.start_time) - toMins(b.start_time));
      for (let i = 0; i < withTimes.length - 1; i++) {
        const curr = withTimes[i], next = withTimes[i + 1];
        if (toMins(curr.end_time) > toMins(next.start_time))
          return `חפיפה בין "${curr.activity_name}" (עד ${curr.end_time}) ל-"${next.activity_name}" (מ-${next.start_time})`;
      }
      return null;
    }

    async function handleAddActivity() {
      if (!newActivityId) return;
      try {
        await addShiftActivity(site_id, shift_type, parseInt(newActivityId));
        setAddingActivity(false);
        setNewActivityId('');
        setNewActivityGroupFilter('');
        setActivityError('');
      } catch (e) {
        setActivityError(e.message);
      }
    }

    async function handleActivityFieldChange(act, field, val) {
      const errKey = `${act.id}-${field}`;
      const err = validateActivityTime(val);
      // cross-validate start < end
      let crossErr = null;
      if (!err && val) {
        const otherField = field === 'start_time' ? 'end_time' : 'start_time';
        const otherVal = field === 'start_time' ? act.end_time : act.start_time;
        if (otherVal) {
          const startMins = field === 'start_time' ? toMins(val) : toMins(otherVal);
          const endMins   = field === 'end_time'   ? toMins(val) : toMins(otherVal);
          if (endMins <= startMins) crossErr = 'שעת סיום חייבת להיות אחרי שעת ההתחלה';
        }
      }
      const finalErr = err || crossErr;
      setTimeErrors(prev => ({ ...prev, [errKey]: finalErr || null }));
      if (finalErr) return;
      try {
        await updateShiftActivityTimes(act.id, { [field]: val || null });
      } catch (e) {
        setTimeErrors(prev => ({ ...prev, [errKey]: e.message }));
      }
    }

    async function handleMoveUp(idx) {
      if (idx === 0) return;
      const reordered = [...activities];
      [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
      await reorderShiftActivities(reordered.map((a, i) => ({ id: a.id, sort_order: i })));
    }

    async function handleMoveDown(idx) {
      if (idx === activities.length - 1) return;
      const reordered = [...activities];
      [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
      await reorderShiftActivities(reordered.map((a, i) => ({ id: a.id, sort_order: i })));
    }

    const siteAssignments = getSiteShiftAssignments(site_id, shift_type);
    const sequenceError = getSequenceError();

    // Base eligible workers (job restriction)
    const siteObj = config.sites?.find(s => s.id === site_id);
    const allowedJobs = siteObj?.group_id ? (config.site_group_allowed_jobs?.[siteObj.group_id] || null) : null;
    const baseWorkers = allowedJobs?.length > 0
      ? workers.filter(w => allowedJobs.some(j => j.job_id === w.job_id))
      : workers;

    function getActivityCandidates(act) {
      const alreadyInActivity = new Set(siteAssignments.filter(a => a.site_shift_activity_id === act.id).map(a => a.worker_id));
      const eligible = act.activity_type_id
        ? baseWorkers.filter(w => (workerAuthorizations[w.id] || []).includes(act.activity_type_id) && !alreadyInActivity.has(w.id))
        : baseWorkers.filter(w => !alreadyInActivity.has(w.id));
      const withReq = eligible.filter(w => didWorkerRequestShift(w.id, shift_type));
      const withoutReq = eligible.filter(w => !didWorkerRequestShift(w.id, shift_type));
      return showAllWorkers ? [...withReq, ...withoutReq] : withReq;
    }

    return createPortal(
      <div
        className={dragShiftMgmt.overlayClass}
        onClick={() => { setSelectedShiftModal(null); dragShiftMgmt.reset(); }}
      >
        <div
          className="site-detail-modal"
          ref={dragShiftMgmt.modalRef}
          style={{ maxWidth: 540, ...(dragShiftMgmt.modalStyle || {}) }}
          onClick={e => e.stopPropagation()}
        >
          <div className="site-detail-header" {...dragShiftMgmt.dragHandleProps}>
            <div className="site-detail-header__title">
              <span className="site-detail-header__icon">{shiftIcon}</span>
              <div>
                <h2>{site.name} — {shiftLabel}</h2>
                <span className="site-detail-header__date">{dateLabel}</span>
              </div>
            </div>
            <button className="site-detail-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setSelectedShiftModal(null); dragShiftMgmt.reset(); }}>✕</button>
          </div>

          <div className="site-detail-body" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '75vh', overflowY: 'auto' }}>
            {/* Section header */}
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: accentColor, borderBottom: `2px solid ${accentColor}20`, paddingBottom: '0.25rem' }}>
              פעילויות ועובדים
              <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#6b7280', marginRight: '0.5rem' }}>
                {shiftStart && shiftEnd ? `${shiftStart}–${shiftEnd}` : ''}
              </span>
            </div>

            {sequenceError && (
              <div style={{ fontSize: '0.8rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
                ⚠ {sequenceError}
              </div>
            )}

            {activities.length === 0 && !addingActivity && (
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>אין פעילויות מוגדרות</div>
            )}

            {activities.map((act, idx) => {
              const activityWorkers = siteAssignments.filter(a => a.site_shift_activity_id === act.id);
              const isCovered = activityWorkers.length > 0;
              const isAddingHere = addingToShiftInSite?.activity_id === act.id;
              const candidates = getActivityCandidates(act);
              const selectedWorker = newAssignment.worker_id ? workers.find(w => w.id === newAssignment.worker_id) : null;

              return (
                <div key={act.id} style={{ border: `1px solid ${isCovered ? '#e5e7eb' : '#fca5a5'}`, borderRadius: '8px', overflow: 'hidden' }}>
                  {/* Activity header: reorder + name + times + delete */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', background: isCovered ? '#f8fafc' : '#fff5f5', padding: '0.45rem 0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', paddingTop: '2px' }}>
                      <button
                        disabled={hasTimeOnAny || idx === 0}
                        onClick={() => handleMoveUp(idx)}
                        style={{ background: 'none', border: 'none', cursor: hasTimeOnAny || idx === 0 ? 'not-allowed' : 'pointer', color: hasTimeOnAny || idx === 0 ? '#d1d5db' : '#374151', padding: '0 2px', lineHeight: 1, fontSize: '0.7rem' }}
                        title={hasTimeOnAny ? 'הסדר נקבע לפי שעות' : 'הזז למעלה'}
                      >▲</button>
                      <button
                        disabled={hasTimeOnAny || idx === activities.length - 1}
                        onClick={() => handleMoveDown(idx)}
                        style={{ background: 'none', border: 'none', cursor: hasTimeOnAny || idx === activities.length - 1 ? 'not-allowed' : 'pointer', color: hasTimeOnAny || idx === activities.length - 1 ? '#d1d5db' : '#374151', padding: '0 2px', lineHeight: 1, fontSize: '0.7rem' }}
                        title={hasTimeOnAny ? 'הסדר נקבע לפי שעות' : 'הזז למטה'}
                      >▼</button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1f2937' }}>{act.activity_name}</span>
                      {!isCovered && <span style={{ fontSize: '0.7rem', color: '#dc2626', background: '#fee2e2', borderRadius: '4px', padding: '0.1rem 0.3rem', marginRight: '0.4rem', verticalAlign: 'middle' }}>⚠ אין כיסוי</span>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.7rem', color: '#6b7280' }}>התחלה:</label>
                        <TimePickerInput
                          value={act.start_time || ''}
                          onChange={val => handleActivityFieldChange(act, 'start_time', val)}
                        />
                        <label style={{ fontSize: '0.7rem', color: '#6b7280' }}>סיום:</label>
                        <TimePickerInput
                          value={act.end_time || ''}
                          onChange={val => handleActivityFieldChange(act, 'end_time', val)}
                        />
                        {(timeErrors[`${act.id}-start_time`] || timeErrors[`${act.id}-end_time`]) && (
                          <span style={{ fontSize: '0.7rem', color: '#ef4444', width: '100%' }}>
                            {timeErrors[`${act.id}-start_time`] || timeErrors[`${act.id}-end_time`]}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteShiftActivity(act.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', padding: '0.1rem 0.3rem', borderRadius: '4px', alignSelf: 'flex-start' }}
                      title="הסר פעילות"
                    >✕</button>
                  </div>

                  {/* Workers assigned to this specific activity */}
                  <div style={{ padding: '0.3rem 0.6rem 0.4rem 0.6rem', background: '#fff', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {activityWorkers.length === 0 && !isAddingHere && (
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>אין עובד משובץ לפעילות זו</div>
                    )}
                    {activityWorkers.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                        <span style={{ flex: 1, fontWeight: 500 }}>{a.family_name} {a.first_name}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                          {formatTime24(a.start_time || act.start_time || '')}–{formatTime24(a.end_time || act.end_time || '')}
                        </span>
                        <button onClick={e => { e.stopPropagation(); openEditModal(a); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem' }} title="ערוך שעות">✏️</button>
                        <button onClick={e => { e.stopPropagation(); deleteAssignment(a.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }} title="הסר שיבוץ">✕</button>
                      </div>
                    ))}

                    {/* Per-activity add worker form */}
                    {isAddingHere ? (
                      <div style={{ marginTop: '0.3rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                        <div style={{ marginBottom: '0.35rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: '#6b7280' }}>
                            <input type="checkbox" checked={showAllWorkers} onChange={e => { setShowAllWorkers(e.target.checked); setNewAssignment({ ...newAssignment, worker_id: null }); }} />
                            הצג עובדים ללא בקשת משמרת
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={newAssignment.worker_id || ''}
                            onChange={e => setNewAssignment({ ...newAssignment, worker_id: e.target.value ? parseInt(e.target.value) : null })}
                            style={{ flex: 1, fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #d1d5db', minWidth: 130 }}
                          >
                            <option value="">בחר עובד...</option>
                            {candidates.length === 0 && <option disabled value="">— אין עובדים מורשים —</option>}
                            {candidates.map(w => (
                              <option key={w.id} value={w.id}>{w.family_name} {w.first_name}</option>
                            ))}
                          </select>
                          <button className="btn-primary" onClick={saveNewAssignment} disabled={!newAssignment.worker_id} style={{ fontSize: '0.82rem', padding: '0.25rem 0.5rem' }}>שמור</button>
                          <button className="btn-secondary" onClick={() => { setAddingToShiftInSite(null); setNewAssignment({ worker_id: null }); setShowAllWorkers(false); }} style={{ fontSize: '0.82rem', padding: '0.25rem 0.5rem' }}>ביטול</button>
                        </div>
                        {selectedWorker && !didWorkerRequestShift(selectedWorker.id, shift_type) && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#991b1b', background: '#fee2e2', borderRadius: '4px', padding: '0.25rem 0.4rem' }}>⛔ העובד לא ביקש משמרת זו</div>
                        )}
                      </div>
                    ) : (
                      <button
                        className="shift-card__add-btn"
                        style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', marginTop: '0.25rem', alignSelf: 'flex-start' }}
                        onClick={() => {
                          setAddingToShiftInSite({ site_id, shift_type, activity_id: act.id });
                          setNewAssignment({ worker_id: null, start_time: act.start_time || shiftStart, end_time: act.end_time || shiftEnd, notes: '' });
                          setShowAllWorkers(false);
                        }}
                      >+ שיבוץ עובד לפעילות זו</button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Unlinked workers (legacy assignments with no activity) */}
            {siteAssignments.filter(a => !a.site_shift_activity_id).length > 0 && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem' }}>שיבוצים ישנים (ללא פעילות ספציפית)</div>
                {siteAssignments.filter(a => !a.site_shift_activity_id).map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                    <span style={{ flex: 1 }}>{a.family_name} {a.first_name}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{formatTime24(resolveTime(a, shift_type, 'start_time'))}–{formatTime24(resolveTime(a, shift_type, 'end_time'))}</span>
                    <button onClick={e => { e.stopPropagation(); openEditModal(a); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem' }} title="ערוך שעות">✏️</button>
                    <button onClick={e => { e.stopPropagation(); deleteAssignment(a.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }} title="הסר שיבוץ">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add activity */}
            {addingActivity ? (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {(config.activity_type_groups || []).length > 0 && (
                  <select
                    value={newActivityGroupFilter}
                    onChange={e => setNewActivityGroupFilter(e.target.value)}
                    style={{ fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #d1d5db', color: '#475569' }}
                  >
                    <option value="">כל הקבוצות</option>
                    {(config.activity_type_groups || []).map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                  </select>
                )}
                <select
                  value={newActivityId}
                  onChange={e => setNewActivityId(e.target.value)}
                  style={{ fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #d1d5db', flex: 1, minWidth: 120 }}
                >
                  <option value="">בחר פעילות...</option>
                  {filteredActivityTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
                </select>
                <button className="btn-primary" onClick={handleAddActivity} disabled={!newActivityId} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>הוסף</button>
                <button className="btn-secondary" onClick={() => { setAddingActivity(false); setActivityError(''); }} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>ביטול</button>
                {activityError && <span style={{ fontSize: '0.78rem', color: '#ef4444', width: '100%' }}>{activityError}</span>}
              </div>
            ) : (
              <button
                className="btn-secondary"
                onClick={() => setAddingActivity(true)}
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', alignSelf: 'flex-start' }}
              >+ הוסף פעילות</button>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  function ShiftHeaderTimes({ site, shiftType, accentColor }) {
    const editKey = `${site.id}-${shiftType}`;
    const shiftTimes = getSiteShiftTimes(site.id, shiftType);
    const isEditing = inlineEditingShift === editKey;
    if (isEditing) {
      return (
        <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
          <input type="time" value={inlineEditTimes.start_time}
            onChange={e => setInlineEditTimes({...inlineEditTimes, start_time: e.target.value})}
            style={{width: '80px', fontSize: '0.85rem'}} />
          <span>–</span>
          <input type="time" value={inlineEditTimes.end_time}
            onChange={e => setInlineEditTimes({...inlineEditTimes, end_time: e.target.value})}
            style={{width: '80px', fontSize: '0.85rem'}} />
          <button className="btn-primary"
            onClick={() => { saveSiteShiftTimes(site.id, shiftType, inlineEditTimes.start_time, inlineEditTimes.end_time); setInlineEditingShift(null); }}
            style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}>✓</button>
          <button className="btn-secondary" onClick={() => setInlineEditingShift(null)}
            style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}>✕</button>
        </div>
      );
    }
    return (
      <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
        <span style={{fontSize: '1rem', color: accentColor, fontWeight: 700}}>
          {formatTime24(shiftTimes.start_time)}–{formatTime24(shiftTimes.end_time)}
        </span>
        <button className="btn-edit-small"
          onClick={() => { setInlineEditingShift(editKey); setInlineEditTimes({start_time: shiftTimes.start_time, end_time: shiftTimes.end_time}); }}
          title="ערוך שעות" style={{padding: '0.15rem 0.35rem', fontSize: '0.75rem'}}>✏️</button>
      </div>
    );
  }

  function ShiftSection({ site, shiftType, label, hideActivityType = false, hideHeader = false }) {
    const siteAssignments = getSiteShiftAssignments(site.id, shiftType);
    const activity = getSiteShiftActivity(site.id, shiftType);
    const shiftTimes = getSiteShiftTimes(site.id, shiftType);
    const editKey = `${site.id}-${shiftType}`;
    const isEditing = inlineEditingShift === editKey;

    const handleStartEdit = () => {
      setInlineEditingShift(editKey);
      setInlineEditTimes({ start_time: shiftTimes.start_time, end_time: shiftTimes.end_time });
    };

    const handleSaveEdit = () => {
      saveSiteShiftTimes(site.id, shiftType, inlineEditTimes.start_time, inlineEditTimes.end_time);
      setInlineEditingShift(null);
    };

    return (
      <div className={`room-shift-section room-shift-${shiftType}`}>
        {!hideHeader && (
          <div className="room-shift-header">
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1}}>
              <span className="room-shift-label">{label}</span>
              {isEditing ? (
                <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                  <input
                    type="time"
                    value={inlineEditTimes.start_time}
                    onChange={e => setInlineEditTimes({...inlineEditTimes, start_time: e.target.value})}
                    style={{width: '80px', fontSize: '0.85rem'}}
                  />
                  <span>–</span>
                  <input
                    type="time"
                    value={inlineEditTimes.end_time}
                    onChange={e => setInlineEditTimes({...inlineEditTimes, end_time: e.target.value})}
                    style={{width: '80px', fontSize: '0.85rem'}}
                  />
                  <button className="btn-primary" onClick={handleSaveEdit} style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}>✓</button>
                  <button className="btn-secondary" onClick={() => setInlineEditingShift(null)} style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}>✕</button>
                </div>
              ) : (
                <>
                  <span className="room-shift-time">{formatTime24(shiftTimes.start_time)}–{formatTime24(shiftTimes.end_time)}</span>
                  <button className="btn-edit-small" onClick={handleStartEdit} title="ערוך שעות" style={{padding: '0.2rem 0.4rem', fontSize: '0.8rem', marginLeft: '0.5rem'}}>✏️</button>
                </>
              )}
            </div>
          </div>
        )}
        {!hideActivityType && (
          <div style={{padding: '0.25rem 0.6rem', borderBottom: '1px solid #e5e7eb', background: '#f8fafc'}}>
            {inlineEditingActivity === editKey ? (
              <div style={{display: 'flex', gap: '0.3rem', alignItems: 'center'}}>
                {(config.activity_type_groups || []).length > 0 && (
                  <select
                    value={inlineActivityGroupFilter}
                    onChange={e => setInlineActivityGroupFilter(e.target.value)}
                    style={{fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', color: '#475569', maxWidth: '90px'}}
                  >
                    <option value="">הכל</option>
                    {(config.activity_type_groups || []).map(g => (
                      <option key={g.id} value={String(g.id)}>{g.name}</option>
                    ))}
                  </select>
                )}
                <select
                  value={inlineActivityTypeId || ''}
                  onChange={e => setInlineActivityTypeId(e.target.value ? parseInt(e.target.value) : null)}
                  style={{fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #d1d5db', flex: 1}}
                >
                  <option value="">— אין —</option>
                  {(config.activity_types || [])
                    .filter(at => !inlineActivityGroupFilter || String(at.group_id) === inlineActivityGroupFilter)
                    .map(at => (
                      <option key={at.id} value={at.id}>{at.name}</option>
                    ))}
                </select>
                <button
                  className="btn-primary"
                  onClick={() => {
                    updateSiteShiftActivity(site.id, shiftType, inlineActivityTypeId);
                    setInlineEditingActivity(null);
                    setInlineActivityGroupFilter('');
                  }}
                  style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}
                >✓</button>
                <button
                  className="btn-secondary"
                  onClick={() => { setInlineEditingActivity(null); setInlineActivityGroupFilter(''); }}
                  style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}
                >✕</button>
              </div>
            ) : (
              <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: '1.4rem'}}>
                {activity && activity.activity_name ? (
                  <span
                    style={{padding: '0.15rem 0.55rem', background: '#dbeafe', color: '#0369a1', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer'}}
                    onClick={() => { setInlineEditingActivity(editKey); setInlineActivityTypeId(activity.activity_type_id); setInlineActivityGroupFilter(''); }}
                    title="לחץ לעריכה"
                  >{activity.activity_name}</span>
                ) : (
                  <button
                    className="btn-secondary btn-activity-type"
                    onClick={() => { setInlineEditingActivity(editKey); setInlineActivityTypeId(null); setInlineActivityGroupFilter(''); }}
                    style={{padding: '0.1rem 0.35rem', fontSize: '0.72rem'}}
                  >+ סוג פעילות</button>
                )}
              </div>
            )}
          </div>
        )}
        <div className="room-card-content">
          {siteAssignments.length === 0 ? (
            <div className="room-empty">אין שיבוצים</div>
          ) : (
            <div className="room-assignments-list">
              {siteAssignments.map(a => {
                const coverageNeed = coverageNeeds.find(n => n.original_assignment.id === a.id);
                return (
                <div key={a.id} className="room-assignment-row" onClick={() => openEditModal(a)}>
                  <span className="room-assignment-text">
                    {a.job_name} · <strong>{a.first_name} {a.family_name}</strong>
                    <span className="room-assignment-time">
                      {formatTime24(resolveTime(a, shiftType, 'start_time'))}–{formatTime24(resolveTime(a, shiftType, 'end_time'))}
                    </span>
                  </span>
                  {coverageNeed && (
                    <button
                      className="coverage-badge"
                      title={`ישיבת ${coverageNeed.session.event_name} ${coverageNeed.session.start_time}–${coverageNeed.session.end_time}`}
                      onClick={e => { e.stopPropagation(); setCoverageModal({ need: coverageNeed }); }}
                    >
                      {coverageNeed.coverage_request?.status === 'approved'
                        ? `↔ ${coverageNeed.coverage_request.coverage_worker_name}`
                        : '⚠ ישיבה'}
                    </button>
                  )}
                  <button
                    className="btn-delete-small"
                    onClick={e => { e.stopPropagation(); deleteAssignment(a.id); }}
                    title="הסר שיבוץ"
                  >✕</button>
                </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', marginTop: '0.75rem'}}>
          {inlineEditingNotes === editKey ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <label style={{fontSize: '0.85rem', fontWeight: 500, color: '#1a2e4a'}}>הערות:</label>
              <textarea
                value={inlineNotes}
                onChange={e => setInlineNotes(e.target.value)}
                placeholder="הוסף הערות למשמרת זו..."
                style={{
                  fontSize: '0.85rem',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  padding: '0.5rem',
                  minHeight: '60px',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-start'}}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    saveShiftNotes(site.id, shiftType, inlineNotes);
                    setInlineEditingNotes(null);
                  }}
                  style={{padding: '0.3rem 0.6rem', fontSize: '0.75rem'}}
                >✓ שמור</button>
                <button
                  className="btn-secondary"
                  onClick={() => setInlineEditingNotes(null)}
                  style={{padding: '0.3rem 0.6rem', fontSize: '0.75rem'}}
                >✕ ביטול</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setInlineEditingNotes(editKey);
                setInlineNotes(getShiftNotes(site.id, shiftType));
              }}
              style={{cursor: 'pointer', padding: '0.5rem', borderRadius: '4px', backgroundColor: '#f9fafb', border: '1px dashed #d1d5db'}}
              title="לחץ להוספת או עריכת הערות"
            >
              {getShiftNotes(site.id, shiftType) ? (
                <div>
                  <label style={{fontSize: '0.8rem', fontWeight: 500, color: '#666', display: 'block', marginBottom: '0.3rem'}}>הערות:</label>
                  <p style={{fontSize: '0.85rem', color: '#333', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                    {getShiftNotes(site.id, shiftType)}
                  </p>
                </div>
              ) : (
                <p style={{fontSize: '0.85rem', color: '#999', margin: 0}}>+ הוסף הערות</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }


  const statsBarContent = (() => {
    const configuredSlots = siteShiftActivities.filter(
      a => a.date === dateStr && a.activity_type_id
    );
    const dayAssignments = assignments.filter(a => a.date === dateStr);
    if (configuredSlots.length === 0 && dayAssignments.length === 0) return null;

    const shiftStats = (config.shift_types || [])
      .filter(st => st.show_in_assignments || st.key === 'oncall')
      .map(st => {
        const slotsForShift = configuredSlots.filter(a => a.shift_type === st.key);
        const shiftAssignments = dayAssignments.filter(a => a.shift_type === st.key);
        const assignedSiteIds = new Set(shiftAssignments.map(a => a.site_id));
        const filled = slotsForShift.length > 0
          ? slotsForShift.filter(a => assignedSiteIds.has(a.site_id)).length
          : shiftAssignments.length;
        const total = slotsForShift.length > 0 ? slotsForShift.length : shiftAssignments.length;
        return { key: st.key, label: st.label_he, total, filled, missing: total - filled };
      })
      .filter(s => s.total > 0 || s.filled > 0);

    const totalSlots   = shiftStats.reduce((s, x) => s + x.total,  0);
    const totalFilled  = shiftStats.reduce((s, x) => s + x.filled, 0);
    const totalMissing = totalSlots - totalFilled;
    const pct = totalSlots > 0 ? Math.round((totalFilled / totalSlots) * 100) : 0;
    const barColor = totalMissing === 0 ? '#16a34a' : totalFilled === 0 ? '#ef4444' : '#f59e0b';

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? '0.2rem' : '0.4rem',
        background: 'white', border: '1.5px solid #e2e8f0',
        borderRadius: '8px', padding: isMobile ? '0.2rem 0.4rem' : '0.3rem 0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        ...(isMobile ? { width: '100%', boxSizing: 'border-box' } : {}),
      }}>
        {!isMobile && (
          <div style={{ width: '80px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
        )}
        {!isMobile && (
          <Tip text={`סה"כ: ${totalFilled} שיבוצים מאויישים מתוך ${totalSlots}`}>
            <span style={{ fontWeight: 600, color: '#1a2e4a', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {totalFilled}/{totalSlots}
            </span>
          </Tip>
        )}
        <Tip text={totalMissing === 0 ? 'כל השיבוצים מאוישים' : `${totalMissing} שיבוצים חסרים מתוך ${totalSlots} סה"כ`}>
          <span style={{
            padding: isMobile ? '0.1rem 0.3rem' : '0.1rem 0.4rem', borderRadius: '10px',
            fontSize: isMobile ? '0.68rem' : '0.78rem', fontWeight: 700, whiteSpace: 'nowrap',
            background: totalMissing === 0 ? '#dcfce7' : '#fef2f2',
            color:      totalMissing === 0 ? '#166534' : '#991b1b',
          }}>
            {totalMissing === 0 ? '✓ מלא' : `${totalMissing} חסרים`}
          </span>
        </Tip>
        {shiftStats.map(s => {
          const chipBg     = s.missing === 0 ? '#dcfce7' : s.filled === 0 ? '#fef2f2' : '#fef9e7';
          const chipColor  = s.missing === 0 ? '#166534' : s.filled === 0 ? '#991b1b' : '#92400e';
          const chipBorder = s.missing === 0 ? '#86efac' : s.filled === 0 ? '#fca5a5' : '#fde68a';
          return (
            <Tip key={s.key} text={`${s.label}: ${s.filled} מאויש מתוך ${s.total}${s.missing > 0 ? ` — ${s.missing} חסרים` : ' — מלא'}`}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.15rem',
                background: chipBg, border: `1px solid ${chipBorder}`,
                borderRadius: '6px', padding: isMobile ? '0.1rem 0.25rem' : '0.15rem 0.45rem',
                fontSize: isMobile ? '0.65rem' : '0.78rem', fontWeight: 600, color: chipColor,
                whiteSpace: 'nowrap',
              }}>
                <span>{s.label}</span>
                <span>{s.filled}/{s.total}</span>
              </div>
            </Tip>
          );
        })}
      </div>
    );
  })();

  function onModalDragStart(e) {
    if (e.button !== 0) return;
    const rect = e.currentTarget.closest('.site-detail-modal').getBoundingClientRect();
    modalDragRef.current = { startX: e.clientX - rect.left, startY: e.clientY - rect.top };
    e.preventDefault();

    function onMove(ev) {
      setModalPos({
        x: ev.clientX - modalDragRef.current.startX,
        y: ev.clientY - modalDragRef.current.startY,
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <>
    <div className="room-view-container">
      <div className="room-view-header">
        <div className="room-nav">
          <div className="room-nav-row1">
          <button className="btn-secondary btn-sm" onClick={nextYear} title="שנה קדימה">›››</button>
          <button className="btn-secondary btn-sm" onClick={nextMonth} title="חודש קדימה">››</button>
          <button className="btn-secondary btn-sm" onClick={nextDay} title="יום קדימה">›</button>
          <span
            onClick={() => datePickerRef.current?.showPicker()}
            style={{ fontSize: '1rem', fontWeight: 700, color: '#8B0000', borderRadius: '6px', border: '1px solid #d1d5db', padding: '0.25rem 0.75rem', cursor: 'pointer', background: 'white', userSelect: 'none' }}
          >
            {String(day).padStart(2,'0')}/{String(month).padStart(2,'0')}/{year}
          </span>
          <input
            ref={datePickerRef}
            type="date"
            value={dateStr}
            onChange={e => { if (e.target.value) setViewDate(new Date(e.target.value + 'T12:00:00')); }}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          />
          <button className="btn-secondary btn-sm" onClick={prevDay} title="יום אחורה">‹</button>
          <button className="btn-secondary btn-sm" onClick={prevMonth} title="חודש אחורה">‹‹</button>
          <button className="btn-secondary btn-sm" onClick={prevYear} title="שנה אחורה">‹‹‹</button>
          </div>{/* room-nav-row1 */}
          <div className="room-nav-row2">
          <button onClick={fetchSuggestions} disabled={suggestLoading} title="הצע שיבוצים עובדים בהתאם לבקשות ולהרשאות" className={`room-nav-action-btn room-nav-suggest-btn${suggestLoading ? ' room-nav-suggest-btn--loading' : ''}`}>
            {suggestLoading ? (isMobile ? '⏳' : '⏳ מחשב...') : (isMobile ? '🤖' : '🤖 הצע שיבוצים')}
          </button>
          <button onClick={openSendModal} title="שלח תוכנית יומית בהודעה" className="room-nav-action-btn room-nav-send-btn">{isMobile ? '💬' : '💬 שלח תוכנית'}</button>
          <span style={{width: '1px', background: '#d1d5db', alignSelf: 'stretch', margin: '0 0.25rem'}} />
          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', alignSelf: 'stretch' }}>
            <button onClick={openSaveAsTemplate} className="btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid #d1d5db', height: '100%' }} title="שמור את הפעילויות הנוכחיות כתבנית">💾</button>
            <button onClick={loadTemplates} className="btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid #d1d5db', height: '100%' }} title="טען תבנית על היום הנוכחי">📋</button>
            <button onClick={openTemplateManager} className="btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid #d1d5db', height: '100%' }} title="ערוך תוכן תבניות קיימות">✏️</button>
            <button onClick={openCreateTemplate} className="btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid #d1d5db', height: '100%' }} title="צור תבנית חדשה מאפס">➕</button>
            <button onClick={clearDayAssignments} className="btn-secondary btn-sm" style={{ borderRadius: 0, color: '#b91c1c', height: '100%' }} title="הסר את כל שיבוצי העובדים ליום זה">🗑️</button>
          </div>
          <button onClick={openReportPreview} className="btn-primary btn-sm" title="הדפס דו״ח שיבוצים">🖨️</button>
          <button onClick={fetchFairnessReport} disabled={fairnessLoading} className="btn-secondary btn-sm" title="טבלת צדק לפי אתרים">⚖️</button>
          <div style={{flex: 1}} />
          {!isMobile && statsBarContent}
          </div>{/* room-nav-row2 */}
        </div>
        {isMobile ? (
          statsBarContent && <div style={{padding: '0.25rem 0.5rem'}}>{statsBarContent}</div>
        ) : (
          <div className="room-shift-times-bar">
            {(config.shift_types || []).filter(st => st.default_start).map(st => (
              <span key={st.key} style={{display: 'contents'}}>
                <span>{st.label_he}:</span>
                <span style={{fontWeight: 500, color: '#1a2e4a', minWidth: '100px'}}>
                  {formatTime24(shiftDefaults[st.key]?.default_start)}–{formatTime24(shiftDefaults[st.key]?.default_end)}
                </span>
                <span className="room-shift-times-sep" />
              </span>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.72rem', color: '#555' }}>
              <span style={{ fontWeight: 600 }}>מקרא:</span>
              {[
                { bg: '#d1d5db', label: 'ריק' },
                { bg: '#e5e7eb', label: 'ללא סוג פעילות' },
                { bg: '#fee2e2', label: 'לא מכוסה' },
                { bg: '#dcfce7', label: 'מכוסה' },
              ].map(({ bg, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '0.85rem', height: '0.85rem', borderRadius: '3px', background: bg, border: '1px solid #d1d5db', display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      {restWarning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '0.6rem 1rem', margin: '0.5rem 1rem 0' }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span style={{ color: '#92400e', fontWeight: 500, fontSize: '0.9rem', flex: 1 }}>{restWarning}</span>
          <button onClick={() => setRestWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontWeight: 700, fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {!config.sites || config.sites.length === 0 ? (
        <div className="loading">❌ אין אתרים מוגדרים. אנא הוסף אתרים בהגדרות ⚙️</div>
      ) : loading ? (
        <div className="loading">טוען...</div>
      ) : (
        <>
          <div className="room-view-body">
            <div className="room-view-main">
            {/* Group tabs + תורנות/כוננות tabs */}
            {(() => {
              const regularGroups = (config.site_groups || []).filter(g => !g.group_type || g.group_type === 'regular');
              const hasNightGroups  = (config.site_groups || []).some(g => g.group_type === 'night');
              const hasOncallGroups = (config.site_groups || []).some(g => g.group_type === 'oncall');
              const regularSites = (config.sites || []).filter(s => {
                if (!s.group_id) return true;
                const grp = (config.site_groups || []).find(g => g.id === s.group_id);
                return !grp || !grp.group_type || grp.group_type === 'regular';
              });
              const regularGroupedSites = groupSitesByGroup(regularSites);
              return (
                <div style={{ display: 'flex', gap: isMobile ? '0.1rem' : '0.25rem', alignItems: 'stretch', borderBottom: '2px solid #e5e7eb', flexWrap: 'nowrap', padding: isMobile ? '0.1rem 0.25rem 0' : '0.2rem 0.5rem 0 0.5rem', marginBottom: '0.25rem', flexShrink: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                  <button onClick={() => setCardSize(s => Math.max(MIN_CARD, s - STEP))} className="btn-secondary btn-sm" title="הקטן כרטיסייה" style={{fontWeight:700, fontSize:'1rem', padding: isMobile ? '0.05rem 0.25rem' : '0.1rem 0.5rem', flexShrink: 0}}>−</button>
                  <button onClick={() => setCardSize(s => Math.min(MAX_CARD, s + STEP))} className="btn-secondary btn-sm" title="הגדל כרטיסייה" style={{fontWeight:700, fontSize:'1rem', padding: isMobile ? '0.05rem 0.25rem' : '0.1rem 0.5rem', flexShrink: 0}}>+</button>
                  {(() => {
                    const tabPad = isMobile ? '0.15rem 0.3rem' : '0.75rem 1rem';
                    const tabFont = isMobile ? '0.62rem' : undefined;
                    const tabStyle = (active, color = '#1a2e4a', bgColor = '#e5e7eb') => ({ padding: tabPad, fontSize: tabFont, border: 'none', background: active ? color : bgColor, color: active ? 'white' : color, fontWeight: active ? 600 : 700, cursor: 'pointer', borderRadius: '6px 6px 0 0', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', flex: '1 1 0', minWidth: 0, textAlign: 'center', lineHeight: 1.2, overflow: 'hidden' });
                    const regularGroupsList = (config.site_groups || []).filter(g => !g.group_type || g.group_type === 'regular');
                    return (<>
                      <button onClick={() => setSelectedGroupId('__all__')} style={tabStyle(selectedGroupId === '__all__', '#3a3f47', '#d9dce1')}>הכל</button>
                      {Object.entries(regularGroupedSites).map(([groupId]) => {
                        const group = getGroup(groupId);
                        const groupIndex = regularGroupsList.findIndex(g => g.id === parseInt(groupId));
                        const safeIdx = groupIndex >= 0 ? groupIndex : 0;
                        const groupColor = GROUP_PALETTE[safeIdx % GROUP_PALETTE.length];
                        const darkerBg = PALETTE_BG[safeIdx % PALETTE_BG.length].replace(/f/g, 'e').replace(/0/g, '1');
                        const isActive = selectedGroupId === groupId;
                        return <button key={groupId} onClick={() => setSelectedGroupId(groupId)} style={tabStyle(isActive, groupColor, darkerBg)}>{group.name}</button>;
                      })}
                      {(hasNightGroups || hasOncallGroups) && <span style={{ width: '1px', background: '#d1d5db', alignSelf: 'stretch', margin: '0 0.1rem' }} />}
                      {hasNightGroups && <button onClick={() => setSelectedGroupId('__night__')} style={tabStyle(selectedGroupId === '__night__', '#5b2c95', '#e8dff5')}>{shiftDefaults.night?.icon || '⭐'} {shiftDefaults.night?.label_he || 'תורנות'}</button>}
                      {hasOncallGroups && <button onClick={() => setSelectedGroupId('__oncall__')} style={tabStyle(selectedGroupId === '__oncall__', '#0d5fa0', '#d4e8f8')}>{shiftDefaults.oncall?.icon || '📞'} {shiftDefaults.oncall?.label_he || 'כוננות'}</button>}
                    </>);
                  })()}
                </div>
              );
            })()}

            {selectedGroupId && !['__night__', '__oncall__', '__all__'].includes(selectedGroupId) && (
              // Regular rooms grid (morning / evening)
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-start', alignContent: 'flex-start', flex: 1, overflow: 'auto' }}>
                {(() => {
                  const regularGroups = (config.site_groups || []).filter(g => !g.group_type || g.group_type === 'regular');
                  const groupBgMap = Object.fromEntries(
                    regularGroups.map((g, i) => [g.id, PALETTE_BG[i % PALETTE_BG.length]])
                  );
                  return (groupSitesByGroup(config.sites)[selectedGroupId] || []).map((site) => {
                  const morningAssignments = getSiteShiftAssignments(site.id, 'morning');
                  const eveningAssignments = getSiteShiftAssignments(site.id, 'evening');
                  const morningTimes = getSiteShiftTimes(site.id, 'morning');
                  const eveningTimes = getSiteShiftTimes(site.id, 'evening');
                  const scale = Math.max(0.6, Math.min(1.8, cardSize / 148));
                  const fs = v => `${(v * scale).toFixed(3)}rem`;

                  const hasMorningActivity = getSiteShiftActivities(site.id, 'morning').some(a => a.activity_type_id);
                  const hasEveningActivity = getSiteShiftActivities(site.id, 'evening').some(a => a.activity_type_id);
                  const morningCovered = hasMorningActivity
                    ? isTimeRangeCovered(morningAssignments, shiftDefaults.morning?.default_start || morningStart, shiftDefaults.morning?.default_end || morningEnd)
                    : true;
                  const eveningCovered = hasEveningActivity
                    ? isTimeRangeCovered(eveningAssignments, shiftDefaults.evening?.default_start || eveningStart, shiftDefaults.evening?.default_end || eveningEnd)
                    : true;

                  const isCardEmpty = !hasMorningActivity && !hasEveningActivity && morningAssignments.length === 0 && eveningAssignments.length === 0;
                  const groupBg = groupBgMap[site.group_id] || '#ffffff';

                  let morningBgColor = '#ffffff';
                  if (isCardEmpty) {
                    morningBgColor = '#d1d5db';
                  } else if (hasMorningActivity && !morningCovered) {
                    morningBgColor = '#fee2e2';
                  } else if (hasMorningActivity && morningCovered) {
                    morningBgColor = '#dcfce7';
                  } else if (!hasMorningActivity) {
                    morningBgColor = '#e5e7eb';
                  }

                  let eveningBgColor = '#ffffff';
                  if (isCardEmpty) {
                    eveningBgColor = '#d1d5db';
                  } else if (hasEveningActivity && !eveningCovered) {
                    eveningBgColor = '#fee2e2';
                  } else if (hasEveningActivity && eveningCovered) {
                    eveningBgColor = '#dcfce7';
                  } else if (!hasEveningActivity) {
                    eveningBgColor = '#e5e7eb';
                  }

                  const morningActivities = getSiteShiftActivities(site.id, 'morning');
                  const eveningActivities = getSiteShiftActivities(site.id, 'evening');

                  return (
                    <div
                      key={site.id}
                      className="site-square"
                      style={{ width: cardSize, padding: `${0.5 * scale}rem ${0.45 * scale}rem`, display: 'flex', flexDirection: 'column', gap: `${0.25 * scale}rem`, backgroundImage: 'none', backgroundColor: isCardEmpty ? '#d1d5db' : groupBg }}
                    >
                      <div className="site-square-title" style={{fontSize: fs(0.78), color: '#8B0000', fontWeight: 700}}>{site.name}</div>
                      <div className="site-square-shift" style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: `${0.25 * scale}rem`, background: morningBgColor, padding: `${0.3 * scale}rem`, borderRadius: '3px', width: '100%', cursor: 'pointer'}}
                        onClick={() => setSelectedShiftModal({ site_id: site.id, shift_type: 'morning' })}>
                        <div style={{display: 'flex', alignItems: 'center', gap: `${0.3 * scale}rem`, width: '100%'}}>
                          <span className="site-square-icon" style={{fontSize: fs(0.78)}}>☀</span>
                          <span style={{fontSize: fs(0.6), color: '#b45309', fontWeight: 600, whiteSpace: 'nowrap'}}>{formatTime24(morningTimes.start_time)}–{formatTime24(morningTimes.end_time)}</span>
                        </div>
                        {morningActivities.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${0.15 * scale}rem` }}>
                            {morningActivities.slice(0, 2).map((act, i) => (
                              <span key={i} style={{ fontSize: fs(0.62), color: '#b45309', fontWeight: 600, padding: `${0.15 * scale}rem ${0.3 * scale}rem`, background: '#fef9e7', borderRadius: '3px', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                                {act.start_time ? `${act.start_time} ` : ''}{act.activity_name}
                              </span>
                            ))}
                            {morningActivities.length > 2 && <span style={{ fontSize: fs(0.62), color: '#b45309', fontWeight: 600 }}>+{morningActivities.length - 2}</span>}
                          </div>
                        )}
                        <div className="site-square-names" style={{fontSize: fs(0.58), lineHeight: '1.3'}}>
                          {morningAssignments.length > 0 ? morningAssignments.map((a, idx) => {
                            const startTime = a.start_time || (shiftDefaults.morning?.default_start || morningStart);
                            const endTime = a.end_time || (shiftDefaults.morning?.default_end || morningEnd);
                            const isExplicitTime = !!(a.start_time && a.end_time);
                            return (
                              <div key={idx}>
                                <strong>{a.first_name} {a.family_name}</strong> ({a.job_name})
                                <div style={{fontSize: fs(0.54), color: isExplicitTime ? '#666' : '#999', marginTop: '0.1rem', fontStyle: isExplicitTime ? 'normal' : 'italic'}}>
                                  🕐 {formatTime24(startTime)}–{formatTime24(endTime)}
                                  {!isExplicitTime && <span style={{marginLeft: '0.3rem'}}>*</span>}
                                </div>
                              </div>
                            );
                          }) : <div>—</div>}
                        </div>
                      </div>
                      <div className="site-square-shift" style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: `${0.25 * scale}rem`, background: eveningBgColor, padding: `${0.3 * scale}rem`, borderRadius: '3px', width: '100%', cursor: 'pointer'}}
                        onClick={() => setSelectedShiftModal({ site_id: site.id, shift_type: 'evening' })}>
                        <div style={{display: 'flex', alignItems: 'center', gap: `${0.3 * scale}rem`, width: '100%'}}>
                          <span className="site-square-icon" style={{fontSize: fs(0.78)}}>🌙</span>
                          <span style={{fontSize: fs(0.6), color: '#0369a1', fontWeight: 600, whiteSpace: 'nowrap'}}>{formatTime24(eveningTimes.start_time)}–{formatTime24(eveningTimes.end_time)}</span>
                        </div>
                        {eveningActivities.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${0.15 * scale}rem` }}>
                            {eveningActivities.slice(0, 2).map((act, i) => (
                              <span key={i} style={{ fontSize: fs(0.62), color: '#0369a1', fontWeight: 600, padding: `${0.15 * scale}rem ${0.3 * scale}rem`, background: '#f0f9ff', borderRadius: '3px', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                                {act.start_time ? `${act.start_time} ` : ''}{act.activity_name}
                              </span>
                            ))}
                            {eveningActivities.length > 2 && <span style={{ fontSize: fs(0.62), color: '#0369a1', fontWeight: 600 }}>+{eveningActivities.length - 2}</span>}
                          </div>
                        )}
                        <div className="site-square-names" style={{fontSize: fs(0.58), lineHeight: '1.3'}}>
                          {eveningAssignments.length > 0 ? eveningAssignments.map((a, idx) => {
                            const startTime = a.start_time || (shiftDefaults.evening?.default_start || eveningStart);
                            const endTime = a.end_time || (shiftDefaults.evening?.default_end || eveningEnd);
                            const isExplicitTime = !!(a.start_time && a.end_time);
                            return (
                              <div key={idx}>
                                <strong>{a.first_name} {a.family_name}</strong> ({a.job_name})
                                <div style={{fontSize: fs(0.54), color: isExplicitTime ? '#666' : '#999', marginTop: '0.1rem', fontStyle: isExplicitTime ? 'normal' : 'italic'}}>
                                  🕐 {formatTime24(startTime)}–{formatTime24(endTime)}
                                  {!isExplicitTime && <span style={{marginLeft: '0.3rem'}}>*</span>}
                                </div>
                              </div>
                            );
                          }) : <div>—</div>}
                        </div>
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>
            )}

            {['__night__', '__oncall__'].includes(selectedGroupId) && (() => {
              const shiftKeys = [selectedGroupId === '__night__' ? 'night' : 'oncall'];
              if (shiftKeys.length === 0) return null;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-start', alignContent: 'flex-start', flex: 1, overflow: 'auto' }}>
                {shiftKeys.map(shiftKey => { const groupType = shiftKey;
              const isNight = shiftKey === 'night';
              const accentColor = isNight ? '#6d28d9' : '#0369a1';
              const accentBg   = isNight ? '#f5f3ff' : '#f0f9ff';
              const groupTypeSites = (config.sites || []).filter(s => {
                if (!s.group_id) return false;
                const grp = (config.site_groups || []).find(g => g.id === s.group_id);
                return grp?.group_type === groupType;
              }).sort(sortSites);
              if (groupTypeSites.length === 0) {
                return selectedGroupId !== '__all__' ? <div key={shiftKey} style={{ padding: '2rem', color: '#888', fontSize: '0.95rem' }}>אין אתרים מוגדרים לקבוצות {isNight ? 'תורנות' : 'כוננות'}. צור קבוצה מסוג זה בהגדרות ⚙️ והוסף אליה אתרים.</div> : null;
              }
              return (<div key={shiftKey} style={{ display: 'contents' }}>
                {selectedGroupId === '__all__' && <div style={{ width: '100%', fontWeight: 600, fontSize: '0.8rem', color: accentColor, borderTop: `2px solid ${accentColor}`, paddingTop: '0.3rem', marginTop: '0.25rem' }}>{isNight ? (shiftDefaults.night?.icon || '⭐') + ' ' + (shiftDefaults.night?.label_he || 'תורנות') : (shiftDefaults.oncall?.icon || '📞') + ' ' + (shiftDefaults.oncall?.label_he || 'כוננות')}</div>}
                {groupTypeSites.map((site) => {
                    const shiftAssignments = getSiteShiftAssignments(site.id, shiftKey);
                    const activity = getSiteShiftActivity(site.id, shiftKey);
                    const times = getSiteShiftTimes(site.id, shiftKey);
                    const duration = calcDurationHours(times.start_time, times.end_time);
                    const scale = Math.max(0.6, Math.min(1.8, cardSize / 148));
                    const fs = v => `${(v * scale).toFixed(3)}rem`;

                    const hasActivity = !!activity?.activity_type_id;
                    const defaultStart = shiftDefaults[shiftKey]?.default_start || (isNight ? nightStart : (shiftKey === 'oncall' ? '00:00' : eveningStart));
                    const defaultEnd = shiftDefaults[shiftKey]?.default_end || (isNight ? nightEnd : (shiftKey === 'oncall' ? '23:59' : eveningEnd));
                    const isCovered = hasActivity
                      ? isTimeRangeCovered(shiftAssignments, defaultStart, defaultEnd)
                      : false;
                    const isCardEmpty = !hasActivity && shiftAssignments.length === 0;
                    let shiftBgColor = isCardEmpty ? '#d1d5db' : hasActivity && !isCovered ? '#fee2e2' : hasActivity && isCovered ? '#dcfce7' : '#e5e7eb';

                    return (
                      <div
                        key={site.id}
                        className="site-square"
                        style={{ width: cardSize, padding: `${0.5 * scale}rem ${0.45 * scale}rem`, borderTop: `3px solid ${accentColor}`, backgroundImage: 'none', backgroundColor: isCardEmpty ? '#d1d5db' : accentBg }}
                        onClick={() => { setSelectedSiteId(site.id); setModalPos(null); }}
                      >
                        <div className="site-square-title" style={{fontSize: fs(0.78)}}>{site.name}</div>
                        <div className="site-square-shift" style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: `${0.25 * scale}rem`, background: shiftBgColor, padding: `${0.3 * scale}rem`, borderRadius: '3px', width: '100%'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: `${0.3 * scale}rem`, width: '100%'}}>
                            <span className="site-square-icon" style={{fontSize: fs(0.78)}}>{isNight ? '⭐' : '📞'}</span>
                            {times.start_time ? (
                              <span style={{fontSize: fs(0.6), color: accentColor, fontWeight: 600, whiteSpace: 'nowrap'}}>
                                {formatTime24(times.start_time)}{times.end_time ? `–${formatTime24(times.end_time)}` : ''}{duration ? ` (${duration})` : ''}
                              </span>
                            ) : (
                              <span style={{fontSize: fs(0.6), color: '#aaa', fontStyle: 'italic'}}>גמיש</span>
                            )}
                          </div>
                          {activity?.activity_type_id && (
                            <div style={{}}>
                              <span style={{ fontSize: fs(0.65), color: accentColor, fontWeight: 600, padding: `${0.2 * scale}rem ${0.35 * scale}rem`, background: accentBg, borderRadius: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                                {(config.activity_types || []).find(at => at.id === activity.activity_type_id)?.name}
                              </span>
                            </div>
                          )}
                          <div className="site-square-names" style={{fontSize: fs(0.58), lineHeight: '1.3', marginTop: `${0.2 * scale}rem`}}>
                            {shiftAssignments.length > 0 ? shiftAssignments.map((a, idx) => (
                              <div key={idx}><strong>{a.first_name} {a.family_name}</strong> ({a.job_name})</div>
                            )) : <div>—</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>);
              })}
                </div>
              );
            })()}

            {selectedGroupId === '__all__' && (() => {
              const allGroups = config.site_groups || [];
              const groupBgMap = Object.fromEntries(allGroups.map((g, i) => [g.id, PALETTE_BG[i % PALETTE_BG.length]]));
              const regularSites = (config.sites || []).filter(s => { if (!s.group_id) return true; const grp = (config.site_groups || []).find(g => g.id === s.group_id); return !grp || !grp.group_type || grp.group_type === 'regular'; }).sort(sortSites);
              const nightSites   = (config.sites || []).filter(s => { const grp = (config.site_groups || []).find(g => g.id === s.group_id); return grp?.group_type === 'night'; }).sort(sortSites);
              const oncallSites  = (config.sites || []).filter(s => { const grp = (config.site_groups || []).find(g => g.id === s.group_id); return grp?.group_type === 'oncall'; }).sort(sortSites);
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-start', alignContent: 'flex-start', flex: 1, overflow: 'auto' }}>
                  {regularSites.map((site) => {
                    const morningAssignments = getSiteShiftAssignments(site.id, 'morning');
                    const eveningAssignments = getSiteShiftAssignments(site.id, 'evening');
                    const morningTimes = getSiteShiftTimes(site.id, 'morning');
                    const eveningTimes = getSiteShiftTimes(site.id, 'evening');
                    const scale = Math.max(0.6, Math.min(1.8, cardSize / 148));
                    const fs = v => `${(v * scale).toFixed(3)}rem`;
                    const hasMorningActivity = getSiteShiftActivities(site.id, 'morning').some(a => a.activity_type_id);
                    const hasEveningActivity = getSiteShiftActivities(site.id, 'evening').some(a => a.activity_type_id);
                    const morningCovered = hasMorningActivity ? isTimeRangeCovered(morningAssignments, shiftDefaults.morning?.default_start || morningStart, shiftDefaults.morning?.default_end || morningEnd) : true;
                    const eveningCovered = hasEveningActivity ? isTimeRangeCovered(eveningAssignments, shiftDefaults.evening?.default_start || eveningStart, shiftDefaults.evening?.default_end || eveningEnd) : true;
                    const isCardEmpty = !hasMorningActivity && !hasEveningActivity && morningAssignments.length === 0 && eveningAssignments.length === 0;
                    const groupBg = groupBgMap[site.group_id] || '#ffffff';
                    let morningBgColor = isCardEmpty ? '#d1d5db' : hasMorningActivity && !morningCovered ? '#fee2e2' : hasMorningActivity && morningCovered ? '#dcfce7' : '#e5e7eb';
                    let eveningBgColor = isCardEmpty ? '#d1d5db' : hasEveningActivity && !eveningCovered ? '#fee2e2' : hasEveningActivity && eveningCovered ? '#dcfce7' : '#e5e7eb';
                    const mActivities = getSiteShiftActivities(site.id, 'morning');
                    const eActivities = getSiteShiftActivities(site.id, 'evening');
                    return (
                      <div key={site.id} className="site-square" style={{ width: cardSize, padding: `${0.5*scale}rem ${0.45*scale}rem`, display: 'flex', flexDirection: 'column', gap: `${0.25*scale}rem`, backgroundImage: 'none', backgroundColor: isCardEmpty ? '#d1d5db' : groupBg }}>
                        <div className="site-square-title" style={{fontSize: fs(0.78)}}>{site.name}</div>
                        <div className="site-square-shift" style={{background: morningBgColor, padding: `${0.3*scale}rem`, borderRadius: '3px', cursor: 'pointer'}} onClick={() => setSelectedShiftModal({ site_id: site.id, shift_type: 'morning' })}>
                          <div style={{display:'flex',alignItems:'center',gap:`${0.3*scale}rem`}}><span className="site-square-icon" style={{fontSize:fs(0.78)}}>☀️</span>{morningTimes.start_time&&<span style={{fontSize:fs(0.6),color:'#92400e',fontWeight:600,whiteSpace:'nowrap'}}>{formatTime24(morningTimes.start_time)}{morningTimes.end_time?`–${formatTime24(morningTimes.end_time)}`:''}</span>}</div>
                          {mActivities.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:`${0.15*scale}rem`}}>{mActivities.slice(0,2).map((a,i)=><span key={i} style={{fontSize:fs(0.62),color:'#92400e',fontWeight:600}}>{a.activity_name}</span>)}{mActivities.length>2&&<span style={{fontSize:fs(0.62),color:'#92400e'}}>+{mActivities.length-2}</span>}</div>}
                          <div className="site-square-names" style={{fontSize:fs(0.58),lineHeight:'1.3'}}>{morningAssignments.length>0?morningAssignments.map((a,idx)=><div key={idx}><strong>{a.first_name} {a.family_name}</strong> ({a.job_name})</div>):<div>—</div>}</div>
                        </div>
                        <div className="site-square-shift" style={{background: eveningBgColor, padding: `${0.3*scale}rem`, borderRadius: '3px', cursor: 'pointer'}} onClick={() => setSelectedShiftModal({ site_id: site.id, shift_type: 'evening' })}>
                          <div style={{display:'flex',alignItems:'center',gap:`${0.3*scale}rem`}}><span className="site-square-icon" style={{fontSize:fs(0.78)}}>🌙</span>{eveningTimes.start_time&&<span style={{fontSize:fs(0.6),color:'#1e40af',fontWeight:600,whiteSpace:'nowrap'}}>{formatTime24(eveningTimes.start_time)}{eveningTimes.end_time?`–${formatTime24(eveningTimes.end_time)}`:''}</span>}</div>
                          {eActivities.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:`${0.15*scale}rem`}}>{eActivities.slice(0,2).map((a,i)=><span key={i} style={{fontSize:fs(0.62),color:'#1e40af',fontWeight:600}}>{a.activity_name}</span>)}{eActivities.length>2&&<span style={{fontSize:fs(0.62),color:'#1e40af'}}>+{eActivities.length-2}</span>}</div>}
                          <div className="site-square-names" style={{fontSize:fs(0.58),lineHeight:'1.3'}}>{eveningAssignments.length>0?eveningAssignments.map((a,idx)=><div key={idx}><strong>{a.first_name} {a.family_name}</strong> ({a.job_name})</div>):<div>—</div>}</div>
                        </div>
                      </div>
                    );
                  })}
                  {[{sites: nightSites, shiftKey: 'night', accentColor: '#6d28d9', accentBg: '#f5f3ff', isNight: true},
                    {sites: oncallSites, shiftKey: 'oncall', accentColor: '#0369a1', accentBg: '#f0f9ff', isNight: false}
                  ].flatMap(({sites: specialSites, shiftKey, accentColor, accentBg, isNight}) =>
                    specialSites.map(site => {
                      const shiftAssignments = getSiteShiftAssignments(site.id, shiftKey);
                      const activity = getSiteShiftActivity(site.id, shiftKey);
                      const times = getSiteShiftTimes(site.id, shiftKey);
                      const scale = Math.max(0.6, Math.min(1.8, cardSize / 148));
                      const fs = v => `${(v * scale).toFixed(3)}rem`;
                      const hasActivity = !!activity?.activity_type_id;
                      const defaultStart = shiftDefaults[shiftKey]?.default_start || (isNight ? nightStart : '00:00');
                      const defaultEnd   = shiftDefaults[shiftKey]?.default_end   || (isNight ? nightEnd  : '23:59');
                      const isCoveredAll = hasActivity ? isTimeRangeCovered(shiftAssignments, defaultStart, defaultEnd) : false;
                      const isCardEmptyAll = !hasActivity && shiftAssignments.length === 0;
                      const shiftBgColor = isCardEmptyAll ? '#d1d5db' : hasActivity && !isCoveredAll ? '#fee2e2' : hasActivity && isCoveredAll ? '#dcfce7' : '#e5e7eb';
                      const groupBg = groupBgMap[site.group_id] || '#ffffff';
                      return (
                        <div key={`${shiftKey}-${site.id}`} className="site-square" style={{ width: cardSize, padding: `${0.5*scale}rem ${0.45*scale}rem`, display: 'flex', flexDirection: 'column', gap: `${0.25*scale}rem`, backgroundImage: 'none', backgroundColor: isCardEmptyAll ? '#d1d5db' : accentBg, borderTop: `3px solid ${accentColor}` }} onClick={() => { setSelectedSiteId(site.id); setModalPos(null); }}>
                          <div className="site-square-title" style={{fontSize:fs(0.78)}}>{site.name}</div>
                          <div className="site-square-shift" style={{background: shiftBgColor, padding:`${0.3*scale}rem`, borderRadius:'3px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:`${0.3*scale}rem`}}><span className="site-square-icon" style={{fontSize:fs(0.78)}}>{isNight?'⭐':'📞'}</span>{times.start_time&&<span style={{fontSize:fs(0.6),color:accentColor,fontWeight:600,whiteSpace:'nowrap'}}>{formatTime24(times.start_time)}{times.end_time?`–${formatTime24(times.end_time)}`:''}</span>}</div>
                            {hasActivity&&<div style={{}}><span style={{fontSize:fs(0.65),color:accentColor,fontWeight:600}}>{(config.activity_types||[]).find(at=>at.id===activity.activity_type_id)?.name}</span></div>}
                            <div className="site-square-names" style={{fontSize:fs(0.58),lineHeight:'1.3'}}>{shiftAssignments.length>0?shiftAssignments.map((a,idx)=><div key={idx}><strong>{a.first_name} {a.family_name}</strong> ({a.job_name})</div>):<div>—</div>}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
            </div>
            <div className="room-view-sidebar">
              <div className="room-sidebar-bars">
                {isMobile && (
                  <div className="room-bars-summary-row">
                    <span className="room-bars-summary-counts">
                      <span>זמינים: {Object.values(requestsByShift).reduce((s, a) => s + a.length, 0)}</span>
                      <span>לא משובצים: {getUnassignedWorkers().length}</span>
                      <span>חופשה: {getVacationWorkersForDate().length}</span>
                    </span>
                    <button className="room-bars-toggle-btn" onClick={() => setBarsCollapsed(c => !c)}>
                      {barsCollapsed ? '▲' : '▼'}
                    </button>
                  </div>
                )}
                {(!isMobile || !barsCollapsed) && (<>
                  <div className="room-requests-bar">
                    <span className="room-requests-label">עובדים זמינים:</span>
                    <div className="room-requests-columns">
                      {availabilityShifts.map(({ key: shiftKey, icon, color, bg_color: bg }) => {
                        const requests = requestsByShift[shiftKey] || [];
                        return (
                          <div key={shiftKey} className="room-requests-col">
                            <span className="room-requests-col-header" style={{color, background: bg}}>{icon}</span>
                            {requests.length === 0
                              ? <span className="room-requests-empty">אין</span>
                              : requests.map(r => (
                                  <span key={r.id} className={`room-requests-worker pref-${r.preference_type}`}>
                                    {r.first_name} {r.family_name}
                                  </span>
                                ))
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="room-unassigned-bar">
                    <span className="room-unassigned-label">לא משובצים:</span>
                    <div className="room-unassigned-content">
                      {getUnassignedWorkers().length === 0
                        ? <span className="room-unassigned-empty">כל העובדים משובצים ✓</span>
                        : getUnassignedWorkers().map(w => (
                            <span key={w.id} className="room-unassigned-worker">{w.first_name} {w.family_name}</span>
                          ))
                      }
                    </div>
                  </div>
                  {(() => {
                    const vacWorkers = getVacationWorkersForDate();
                    return (
                      <div className="room-unassigned-bar room-vacation-bar">
                        <span className="room-unassigned-label">חופשה מאושרת:</span>
                        <div className="room-unassigned-content">
                          {vacWorkers.length === 0
                            ? <span className="room-unassigned-empty">אין</span>
                            : vacWorkers.map(w => (
                                <span key={w.id} className="room-unassigned-worker room-vacation-worker">{w.first_name} {w.family_name}</span>
                              ))
                          }
                        </div>
                      </div>
                    );
                  })()}
                </>)}
                </div>
            </div>
          </div>
        </>
      )}
    </div>

    {/* Site details modal */}
    {selectedSiteId && (() => {
      const site = config.sites.find(s => s.id === selectedSiteId);
      if (!site) return null;

      return (
        <div className={`form-overlay${modalPos ? ' form-overlay--transparent' : ''}`} onClick={() => { setSelectedSiteId(null); setModalPos(null); setAddingToShiftInSite(null); setNewAssignment({ worker_id: null }); }}>
          <div
            className="site-detail-modal"
            onClick={e => e.stopPropagation()}
            style={modalPos ? { top: modalPos.y, left: modalPos.x, transform: 'none' } : undefined}
          >
            <div className="site-detail-header" onMouseDown={onModalDragStart} style={{cursor: 'grab'}}>
              <div className="site-detail-header__title">
                <span className="site-detail-header__icon">🏥</span>
                <div>
                  <h2>{site.name}</h2>
                  <span className="site-detail-header__date">{dateLabel}</span>
                </div>
              </div>
              <button className="site-detail-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setSelectedSiteId(null); setModalPos(null); setAddingToShiftInSite(null); setNewAssignment({ worker_id: null }); }}>✕</button>
            </div>

            <div className="site-detail-body">
              {addingToShiftInSite && addingToShiftInSite.site_id === site.id ? (
                <div className="site-add-worker-form">
                  <h3 className="site-add-worker-form__title">הוסף שיבוץ — {shiftDefaults[addingToShiftInSite.shift_type]?.label_he || addingToShiftInSite.shift_type}</h3>

                  <div style={{marginBottom: '1rem', padding: '0.75rem', background: '#fff', borderRadius: '6px'}}>
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem'}}>
                      <input
                        type="checkbox"
                        checked={showAllWorkers}
                        onChange={e => {
                          setShowAllWorkers(e.target.checked);
                          setNewAssignment({ ...newAssignment, worker_id: null });
                          setJobFilter(null);
                        }}
                      />
                      צפה בכל העובדים
                    </label>
                  </div>

                  {showAllWorkers && (
                    <div className="form-group">
                      <label>סנן לפי תפקיד:</label>
                      <select
                        value={jobFilter || ''}
                        onChange={e => setJobFilter(e.target.value || null)}
                      >
                        <option value="">כל התפקידים</option>
                        {Array.from(new Set(workers.map(w => w.job))).filter(job => job).sort().map(job => (
                          <option key={job} value={job}>{job}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>עובד:</label>
                    <select
                      value={newAssignment.worker_id || ''}
                      onChange={e => setNewAssignment({ ...newAssignment, worker_id: parseInt(e.target.value) })}
                    >
                      <option value="">בחר עובד...</option>
                      {getEligibleWorkers(site.id, addingToShiftInSite.shift_type).filter(w => !jobFilter || w.job === jobFilter).map(w => (
                        <option key={w.id} value={w.id}>{w.first_name} {w.family_name}</option>
                      ))}
                    </select>
                    {getEligibleWorkers(site.id, addingToShiftInSite.shift_type).filter(w => !jobFilter || w.job === jobFilter).length === 0 && (
                      <p style={{fontSize: '0.85rem', color: '#666', marginTop: '0.5rem'}}>
                        {showAllWorkers ? (jobFilter ? `אין עובדים בתפקיד "${jobFilter}"` : 'אין עובדים במערכת') : 'אין עובדים שביקשו משמרת זו. בדוק "צפה בכל העובדים" כדי לשבץ עובד אחר'}
                      </p>
                    )}
                  </div>

                  {newAssignment.worker_id && (() => { const vac = isWorkerOnVacation(newAssignment.worker_id); return vac ? (
                    <div style={{padding: '0.75rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '0.9rem', marginBottom: '0.75rem'}}>
                      <strong>⛔ אזהרה:</strong> לעובד חופש מאושר בתאריך זה ({vac.approved_start} עד {vac.approved_end})
                    </div>
                  ) : null; })()}

                  {newAssignment.worker_id && !didWorkerRequestShift(newAssignment.worker_id, addingToShiftInSite.shift_type) && (
                    <div style={{padding: '0.75rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontSize: '0.9rem', marginBottom: '0.75rem'}}>
                      <strong>⛔ אזהרה:</strong> העובד לא ביקש לעבוד במשמרת זו
                    </div>
                  )}

                  {newAssignment.worker_id && getWorkerOtherAssignments(newAssignment.worker_id, addingToShiftInSite.shift_type).length > 0 && (
                    <div style={{padding: '0.75rem', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '6px', color: '#92400e', fontSize: '0.9rem', marginBottom: '0.75rem'}}>
                      <strong>⚠️ התראה:</strong> העובד משובץ כבר ב{getWorkerOtherAssignments(newAssignment.worker_id, addingToShiftInSite.shift_type).join(', ')}
                    </div>
                  )}

                  <div style={{display: 'flex', gap: '0.75rem', marginTop: '1.5rem'}}>
                    <button className="btn-secondary" onClick={() => { setAddingToShiftInSite(null); setNewAssignment({ worker_id: null }); setShowAllWorkers(false); setJobFilter(null); }}>ביטול</button>
                    <button
                      className="btn-primary"
                      onClick={saveNewAssignment}
                      disabled={!newAssignment.worker_id}
                    >שמור</button>
                  </div>
                </div>
              ) : (() => { const _siteGroup = (config.site_groups || []).find(g => g.id === site.group_id); const _siteGroupType = _siteGroup?.group_type; return _siteGroupType === 'night' || _siteGroupType === 'oncall'; })() || ['__night__', '__oncall__'].includes(selectedGroupId) ? (() => {
                const ctxShift = selectedGroupId === '__night__' ? 'night' : selectedGroupId === '__oncall__' ? 'oncall' : ((config.site_groups || []).find(g => g.id === site.group_id)?.group_type);
                const isNight = ctxShift === 'night';
                const ctxAccent = isNight ? '#6d28d9' : '#0369a1';
                const ctxBorder = isNight ? '#a78bfa' : '#7dd3fc';
                const ctxBg = isNight ? 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)';
                const ctxLabel = shiftDefaults[ctxShift]?.label_he || (isNight ? 'תורנות' : 'כוננות');
                const ctxIcon = shiftDefaults[ctxShift]?.icon || (isNight ? '⭐' : '📞');
                return (
                  <div className="shift-cards-stack">
                    <div className="shift-card">
                      <div className="shift-card__header" style={{background: ctxBg, borderBottom: `2px solid ${ctxBorder}`}}>
                        <div className="shift-card__header-left">
                          <span className="shift-card__icon">{ctxIcon}</span>
                          <h3 style={{color: ctxAccent}}>{ctxLabel}</h3>
                          <ShiftHeaderTimes site={site} shiftType={ctxShift} accentColor={ctxAccent} />
                        </div>
                        <button className="shift-card__add-btn" style={{background: ctxBorder, color: ctxAccent}} onClick={() => openAddModalInSite(site.id, ctxShift)}>+ שיבוץ עובד</button>
                      </div>
                      <div className="shift-card__body">
                        <ShiftSection site={site} shiftType={ctxShift} label={ctxLabel} hideHeader={true}/>
                      </div>
                    </div>
                  </div>
                );
              })() : (() => {
                return (
                <div className="shift-cards-stack">
                  <div className="shift-card shift-card--morning">
                    <div className="shift-card__header shift-card__header--morning">
                      <div className="shift-card__header-left">
                        <span className="shift-card__icon">☀️</span>
                        <h3>{shiftDefaults.morning?.label_he}</h3>
                        <ShiftHeaderTimes site={site} shiftType="morning" accentColor="#92400e" />
                      </div>
                      <button className="shift-card__add-btn shift-card__add-btn--morning" onClick={() => openAddModalInSite(site.id, 'morning')}>+ שיבוץ עובד</button>
                    </div>
                    <div className="shift-card__body">
                      <ShiftSection site={site} shiftType="morning" label={shiftDefaults.morning?.label_he} hideHeader={true}/>
                    </div>
                  </div>

                  <div className="shift-card shift-card--evening">
                    <div className="shift-card__header shift-card__header--evening">
                      <div className="shift-card__header-left">
                        <span className="shift-card__icon">🌙</span>
                        <h3>{shiftDefaults.evening?.label_he}</h3>
                        <ShiftHeaderTimes site={site} shiftType="evening" accentColor="#0369a1" />
                      </div>
                      <button className="shift-card__add-btn shift-card__add-btn--evening" onClick={() => openAddModalInSite(site.id, 'evening')}>+ שיבוץ עובד</button>
                    </div>
                    <div className="shift-card__body">
                      <ShiftSection site={site} shiftType="evening" label={shiftDefaults.evening?.label_he} hideHeader={true}/>
                    </div>
                  </div>
                </div>
              );
              })()}
            </div>
          </div>
        </div>
      );
    })()}

    {/* Edit shift times modal */}
    {editingShiftTimes && (
      <div className={dragShiftTimes.overlayClass} onClick={() => { setEditingShiftTimes(null); dragShiftTimes.reset(); }}>
        <div className="assignment-modal" ref={dragShiftTimes.modalRef} style={{maxWidth: '400px', ...dragShiftTimes.modalStyle}} onClick={e => e.stopPropagation()}>
          <div className="modal-header" {...dragShiftTimes.dragHandleProps}>
            <h3>ערוך שעות משמרת</h3>
            <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setEditingShiftTimes(null); dragShiftTimes.reset(); }}>✕</button>
          </div>
          <div className="modal-body">
            <div className="modal-info">
              <p><strong>אתר:</strong> {editingShiftTimes.site_name}</p>
              <p><strong>משמרת:</strong> {shiftDefaults[editingShiftTimes.shift_type]?.label_he || editingShiftTimes.shift_type}</p>
            </div>

            <div className="form-group form-group-inline">
              <div>
                <label>שעת התחלה:</label>
                <input
                  type="time"
                  value={editingShiftTimes.start_time}
                  onChange={e => setEditingShiftTimes({ ...editingShiftTimes, start_time: e.target.value })}
                />
              </div>
              <div>
                <label>שעת סיום:</label>
                <input
                  type="time"
                  value={editingShiftTimes.end_time}
                  onChange={e => setEditingShiftTimes({ ...editingShiftTimes, end_time: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <div>
              <button className="btn-secondary" onClick={() => setEditingShiftTimes(null)}>ביטול</button>
              <button
                className="btn-primary"
                onClick={() => {
                  saveSiteShiftTimes(editingShiftTimes.site_id, editingShiftTimes.shift_type, editingShiftTimes.start_time, editingShiftTimes.end_time);
                  setEditingShiftTimes(null);
                }}
              >שמור</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Edit assignment modal (for editing existing assignments) */}
    {editingAssignment && (
      <div className={dragAssignment.overlayClass} onClick={() => { setEditingAssignment(null); dragAssignment.reset(); }}>
        <div className="assignment-modal assign-edit-modal" ref={dragAssignment.modalRef} style={dragAssignment.modalStyle} onClick={e => e.stopPropagation()}>
          <div className="modal-header assign-edit-header" {...dragAssignment.dragHandleProps}>
            <div className="assign-edit-header-title">
              <span className="assign-edit-icon">🕐</span>
              <h3>עריכת שעות שיבוץ</h3>
            </div>
            <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setEditingAssignment(null); dragAssignment.reset(); }}>✕</button>
          </div>
          <div className="modal-body">
            <div className="assign-info-chips">
              <span className="assign-chip">
                <span className="chip-label">עובד</span>
                <span className="chip-val">{editingAssignment.family_name} {editingAssignment.first_name}</span>
              </span>
              <span className="assign-chip">
                <span className="chip-label">תפקיד</span>
                <span className="chip-val">{editingAssignment.job_name}</span>
              </span>
              <span className="assign-chip">
                <span className="chip-label">אתר</span>
                <span className="chip-val">{editingAssignment.site_name}</span>
              </span>
            </div>
            <div className="assign-times-section">
              <div className="assign-times-row">
                <div className="assign-time-field">
                  <label>שעת התחלה</label>
                  <DrvTimePickerInput value={editTimes.start_time} onChange={v => setEditTimes({ ...editTimes, start_time: v })} />
                </div>
                <span className="assign-times-arrow">←</span>
                <div className="assign-time-field">
                  <label>שעת סיום</label>
                  <DrvTimePickerInput value={editTimes.end_time} onChange={v => setEditTimes({ ...editTimes, end_time: v })} />
                </div>
              </div>
              {editingAssignment && (() => {
                const def = getSiteShiftTimes(editingAssignment.site_id, editingAssignment.shift_type);
                const isCustom = editTimes.start_time !== (def.start_time || '') || editTimes.end_time !== (def.end_time || '');
                return isCustom ? (
                  <button type="button" className="assign-clear-times"
                    onClick={() => setEditTimes({ ...editTimes, start_time: def.start_time || '', end_time: def.end_time || '' })}>
                    ↩ אפס לשעות ברירת מחדל
                  </button>
                ) : null;
              })()}
              <p className="room-edit-hint">השאר ריק לשימוש בשעות ברירת מחדל של המשמרת</p>
            </div>
            <div className="form-group">
              <label>הערות</label>
              <input
                type="text"
                value={editTimes.notes}
                onChange={e => setEditTimes({ ...editTimes, notes: e.target.value })}
                placeholder="הערות אופציונליות..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <div>
              <button className="btn-secondary" onClick={() => { setEditingAssignment(null); dragAssignment.reset(); }}>ביטול</button>
              <button className="btn-primary" onClick={saveEditTimes}>שמור שינויים</button>
            </div>
          </div>
        </div>
      </div>
    )}


    {/* Save current as template modal */}
    {showSaveAsTemplate && (
      <div className={dragSaveTemplate.overlayClass} onClick={() => { setShowSaveAsTemplate(false); dragSaveTemplate.reset(); }}>
        <div className="assignment-modal" ref={dragSaveTemplate.modalRef} style={{maxWidth: '360px', ...dragSaveTemplate.modalStyle}} onClick={e => e.stopPropagation()}>
          <div className="modal-header" {...dragSaveTemplate.dragHandleProps}>
            <h3>שמור כתבנית</h3>
            <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setShowSaveAsTemplate(false); dragSaveTemplate.reset(); }}>✕</button>
          </div>
          <div className="modal-body">
            <p style={{color: '#666', fontSize: '0.9rem', marginBottom: '1rem'}}>
              שמור את סוגי הפעילות של {dateLabel} כתבנית לשימוש חוזר
            </p>
            <div className="form-group">
              <label>שם התבנית:</label>
              <input
                type="text"
                value={saveAsTemplateName}
                onChange={e => setSaveAsTemplateName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCurrentAsTemplate()}
                placeholder="לדוגמה: תבנית יום ראשון"
                autoFocus
              />
            </div>
            {templateGroups.length > 0 && (
              <div className="form-group">
                <label>קבוצה:</label>
                <select value={saveAsTemplateGroupId} onChange={e => setSaveAsTemplateGroupId(e.target.value)}>
                  <option value="">ללא קבוצה</option>
                  {templateGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <div>
              <button className="btn-secondary" onClick={() => setShowSaveAsTemplate(false)}>ביטול</button>
              <button className="btn-primary" onClick={saveCurrentAsTemplate}>שמור</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Template selector modal */}
    {showTemplateSelector && (() => {
      const renderSelectorTemplates = (groupId) =>
        templates.filter(t => (t.group_id || null) === (groupId || null)).map(template => (
          <div key={template.id} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {editingTemplateId === template.id ? (
              <>
                <input
                  value={editingTemplateName}
                  onChange={e => setEditingTemplateName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameTemplate(template.id, editingTemplateName);
                    if (e.key === 'Escape') setEditingTemplateId(null);
                  }}
                  autoFocus
                  style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.9rem', direction: 'rtl' }}
                />
                <button className="btn-save-inline" onClick={() => renameTemplate(template.id, editingTemplateName)}>שמור</button>
                <button className="btn-remove" onClick={() => setEditingTemplateId(null)}>✕</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => applyTemplate(template.id)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', background: '#d1d5db', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', textAlign: 'right', fontSize: '0.9rem', fontWeight: 500 }}
                >
                  {template.name}
                </button>
                <button className="btn-remove" onClick={() => deleteTemplate(template.id)}>✕</button>
              </>
            )}
          </div>
        ));
      const hasUngrouped = templates.some(t => !t.group_id);
      return (
        <div className={dragTemplateSel.overlayClass} onClick={() => { setShowTemplateSelector(false); dragTemplateSel.reset(); }}>
          <div className="assignment-modal" ref={dragTemplateSel.modalRef} style={dragTemplateSel.modalStyle} onClick={e => e.stopPropagation()}>
            <div className="modal-header" {...dragTemplateSel.dragHandleProps}>
              <h3>בחר תבנית</h3>
              <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setShowTemplateSelector(false); dragTemplateSel.reset(); }}>✕</button>
            </div>
            <div className="modal-body">
              {templates.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center' }}>אין תבניות זמינות</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {templateGroups.map((g, gi) => {
                    const grpTemplates = templates.filter(t => t.group_id === g.id);
                    if (grpTemplates.length === 0) return null;
                    const color = GROUP_PALETTE[gi % GROUP_PALETTE.length];
                    return (
                      <div key={g.id}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color, borderBottom: `2px solid ${color}`, paddingBottom: '0.1rem', marginBottom: '0.3rem' }}>{g.name}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>{renderSelectorTemplates(g.id)}</div>
                      </div>
                    );
                  })}
                  {hasUngrouped && (
                    <div>
                      {templateGroups.length > 0 && (
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.1rem', marginBottom: '0.3rem' }}>ללא קבוצה</div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>{renderSelectorTemplates(null)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()}

    {/* Template Manager modal */}
    {showTemplateManager && (() => {
      const allGroups = [...templateGroups];
      const renderTemplatesForGroup = (groupId) => {
        const groupTemplates = templates.filter(t => (t.group_id || null) === (groupId || null));
        if (groupTemplates.length === 0) return <p style={{ color: '#d1d5db', fontSize: '0.72rem', margin: '0.1rem 0.3rem' }}>אין תבניות</p>;
        return groupTemplates.map(t => (
          <div key={t.id} style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', padding: '0.15rem 0.3rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', marginBottom: '0.15rem' }}>
            <span style={{ flex: 1, fontWeight: 500, fontSize: '0.78rem' }}>{t.name}</span>
            <button className="btn-primary btn-sm" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }} onClick={() => openEditTemplate(t.id)}>עריכה</button>
            <button className="btn-remove" style={{ fontSize: '0.68rem', padding: '0.1rem 0.25rem' }} onClick={() => deleteManagerTemplate(t.id)}>✕</button>
          </div>
        ));
      };
      return (
        <div className={dragTemplateMgr.overlayClass} onClick={() => { setShowTemplateManager(false); dragTemplateMgr.reset(); }}>
          <div className="assignment-modal" ref={dragTemplateMgr.modalRef} style={{ maxWidth: '700px', width: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', ...dragTemplateMgr.modalStyle }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '0.4rem 0.75rem', cursor: 'grab' }} {...dragTemplateMgr.dragHandleProps}>
              <h3 style={{ fontSize: '0.9rem', margin: 0 }}>ערוך תבניות</h3>
              <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setShowTemplateManager(false); dragTemplateMgr.reset(); }}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', gap: '0.75rem', flex: 1, minHeight: 0, overflow: 'hidden', padding: '0.5rem 0.75rem' }}>
              {/* Templates by group */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {allGroups.map((g, gi) => {
                  const color = GROUP_PALETTE[gi % GROUP_PALETTE.length];
                  return (
                    <div key={g.id}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color, borderBottom: `2px solid ${color}`, paddingBottom: '0.1rem', marginBottom: '0.2rem' }}>{g.name}</div>
                      {renderTemplatesForGroup(g.id)}
                    </div>
                  );
                })}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.1rem', marginBottom: '0.2rem' }}>ללא קבוצה</div>
                  {renderTemplatesForGroup(null)}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Edit Template modal */}
    {editTemplateId && (
      <div className={dragEditTemplate.overlayClass} onClick={() => { setEditTemplateId(null); dragEditTemplate.reset(); }}>
        <div className="assignment-modal" ref={dragEditTemplate.modalRef} style={{ maxWidth: '750px', width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', ...dragEditTemplate.modalStyle }} onClick={e => e.stopPropagation()}>
          <div className="modal-header" style={{ gap: '0.5rem', flexWrap: 'wrap', cursor: 'grab' }} {...dragEditTemplate.dragHandleProps}>
            <input
              value={editTemplateName}
              onChange={e => setEditTemplateName(e.target.value)}
              style={{ flex: 1, minWidth: '120px', fontSize: '1rem', fontWeight: 700, border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.3rem 0.6rem', direction: 'rtl', color: '#1a2e4a' }}
            />
            <select
              value={editTemplateGroupId || ''}
              onChange={e => setEditTemplateGroupId(e.target.value ? Number(e.target.value) : null)}
              style={{ fontSize: '0.82rem', padding: '0.25rem 0.4rem', borderRadius: '5px', border: '1px solid #d1d5db', direction: 'rtl', color: '#374151', background: '#f9fafb' }}
            >
              <option value="">ללא קבוצה</option>
              {templateGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setEditTemplateId(null); dragEditTemplate.reset(); }}>✕</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <TemplateItemsEditor key={editTemplateId} config={config} items={editTemplateItems} onChange={setEditTemplateItems} />
          </div>
          <div className="modal-footer">
            <div>
              <button className="btn-secondary" onClick={() => setEditTemplateId(null)}>ביטול</button>
              <button className="btn-primary" onClick={saveEditTemplate}>שמור</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Create New Template modal */}
    {showCreateTemplate && (
      <div className={dragCreateTpl.overlayClass} onClick={() => { setShowCreateTemplate(false); dragCreateTpl.reset(); }}>
        <div className="assignment-modal" ref={dragCreateTpl.modalRef} style={{ maxWidth: '750px', width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', ...dragCreateTpl.modalStyle }} onClick={e => e.stopPropagation()}>
          <div className="modal-header" {...dragCreateTpl.dragHandleProps}>
            <h3>צור תבנית חדשה</h3>
            <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setShowCreateTemplate(false); dragCreateTpl.reset(); }}>✕</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '150px', margin: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>שם התבנית:</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="לדוגמה: תבנית יום ראשון"
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>קבוצה:</label>
                <select
                  value={newTemplateGroupId || ''}
                  onChange={e => setNewTemplateGroupId(e.target.value ? Number(e.target.value) : null)}
                  style={{ padding: '0.4rem 0.5rem', borderRadius: '5px', border: '1px solid #d1d5db', direction: 'rtl', fontSize: '0.85rem' }}
                >
                  <option value="">ללא קבוצה</option>
                  {templateGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <TemplateItemsEditor key="new" config={config} items={newTemplateItems} onChange={setNewTemplateItems} />
          </div>
          <div className="modal-footer">
            <div>
              <button className="btn-secondary" onClick={() => setShowCreateTemplate(false)}>ביטול</button>
              <button className="btn-primary" onClick={saveNewTemplate} disabled={!newTemplateName.trim()}>צור תבנית</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Coverage modal */}
    {coverageModal && (
      <div className="form-overlay" onClick={() => setCoverageModal(null)}>
        <div className="assignment-modal" style={{maxWidth: '420px'}} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 style={{fontSize: '0.95rem'}}>ניהול כיסוי — {coverageModal.need.original_assignment.worker_name}</h3>
            <button className="btn-close" onClick={() => setCoverageModal(null)}>✕</button>
          </div>
          <div style={{padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem'}}>
            <div style={{fontSize: '0.85rem', color: '#374151'}}>
              <strong>ישיבה:</strong> {coverageModal.need.session.event_name}
              &nbsp;{coverageModal.need.session.start_time}–{coverageModal.need.session.end_time}
            </div>
            <div style={{fontSize: '0.85rem', color: '#374151'}}>
              <strong>אתר:</strong> {coverageModal.need.original_assignment.site_name}
            </div>
            {coverageModal.need.coverage_request?.status === 'approved' && (
              <div className="coverage-assigned-row">
                <span>מחליף: <strong>{coverageModal.need.coverage_request.coverage_worker_name}</strong></span>
                <button className="btn-delete-small" onClick={() => removeCoverage(coverageModal.need.coverage_request.id)}>בטל</button>
              </div>
            )}
            {coverageModal.need.suggestions.length > 0 ? (
              <div>
                <div style={{fontSize: '0.8rem', fontWeight: 600, color: '#1a2e4a', marginBottom: '0.3rem'}}>מחליפים מוצעים:</div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                  {coverageModal.need.suggestions.map(s => (
                    <button
                      key={s.worker_id}
                      className="btn-secondary coverage-suggestion-btn"
                      onClick={() => assignCoverage(coverageModal.need, s.worker_id)}
                    >{s.worker_name}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{fontSize: '0.82rem', color: '#6b7280'}}>אין מחליפים זמינים לסשן זה.</div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Suggestion modal */}
    {suggestionModal && (
      <div className={dragSuggestion.overlayClass} onClick={() => { setSuggestionModal(null); dragSuggestion.reset(); }}>
        <div className="assignment-modal" ref={dragSuggestion.modalRef} style={{maxWidth: '550px', maxHeight: '80vh', overflowY: 'auto', ...dragSuggestion.modalStyle}} onClick={e => e.stopPropagation()}>
          <div className="modal-header" style={{padding: '0.6rem 1rem', cursor: 'grab'}} {...dragSuggestion.dragHandleProps}>
            <h3 style={{fontSize: '0.95rem'}}>הצעות שיבוץ אוטומטי ל-{dateLabel}</h3>
            <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setSuggestionModal(null); dragSuggestion.reset(); }}>✕</button>
          </div>
          <div className="modal-body" style={{padding: '0.5rem 0.75rem'}}>
            <details style={{marginBottom: '0.6rem', padding: '0.4rem', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #bfdbfe', fontSize: '0.75rem', lineHeight: 1.4, color: '#1e40af'}}>
              <summary style={{cursor: 'pointer', fontWeight: 600, marginBottom: '0.3rem'}}>📋 אופן הבחירה</summary>
              <div style={{marginLeft: '0.5rem'}}>
                <p style={{margin: '0.2rem 0'}}>✓ <strong>העדפה:</strong> עובדים שביקשו "מעדיף" מועדפים על "יכול"</p>
                <p style={{margin: '0.2rem 0'}}>📊 <strong>רמת פעילות:</strong> עובדים תואמים את רמת המורכבות של הפעילות בחדר</p>
                <p style={{margin: '0.2rem 0'}}>⚖️ <strong>צדק:</strong> עובדים שפחות שובצו לאתרים בעדיפות מועדפים</p>
              </div>
            </details>
            {suggestionModal.suggestions.length === 0 && suggestionModal.unassignable.length === 0 ? (
              <p style={{textAlign: 'center', color: '#666'}}>אין הצעות שיבוץ זמינות. ודא שהוגדרו סוגי פעילות לחדרים ושעובדים ביקשו את המשמרות.</p>
            ) : (
              <>
                {suggestionModal.suggestions.length > 0 && (
                  <div style={{marginBottom: '0.4rem'}}>
                    <div style={{fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.2rem', color: '#1a2e4a'}}>הצעות שיבוץ:</div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '1px'}}>
                      {suggestionModal.suggestions.map((suggestion, idx) => (
                        <label key={idx} style={{display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.4rem', backgroundColor: suggestionModal.selected[idx] ? '#eff6ff' : '#f9fafb', borderRadius: '4px', border: `1px solid ${suggestionModal.selected[idx] ? '#bfdbfe' : '#e5e7eb'}`, cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1.3}}>
                          <input
                            type="checkbox"
                            checked={!!suggestionModal.selected[idx]}
                            onChange={e => {
                              const newSelected = {...suggestionModal.selected};
                              if (e.target.checked) {
                                newSelected[idx] = true;
                              } else {
                                delete newSelected[idx];
                              }
                              setSuggestionModal({...suggestionModal, selected: newSelected});
                            }}
                            style={{cursor: 'pointer', flexShrink: 0}}
                          />
                          <span style={{fontWeight: 600, color: '#1a2e4a'}}>{suggestion.site_name}</span>
                          <span style={{color: '#888'}}>({shiftDefaults[suggestion.shift_type]?.label_he || suggestion.shift_type})</span>
                          <span style={{color: '#555', marginRight: '0.1rem'}}>—</span>
                          <span style={{color: '#333'}}>{suggestion.worker_name}</span>
                          <span style={{padding: '0 0.25rem', backgroundColor: suggestion.preference_type === 'prefer' ? '#d1fae5' : '#dbeafe', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 500, color: suggestion.preference_type === 'prefer' ? '#065f46' : '#0c4a6e', whiteSpace: 'nowrap'}}>
                            ✓ {prefLabel[suggestion.preference_type] || suggestion.preference_type}
                          </span>
                          {suggestion.is_fairness_site && (
                            <span title={`שיבוצי עובד לאתרי צדק: ${suggestion.fairness_count}`} style={{padding: '0 0.25rem', background: '#fef3c7', border: '1px solid #d97706', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 500, color: '#92400e', whiteSpace: 'nowrap'}}>
                              ⚖️{suggestion.fairness_count}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {suggestionModal.unassignable.length > 0 && (
                  <div style={{padding: '0.15rem 0.35rem', backgroundColor: '#fef2f2', borderRadius: '4px', border: '1px solid #fee2e2'}}>
                    <div style={{fontSize: '0.62rem', fontWeight: 600, marginBottom: '0.1rem', color: '#991b1b'}}>⚠️ לא ניתן לשבץ:</div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '0'}}>
                      {suggestionModal.unassignable.map((item, idx) => (
                        <div key={idx} style={{fontSize: '0.62rem', color: '#7f1d1d', padding: '0.05rem 0.2rem', lineHeight: 1.3}}>
                          <span style={{fontWeight: 600}}>{item.site_name}</span>
                          <span style={{color: '#991b1b', marginRight: '0.2rem'}}>({shiftDefaults[item.shift_type]?.label_he || item.shift_type})</span>
                          <span style={{color: '#b91c1c'}}>: {item.reason}</span>
                          {item.unavailable_workers && item.unavailable_workers.length > 0 && (
                            <span style={{color: '#9f1239', marginRight: '0.2rem'}}>
                              [{item.unavailable_workers.map(w => w.name).join(', ')} — חסרה הרשאה]
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer" style={{padding: '0.5rem 0.75rem'}}>
            <div>
              <button className="btn-secondary" onClick={() => setSuggestionModal(null)}>ביטול</button>
              <button
                className="btn-primary"
                disabled={Object.keys(suggestionModal.selected).length === 0}
                onClick={async () => {
                  try {
                    const toApply = suggestionModal.suggestions.filter((_, i) => suggestionModal.selected[i]);
                    const errors = [];
                    for (const suggestion of toApply) {
                      const r = await fetch('/api/worker-site-assignments', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${authToken}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          worker_id: suggestion.worker_id,
                          date: dateStr,
                          site_id: suggestion.site_id,
                          shift_type: suggestion.shift_type
                        })
                      });
                      if (!r.ok) {
                        const e = await r.json();
                        errors.push(`${suggestion.worker_name || suggestion.worker_id}: ${e.error || 'שגיאה'}`);
                      }
                    }
                    if (errors.length > 0) alert('שגיאות בשיבוץ:\n' + errors.join('\n'));
                    setSuggestionModal(null);
                    fetchAll();
                  } catch (err) {
                    console.error('Error applying suggestions:', err);
                    alert('שגיאה בשיבוץ ההצעות');
                  }
                }}
              >
                אשר נבחרים ({Object.keys(suggestionModal.selected).length})
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {showReportPreview && <ReportPreview />}

    <ShiftManagementModal />

    {showSendModal && (
      <div className={dragSendModal.overlayClass} onClick={() => { setShowSendModal(false); setSendResult(null); setPreviewMessages(null); dragSendModal.reset(); }}>
        <div className="settings-modal" ref={dragSendModal.modalRef} style={{ direction: 'rtl', maxWidth: 660, ...dragSendModal.modalStyle }} onClick={e => e.stopPropagation()}>
          <div className="settings-header" {...dragSendModal.dragHandleProps}>
            <h2>💬 שלח תוכנית יום</h2>
            <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setShowSendModal(false); setSendResult(null); setPreviewMessages(null); dragSendModal.reset(); }}>✕</button>
          </div>
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sendResult ? (
              <>
                <div style={{ padding: '1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, color: '#166534' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>✓ נשלח בהצלחה!</p>
                </div>
                {sendResult.sent.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>נשלח ל-{sendResult.sent.length}:</p>
                    <ul style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0', paddingRight: '1.5rem' }}>
                      {sendResult.sent.map(name => <li key={name}>{name}</li>)}
                    </ul>
                  </div>
                )}
                {sendResult.noAccount?.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ea580c' }}>ללא חשבון ({sendResult.noAccount.length}):</p>
                    <ul style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0', paddingRight: '1.5rem' }}>
                      {sendResult.noAccount.map(name => <li key={name}>{name}</li>)}
                    </ul>
                  </div>
                )}
                {sendResult.failed?.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>כשל ({sendResult.failed.length}):</p>
                    <ul style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0', paddingRight: '1.5rem' }}>
                      {sendResult.failed.map(name => <li key={name}>{name}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={() => { setShowSendModal(false); setSendResult(null); setPreviewMessages(null); }} className="btn-secondary" style={{ width: '100%' }}>סגור</button>
              </>
            ) : previewMessages ? (
              <>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
                  תצוגה מקדימה — <strong>{previewMessages.length}</strong> הודעות לתאריך <strong>{dateStr}</strong>
                </p>
                <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {previewMessages.map(msg => {
                    const isOpen = expandedPreviewId === msg.workerId;
                    return (
                      <div key={msg.workerId} style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                        <button
                          onClick={() => setExpandedPreviewId(isOpen ? null : msg.workerId)}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: isOpen ? '#f1f5f9' : '#fff', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: msg.hasAccount ? '#1a2e4a' : '#9ca3af', textAlign: 'right', direction: 'rtl' }}
                        >
                          <span>{msg.workerName}{!msg.hasAccount ? ' (אין חשבון)' : ''}</span>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                          <pre style={{ margin: 0, padding: '0.6rem 0.75rem', background: '#f8fafc', fontSize: '0.8rem', color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', direction: 'rtl', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                            {msg.content}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={sendSchedule} disabled={sending} className="btn-primary" style={{ flex: 1 }}>
                    {sending ? '...שולח' : `✓ שלח (${previewMessages.filter(m => m.hasAccount).length})`}
                  </button>
                  <button onClick={() => { setPreviewMessages(null); setExpandedPreviewId(null); }} className="btn-secondary">חזור</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: 0 }}>תאריך: <strong>{dateStr}</strong></p>
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.75rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.1rem 0' }}>
                  {workers.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#999' }}>אין עובדים במערכת</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '1rem', gridColumn: '1 / -1' }}>
                        <button onClick={() => setSendWorkerIds(workers.map(w => w.id))} style={{ fontSize: '0.85rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>בחר הכל</button>
                        <button onClick={() => setSendWorkerIds([])} style={{ fontSize: '0.85rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>בטל הכל</button>
                      </div>
                      {workers.map(w => (
                        <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', padding: '0.1rem 0.25rem' }}>
                          <input
                            type="checkbox"
                            checked={sendWorkerIds.includes(w.id)}
                            onChange={e => setSendWorkerIds(prev => e.target.checked ? [...prev, w.id] : prev.filter(id => id !== w.id))}
                          />
                          {w.first_name} {w.family_name} {w.user_id ? '' : '(אין חשבון)'}
                        </label>
                      ))}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={previewSchedule} disabled={sending || sendWorkerIds.length === 0} className="btn-primary" style={{ flex: 1 }}>
                    {sending ? '...טוען' : '👁 תצוגה מקדימה'}
                  </button>
                  <button onClick={() => setShowSendModal(false)} className="btn-secondary">ביטול</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )}

    {fairnessReport && (
      <div className={dragFairness.overlayClass} onClick={() => { setFairnessReport(null); dragFairness.reset(); }}>
        <div className="settings-modal" ref={dragFairness.modalRef} style={{ maxWidth: 700, direction: 'rtl', ...dragFairness.modalStyle }} onClick={e => e.stopPropagation()}>
          <div className="settings-header" {...dragFairness.dragHandleProps}>
            <h2>⚖️ טבלת צדק</h2>
            <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setFairnessReport(null); dragFairness.reset(); }}>✕</button>
          </div>
          <div style={{ padding: '1rem 1.25rem', overflowX: 'auto' }}>
            {fairnessReport.sites.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#666' }}>לא הוגדרו אתרי צדק.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', direction: 'rtl' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '0.3rem 0.5rem', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>עובד</th>
                    {fairnessReport.sites.map(s => (
                      <th key={s.site_id} style={{ padding: '0.3rem 0.5rem', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{s.site_name}</th>
                    ))}
                    <th style={{ padding: '0.3rem 0.5rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>סה"כ</th>
                  </tr>
                </thead>
                <tbody>
                  {fairnessReport.workers.map(w => (
                    <tr key={w.worker_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}>{w.name}</td>
                      {fairnessReport.sites.map(s => (
                        <td key={s.site_id} style={{ padding: '0.25rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>{w.counts[s.site_id] || 0}</td>
                      ))}
                      <td style={{ padding: '0.25rem 0.5rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>{w.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
