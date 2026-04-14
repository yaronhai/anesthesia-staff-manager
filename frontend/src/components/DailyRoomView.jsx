import { useState, useEffect } from 'react';

const PREF_LABEL = { prefer: 'מעדיף', can: 'יכול', cannot: 'לא יכול' };

export default function DailyRoomView({ config, authToken }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [shiftRequests, setShiftRequests] = useState([]);
  const [siteShiftActivities, setSiteShiftActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  // Global shift time defaults (component state, not persisted)
  const [morningStart] = useState('07:00');
  const [morningEnd] = useState('15:00');
  const [eveningStart] = useState('15:00');
  const [eveningEnd] = useState('23:00');
  const [nightStart] = useState('23:00');
  const [nightEnd] = useState('07:00');

  // Modal for group details
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // Modal for site details
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [siteActivityTypes, setSiteActivityTypes] = useState({}); // Map of site_id -> activity_type_id
  const [siteShiftTimes, setSiteShiftTimes] = useState({}); // Map of "site_id-shift_type" -> { start_time, end_time }
  const [editingShiftTimes, setEditingShiftTimes] = useState(null); // { site_id, shift_type, start_time, end_time } - for modal editing
  const [inlineEditingShift, setInlineEditingShift] = useState(null); // "site_id-shift_type" for inline time editing
  const [inlineEditTimes, setInlineEditTimes] = useState({ start_time: '', end_time: '' });
  const [inlineEditingActivity, setInlineEditingActivity] = useState(null); // "site_id-shift_type" for inline activity editing
  const [inlineActivityTypeId, setInlineActivityTypeId] = useState(null);
  const [shiftNotes, setShiftNotes] = useState({}); // Map of "site_id-shift_type" -> notes
  const [inlineEditingNotes, setInlineEditingNotes] = useState(null); // "site_id-shift_type" for inline notes editing
  const [inlineNotes, setInlineNotes] = useState('');
  const [addingToShiftInSite, setAddingToShiftInSite] = useState(null); // { site_id, shift_type } - for adding within site modal

  // Add assignment state
  const [newAssignment, setNewAssignment] = useState({ worker_id: null });
  const [showAllWorkers, setShowAllWorkers] = useState(false);
  const [jobFilter, setJobFilter] = useState(null); // Filter by job when showing all workers

  // Edit times modal
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editTimes, setEditTimes] = useState({ start_time: '', end_time: '', notes: '' });


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

  // Suggestions modal
  const [suggestionModal, setSuggestionModal] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();
  const day = viewDate.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  useEffect(() => { fetchAll(); }, [month, year, authToken]);

  async function fetchAll() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, year });
      const [staffRes, shiftRes] = await Promise.all([
        fetch(`/api/staffing/month-view?${params}`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`/api/shift-requests/admin/all-with-workers?${params}`, { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      if (staffRes.ok) {
        const d = await staffRes.json();
        setWorkers(d.workers || []);
        setAssignments(d.siteAssignments || []);
        setSiteShiftActivities(d.siteShiftActivities || []);
      }
      if (shiftRes.ok) {
        const d = await shiftRes.json();
        setShiftRequests(d.requests || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuggestions() {
    setSuggestLoading(true);
    try {
      const res = await fetch(`/api/staffing/suggest?date=${dateStr}`, {
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

  function prevDay()   { setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)); }
  function nextDay()   { setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); }
  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate())); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate())); }
  function prevYear()  { setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), d.getDate())); }
  function nextYear()  { setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())); }

  function getSiteShiftAssignments(siteId, shiftType) {
    return assignments.filter(a => a.site_id === siteId && a.date === dateStr && a.shift_type === shiftType);
  }

  const dayRequests = shiftRequests.filter(r => r.date === dateStr);
  const morningRequests = dayRequests.filter(r => r.shift_type === 'morning');
  const eveningRequests = dayRequests.filter(r => r.shift_type === 'evening');

  function resolveTime(assignment, shiftType, field) {
    if (assignment[field]) return assignment[field];
    if (shiftType === 'morning') return field === 'start_time' ? morningStart : morningEnd;
    if (shiftType === 'evening') return field === 'start_time' ? eveningStart : eveningEnd;
    if (shiftType === 'night') return field === 'start_time' ? nightStart : nightEnd;
    return field === 'start_time' ? eveningStart : eveningEnd; // Default to evening
  }

  function openAddModalInSite(siteId, shiftType) {
    const shiftTimes = getSiteShiftTimes(siteId, shiftType);
    setAddingToShiftInSite({ site_id: siteId, shift_type: shiftType });
    setNewAssignment({ worker_id: null, start_time: shiftTimes.start_time, end_time: shiftTimes.end_time, notes: '' });
    setShowAllWorkers(false);
  }

  function openEditModal(assignment) {
    setEditingAssignment(assignment);
    setEditTimes({
      start_time: assignment.start_time || '',
      end_time:   assignment.end_time   || '',
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
      const shiftLabel = addingToShiftInSite.shift_type === 'morning' ? 'בוקר' : addingToShiftInSite.shift_type === 'night' ? 'תורנות' : 'ערב';
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
          worker_id:   newAssignment.worker_id,
          date:        dateStr,
          site_id:     addingToShiftInSite.site_id,
          shift_type:  addingToShiftInSite.shift_type,
          start_time:  null,
          end_time:    null,
          notes:       null,
        }),
      });
      if (res.ok) {
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

  function getSiteShiftActivity(siteId, shiftType) {
    return siteShiftActivities.find(ssa =>
      ssa.site_id === siteId && ssa.date === dateStr && ssa.shift_type === shiftType
    );
  }

  function getSiteShiftTimes(siteId, shiftType) {
    const key = `${siteId}-${shiftType}`;
    const custom = siteShiftTimes[key];
    if (custom) return custom;

    // Return default times
    if (shiftType === 'morning') return { start_time: morningStart, end_time: morningEnd };
    if (shiftType === 'evening') return { start_time: eveningStart, end_time: eveningEnd };
    if (shiftType === 'night') return { start_time: nightStart, end_time: nightEnd };
    return { start_time: eveningStart, end_time: eveningEnd };
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

  function didWorkerRequestShift(workerId, shiftType) {
    return shiftRequests.some(r =>
      r.worker_id === workerId &&
      r.date === dateStr &&
      r.shift_type === shiftType &&
      (r.preference_type === 'can' || r.preference_type === 'prefer')
    );
  }

  function getEligibleWorkers(siteId, shiftType) {
    if (showAllWorkers) {
      return workers;
    }

    // Get workers with shift request for today with can/prefer
    let eligible = workers.filter(w => didWorkerRequestShift(w.id, shiftType));

    // If site has an activity type, filter by authorization
    const activity = getSiteShiftActivity(siteId, shiftType);
    if (activity && activity.activity_type_id) {
      // For now, show all (authorization check happens on backend)
      // TODO: Load worker authorizations and filter here for better UX
    }

    return eligible;
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


  function extractNumber(str) {
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
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

  function getUnassignedWorkers() {
    const assignedWorkerIds = new Set(assignments.filter(a => a.date === dateStr).map(a => a.worker_id));
    return workers.filter(w => !assignedWorkerIds.has(w.id)).sort((a, b) => a.first_name.localeCompare(b.first_name, 'he'));
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


  const dateLabel = viewDate.toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  function isSaturday(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDay() === 6;
  }

  function openReportPreview() {
    setShowReportPreview(true);
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/api/config/activity-templates', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (res.ok) {
        setTemplates(await res.json());
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
    const res = await fetch(`/api/config/activity-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setEditingTemplateId(null);
      const updated = await fetch('/api/config/activity-templates', { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (updated.ok) setTemplates(await updated.json());
    } else {
      const err = await res.json().catch(() => ({}));
      alert('שגיאה: ' + (err.error || res.status));
    }
  }

  async function deleteTemplate(id) {
    if (!confirm('למחוק תבנית זו?')) return;
    const res = await fetch(`/api/config/activity-templates/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (res.ok) {
      const updated = await fetch('/api/config/activity-templates', { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (updated.ok) setTemplates(await updated.json());
    } else {
      alert('שגיאה במחיקה');
    }
  }

  async function saveCurrentAsTemplate() {
    const name = saveAsTemplateName.trim();
    if (!name) return;

    const dayActivities = siteShiftActivities.filter(a => a.date === dateStr);
    if (dayActivities.length === 0) {
      alert('אין סוגי פעילות מוגדרים ליום זה');
      return;
    }

    try {
      // Create the template
      const createRes = await fetch('/api/config/activity-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        alert('שגיאה: ' + (err.error || createRes.statusText));
        return;
      }
      const newTemplate = await createRes.json();

      // Save items
      const items = dayActivities.map(a => ({
        site_id: a.site_id,
        shift_type: a.shift_type,
        activity_type_id: a.activity_type_id,
      }));
      const itemsRes = await fetch(`/api/config/activity-templates/${newTemplate.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ items }),
      });
      if (itemsRes.ok) {
        setShowSaveAsTemplate(false);
        setSaveAsTemplateName('');
        alert(`תבנית "${name}" נשמרה בהצלחה`);
      } else {
        alert('שגיאה בשמירת פעולות התבנית');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('שגיאה בשמירת התבנית');
    }
  }

  async function applyTemplate(templateId) {
    try {
      const res = await fetch(`/api/config/activity-templates/${templateId}/apply`, {
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

    // Get all workers with their assignments (including those with no assignments)
    const allWorkerAssignments = workers.map(w => ({
      id: w.id,
      name: `${w.first_name} ${w.family_name}`,
      first_name: w.first_name,
      assignments: workerAssignments[w.id]?.assignments || []
    })).sort((a, b) => a.name.localeCompare(b.name));

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
              <div className="report-title">
                <h1>{title}</h1>
                <p>דוח שיבוצים יומי לעובדים</p>
              </div>
              <div className="workers-list">
                {allWorkerAssignments.map(worker => (
                  <div key={worker.id} className="worker-report-section">
                    <div className="worker-report-name">{worker.name}</div>
                    <div className="worker-assignments">
                      {worker.assignments.length === 0 ? (
                        <div className="no-assignments">לא משובץ</div>
                      ) : (
                        <div style={{display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.5rem', alignItems: 'center'}}>
                          {worker.assignments.map((a) => {
                            const site = config.sites.find(s => s.id === a.site_id);
                            let shiftLabel = '🌙 ערב';
                            let startTime, endTime;
                            if (a.shift_type === 'morning') {
                              shiftLabel = '☀ בוקר';
                              startTime = a.start_time || morningStart;
                              endTime = a.end_time || morningEnd;
                            } else if (a.shift_type === 'night') {
                              shiftLabel = '⭐ תורנות';
                              startTime = a.start_time || nightStart;
                              endTime = a.end_time || nightEnd;
                            } else {
                              startTime = a.start_time || eveningStart;
                              endTime = a.end_time || eveningEnd;
                            }

                            return (
                              <div key={a.id} style={{display: 'contents'}}>
                                <div className="assignment-shift-badge">{shiftLabel}</div>
                                <div className="assignment-site">{site?.name}</div>
                                <div className="assignment-job">({a.job_name})</div>
                                <div className="assignment-time">{formatTime24(startTime)}–{formatTime24(endTime)}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #ddd'}}>
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

  function ShiftSection({ site, shiftType, label }) {
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
                <button
                  className="btn-primary"
                  onClick={handleSaveEdit}
                  style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}
                >✓</button>
                <button
                  className="btn-secondary"
                  onClick={() => setInlineEditingShift(null)}
                  style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}
                >✕</button>
              </div>
            ) : (
              <>
                <span className="room-shift-time">
                  {formatTime24(shiftTimes.start_time)}–{formatTime24(shiftTimes.end_time)}
                </span>
                <button
                  className="btn-edit-small"
                  onClick={handleStartEdit}
                  title="ערוך שעות"
                  style={{padding: '0.2rem 0.4rem', fontSize: '0.8rem', marginLeft: '0.5rem'}}
                >✏️</button>
              </>
            )}
          </div>
          {inlineEditingActivity === editKey ? (
            <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
              <select
                value={inlineActivityTypeId || ''}
                onChange={e => setInlineActivityTypeId(e.target.value ? parseInt(e.target.value) : null)}
                style={{fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #d1d5db'}}
              >
                <option value="">— אין —</option>
                {(config.activity_types || []).map(at => (
                  <option key={at.id} value={at.id}>{at.name}</option>
                ))}
              </select>
              <button
                className="btn-primary"
                onClick={() => {
                  updateSiteShiftActivity(site.id, shiftType, inlineActivityTypeId);
                  setInlineEditingActivity(null);
                }}
                style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}
              >✓</button>
              <button
                className="btn-secondary"
                onClick={() => setInlineEditingActivity(null)}
                style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}
              >✕</button>
            </div>
          ) : (
            <>
              {activity && activity.activity_name && (
                <span style={{
                  padding: '0.2rem 0.6rem',
                  background: '#dbeafe',
                  color: '#0369a1',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setInlineEditingActivity(editKey);
                  setInlineActivityTypeId(activity.activity_type_id);
                }}
                title="לחץ לעריכה"
                >
                  {activity.activity_name}
                </span>
              )}
              {!activity && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setInlineEditingActivity(editKey);
                    setInlineActivityTypeId(null);
                  }}
                  style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}}
                  title="הוסף סוג פעילות"
                >+ סוג פעילות</button>
              )}
            </>
          )}
        </div>
        <div className="room-card-content">
          {siteAssignments.length === 0 ? (
            <div className="room-empty">אין שיבוצים</div>
          ) : (
            <div className="room-assignments-list">
              {siteAssignments.map(a => (
                <div key={a.id} className="room-assignment-row" onClick={() => openEditModal(a)}>
                  <span className="room-assignment-text">
                    {a.job_name} · {a.first_name} {a.family_name}
                    <span className="room-assignment-time">
                      {formatTime24(resolveTime(a, shiftType, 'start_time'))}–{formatTime24(resolveTime(a, shiftType, 'end_time'))}
                    </span>
                  </span>
                  <button
                    className="btn-delete-small"
                    onClick={e => { e.stopPropagation(); deleteAssignment(a.id); }}
                    title="הסר שיבוץ"
                  >✕</button>
                </div>
              ))}
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


  return (
    <>
    <div className="room-view-container">
      <div className="room-view-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <h2>שיבוצים לחדרים</h2>
          <button onClick={loadTemplates} className="btn-primary btn-sm" title="החל תבנית">📋 תבנית</button>
          <button onClick={() => setShowSaveAsTemplate(true)} className="btn-secondary btn-sm" title="שמור תצורה נוכחית כתבנית">💾 שמור כתבנית</button>
          <button onClick={fetchSuggestions} disabled={suggestLoading} className="btn-primary btn-sm" title="הצע שיבוצים עובדים בהתאם לבקשות ולהרשאות">🤖 הצע שיבוץ</button>
          <button onClick={openReportPreview} className="btn-primary btn-sm" title="הדפס דו״ח שיבוצים">🖨️ הדפס</button>
        </div>
        <div className="room-nav">
          <button className="btn-secondary btn-sm" onClick={prevYear}>◀ שנה</button>
          <button className="btn-secondary btn-sm" onClick={prevMonth}>◀ חודש</button>
          <button className="btn-secondary btn-sm" onClick={prevDay}>◀ יום</button>
          <span className="room-date-label">{dateLabel}</span>
          <button className="btn-secondary btn-sm" onClick={nextDay}>יום ▶</button>
          <button className="btn-secondary btn-sm" onClick={nextMonth}>חודש ▶</button>
          <button className="btn-secondary btn-sm" onClick={nextYear}>שנה ▶</button>
        </div>
        <div className="room-shift-times-bar">
          <span>בוקר:</span>
          <span style={{fontWeight: 500, color: '#1a2e4a', minWidth: '100px'}}>{formatTime24(morningStart)}–{formatTime24(morningEnd)}</span>
          <span className="room-shift-times-sep" />
          <span>ערב:</span>
          <span style={{fontWeight: 500, color: '#1a2e4a', minWidth: '100px'}}>{formatTime24(eveningStart)}–{formatTime24(eveningEnd)}</span>
          <span className="room-shift-times-sep" />
          <span>תורנות:</span>
          <span style={{fontWeight: 500, color: '#1a2e4a', minWidth: '100px'}}>{formatTime24(nightStart)}–{formatTime24(nightEnd)}</span>
        </div>
      </div>

      {!config.sites || config.sites.length === 0 ? (
        <div className="loading">❌ אין אתרים מוגדרים. אנא הוסף אתרים בהגדרות ⚙️</div>
      ) : loading ? (
        <div className="loading">טוען...</div>
      ) : (
        <>
          <div className="room-requests-bar">
            <span className="room-requests-label">עובדים זמינים ({dateStr}):</span>
            <div className="room-requests-content">
              <div className="room-requests-shift">
                <span className="room-requests-icon">☀ בוקר:</span>
                {morningRequests.length === 0 ? (
                  <span className="room-requests-empty">אין</span>
                ) : (
                  morningRequests.map(r => (
                    <span
                      key={r.id}
                      className={`room-requests-worker pref-${r.preference_type}${isSaturday(r.date) && r.preference_type === 'cannot' ? ' saturday' : ''}`}
                      title={PREF_LABEL[r.preference_type]}
                    >
                      {r.first_name} {r.family_name}
                    </span>
                  ))
                )}
              </div>
              <div className="room-requests-shift">
                <span className="room-requests-icon">🌙 ערב:</span>
                {eveningRequests.length === 0 ? (
                  <span className="room-requests-empty">אין</span>
                ) : (
                  eveningRequests.map(r => (
                    <span
                      key={r.id}
                      className={`room-requests-worker pref-${r.preference_type}${isSaturday(r.date) && r.preference_type === 'cannot' ? ' saturday' : ''}`}
                      title={PREF_LABEL[r.preference_type]}
                    >
                      {r.first_name} {r.family_name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="room-unassigned-bar">
            <span className="room-unassigned-label">עובדים שלא משובצים ({dateStr}):</span>
            <div className="room-unassigned-content">
              {getUnassignedWorkers().length === 0 ? (
                <span className="room-unassigned-empty">כל העובדים משובצים ✓</span>
              ) : (
                getUnassignedWorkers().map(w => (
                  <span key={w.id} className="room-unassigned-worker">
                    {w.first_name} {w.family_name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="room-view-body">
            {!selectedGroupId ? (
              // Group buttons view
              <div className="room-groups-grid">
                {Object.entries(groupSitesByGroup(config.sites)).map(([groupId, sites]) => {
                  const group = getGroup(groupId);
                  return (
                    <button
                      key={groupId}
                      className="room-group-button"
                      style={{backgroundColor: group.color, borderColor: group.color}}
                      onClick={() => setSelectedGroupId(groupId)}
                    >
                      <div className="room-group-button-title">{group.name}</div>
                      <div className="room-group-button-icons">
                        {Array(Math.min(sites.length, 10)).fill(0).map((_, i) => (
                          <span key={i} style={{fontSize: '1.2rem'}}>🏢</span>
                        ))}
                        {sites.length > 10 && <span style={{fontSize: '0.8rem', marginLeft: '0.25rem'}}>+{sites.length - 10}</span>}
                      </div>
                      <div className="room-group-button-count">{sites.length} אתרים</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              // Sites view for selected group (inline, not modal)
              <div>
                <div style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <button className="btn-secondary btn-sm" onClick={() => setSelectedGroupId(null)}>
                    ◀ חזור לקבוצות
                  </button>
                  <h3 style={{fontSize: '1rem', color: '#1a2e4a'}}>{getGroup(selectedGroupId).name}</h3>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.8rem',
                  maxHeight: 'calc(100vh - 250px)',
                  overflow: 'hidden'
                }}>
                  {groupSitesByGroup(config.sites)[selectedGroupId]?.map((site) => {
                    const morningAssignments = getSiteShiftAssignments(site.id, 'morning');
                    const eveningAssignments = getSiteShiftAssignments(site.id, 'evening');
                    const morningActivity = getSiteShiftActivity(site.id, 'morning');
                    const eveningActivity = getSiteShiftActivity(site.id, 'evening');

                    return (
                      <div
                        key={site.id}
                        className="site-square"
                        onClick={() => setSelectedSiteId(site.id)}
                      >
                        <div className="site-square-title">{site.name}</div>
                        <div className="site-square-shift" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem', width: '100%'}}>
                            <span className="site-square-icon">☀</span>
                            {morningActivity?.activity_type_id && (
                              <span style={{
                                fontSize: '0.65rem',
                                color: '#b45309',
                                fontWeight: 600,
                                padding: '0.2rem 0.35rem',
                                background: '#fef9e7',
                                borderRadius: '3px',
                                whiteSpace: 'nowrap'
                              }}>
                                {(config.activity_types || []).find(at => at.id === morningActivity.activity_type_id)?.name}
                              </span>
                            )}
                          </div>
                          <div className="site-square-names" style={{marginLeft: '1.2rem', fontSize: '0.75rem', lineHeight: '1.2'}}>
                            {morningAssignments.length > 0 ? (
                              morningAssignments.map((a, idx) => (
                                <div key={idx}>{a.first_name} {a.family_name} ({a.job_name})</div>
                              ))
                            ) : (
                              <div>—</div>
                            )}
                          </div>
                        </div>
                        <div className="site-square-shift" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem', width: '100%'}}>
                            <span className="site-square-icon">🌙</span>
                            {eveningActivity?.activity_type_id && (
                              <span style={{
                                fontSize: '0.65rem',
                                color: '#0369a1',
                                fontWeight: 600,
                                padding: '0.2rem 0.35rem',
                                background: '#f0f9ff',
                                borderRadius: '3px',
                                whiteSpace: 'nowrap'
                              }}>
                                {(config.activity_types || []).find(at => at.id === eveningActivity.activity_type_id)?.name}
                              </span>
                            )}
                          </div>
                          <div className="site-square-names" style={{marginLeft: '1.2rem', fontSize: '0.75rem', lineHeight: '1.2'}}>
                            {eveningAssignments.length > 0 ? (
                              eveningAssignments.map((a, idx) => (
                                <div key={idx}>{a.first_name} {a.family_name} ({a.job_name})</div>
                              ))
                            ) : (
                              <div>—</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>

    {/* Site details modal */}
    {selectedSiteId && (() => {
      const site = config.sites.find(s => s.id === selectedSiteId);
      if (!site) return null;

      return (
        <div className="form-overlay" onClick={() => setSelectedSiteId(null)}>
          <div
            className="report-modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '900px', width: '95vw' }}
          >
            <div className="report-header">
              <h2>{site.name} — {dateLabel}</h2>
              <button className="btn-close" onClick={() => setSelectedSiteId(null)}>✕</button>
            </div>

            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {addingToShiftInSite && addingToShiftInSite.site_id === site.id ? (
                <div style={{background: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #d1d5db'}}>
                  <h3 style={{marginBottom: '1rem', color: '#1a2e4a'}}>הוסף שיבוץ — {addingToShiftInSite.shift_type === 'morning' ? 'בוקר' : addingToShiftInSite.shift_type === 'night' ? 'תורנות' : 'ערב'}</h3>

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
              ) : (
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem'}}>
                  <div style={{
                    order: 1,
                    background: 'linear-gradient(135deg, #fef9e7 0%, #fef5d9 100%)',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '2px solid #fbbf24',
                    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.1)'
                  }}>
                    <div style={{marginBottom: '0.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid #fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                      <h3 style={{margin: 0, color: '#b45309', fontSize: '1.1rem', fontWeight: 600}}>☀️ בוקר</h3>
                      <button onClick={() => openAddModalInSite(site.id, 'morning')} style={{fontSize: '0.95rem', fontWeight: 700, padding: '0.5rem 1rem', background: '#fbbf24', color: '#92400e', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'}}>הוסף עובד</button>
                    </div>
                    <ShiftSection site={site} shiftType="morning" label="בוקר"/>
                  </div>

                  <div style={{
                    order: 2,
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '2px solid #7dd3fc',
                    boxShadow: '0 4px 12px rgba(125, 211, 252, 0.1)'
                  }}>
                    <div style={{marginBottom: '0.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid #7dd3fc', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                      <h3 style={{margin: 0, color: '#0369a1', fontSize: '1.1rem', fontWeight: 600}}>🌙 ערב</h3>
                      <button onClick={() => openAddModalInSite(site.id, 'evening')} style={{fontSize: '0.95rem', fontWeight: 700, padding: '0.5rem 1rem', background: '#7dd3fc', color: '#0369a1', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'}}>הוסף עובד</button>
                    </div>
                    <ShiftSection site={site} shiftType="evening" label="ערב"/>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()}

    {/* Edit shift times modal */}
    {editingShiftTimes && (
      <div className="form-overlay" onClick={() => setEditingShiftTimes(null)}>
        <div className="assignment-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '400px'}}>
          <div className="modal-header">
            <h3>ערוך שעות משמרת</h3>
            <button className="btn-close" onClick={() => setEditingShiftTimes(null)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="modal-info">
              <p><strong>אתר:</strong> {editingShiftTimes.site_name}</p>
              <p><strong>משמרת:</strong> {editingShiftTimes.shift_type === 'morning' ? 'בוקר' : editingShiftTimes.shift_type === 'night' ? 'תורנות' : 'ערב'}</p>
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
      <div className="form-overlay" onClick={() => setEditingAssignment(null)}>
        <div className="assignment-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>עריכת שעות שיבוץ</h3>
            <button className="btn-close" onClick={() => setEditingAssignment(null)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="modal-info">
              <p><strong>עובד:</strong> {editingAssignment.first_name} {editingAssignment.family_name}</p>
              <p><strong>תפקיד:</strong> {editingAssignment.job_name}</p>
              <p><strong>אתר:</strong> {editingAssignment.site_name}</p>
            </div>
            <div className="form-group form-group-inline">
              <div>
                <label>שעת התחלה:</label>
                <input
                  type="time"
                  value={editTimes.start_time}
                  onChange={e => setEditTimes({ ...editTimes, start_time: e.target.value })}
                />
              </div>
              <div>
                <label>שעת סיום:</label>
                <input
                  type="time"
                  value={editTimes.end_time}
                  onChange={e => setEditTimes({ ...editTimes, end_time: e.target.value })}
                />
              </div>
            </div>
            <p className="room-edit-hint">השאר ריק לשימוש בשעות ברירת מחדל של המשמרת</p>
            <div className="form-group">
              <label>הערות:</label>
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
              <button className="btn-secondary" onClick={() => setEditingAssignment(null)}>ביטול</button>
              <button className="btn-primary" onClick={saveEditTimes}>שמור</button>
            </div>
          </div>
        </div>
      </div>
    )}


    {/* Save current as template modal */}
    {showSaveAsTemplate && (
      <div className="form-overlay" onClick={() => setShowSaveAsTemplate(false)}>
        <div className="assignment-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '360px'}}>
          <div className="modal-header">
            <h3>שמור כתבנית</h3>
            <button className="btn-close" onClick={() => setShowSaveAsTemplate(false)}>✕</button>
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
    {showTemplateSelector && (
      <div className="form-overlay" onClick={() => setShowTemplateSelector(false)}>
        <div className="assignment-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>בחר תבנית</h3>
            <button className="btn-close" onClick={() => setShowTemplateSelector(false)}>✕</button>
          </div>
          <div className="modal-body">
            {templates.length === 0 ? (
              <p style={{color: '#666', textAlign: 'center'}}>אין תבניות זמינות</p>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                {templates.map(template => (
                  <div key={template.id} style={{display: 'flex', gap: '0.25rem', alignItems: 'center'}}>
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
                          style={{flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '1rem', direction: 'rtl'}}
                        />
                        <button className="btn-save-inline" onClick={() => renameTemplate(template.id, editingTemplateName)}>שמור</button>
                        <button className="btn-remove" onClick={() => setEditingTemplateId(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => applyTemplate(template.id)}
                          style={{flex: 1, padding: '0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', textAlign: 'right', fontSize: '1rem', fontWeight: 500}}
                        >
                          {template.name}
                        </button>
                        <button className="btn-edit-inline" onClick={() => { setEditingTemplateId(template.id); setEditingTemplateName(template.name); }}>עריכה</button>
                        <button className="btn-remove" onClick={() => deleteTemplate(template.id)}>✕</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Suggestion modal */}
    {suggestionModal && (
      <div className="form-overlay" onClick={() => setSuggestionModal(null)}>
        <div className="assignment-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto'}}>
          <div className="modal-header">
            <h3>הצעות שיבוץ אוטומטי ל-{dateLabel}</h3>
            <button className="btn-close" onClick={() => setSuggestionModal(null)}>✕</button>
          </div>
          <div className="modal-body">
            {suggestionModal.suggestions.length === 0 && suggestionModal.unassignable.length === 0 ? (
              <p style={{textAlign: 'center', color: '#666'}}>אין הצעות שיבוץ זמינות. ודא שהוגדרו סוגי פעילות לחדרים ושעובדים ביקשו את המשמרות.</p>
            ) : (
              <>
                {suggestionModal.suggestions.length > 0 && (
                  <div style={{marginBottom: '1.5rem'}}>
                    <h4 style={{fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1a2e4a'}}>הצעות שיבוץ:</h4>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                      {suggestionModal.suggestions.map((suggestion, idx) => (
                        <label key={idx} style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer'}}>
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
                            style={{cursor: 'pointer'}}
                          />
                          <div style={{flex: 1}}>
                            <span style={{fontWeight: 600, color: '#1a2e4a'}}>{suggestion.site_name}</span>
                            <span style={{color: '#666', marginRight: '0.5rem'}}>({suggestion.shift_type === 'morning' ? 'בוקר' : suggestion.shift_type === 'evening' ? 'ערב' : 'תורנות'})</span>
                            <br />
                            <span style={{fontSize: '0.9rem', color: '#666'}}>
                              {suggestion.activity_type_name} ← {suggestion.worker_name}
                              <span style={{marginLeft: '0.5rem', padding: '0.1rem 0.4rem', backgroundColor: suggestion.preference_type === 'prefer' ? '#d1fae5' : '#dbeafe', borderRadius: '3px', fontSize: '0.8rem', fontWeight: 500, color: suggestion.preference_type === 'prefer' ? '#065f46' : '#0c4a6e'}}>
                                {suggestion.preference_type === 'prefer' ? '✓ מעדיף' : '✓ יכול'}
                              </span>
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {suggestionModal.unassignable.length > 0 && (
                  <div style={{padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fee2e2'}}>
                    <h4 style={{fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0', color: '#991b1b'}}>⚠️ לא ניתן לשבץ:</h4>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                      {suggestionModal.unassignable.map((item, idx) => (
                        <div key={idx} style={{fontSize: '0.9rem', color: '#7f1d1d', paddingBottom: '0.75rem', borderBottom: item !== suggestionModal.unassignable[suggestionModal.unassignable.length - 1] ? '1px solid #fecaca' : 'none'}}>
                          <div style={{fontWeight: 600, marginBottom: '0.5rem'}}>
                            <span>{item.site_name}</span>
                            <span style={{marginRight: '0.5rem'}}>({item.shift_type === 'morning' ? 'בוקר' : item.shift_type === 'evening' ? 'ערב' : 'תורנות'})</span>
                          </div>
                          <div style={{fontSize: '0.85rem', color: '#991b1b', marginBottom: '0.5rem'}}>
                            סוג פעילות: {item.activity_type_name}
                          </div>
                          <div style={{fontSize: '0.9rem', fontWeight: 500, color: '#991b1b', marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#fff5f5', borderRadius: '4px'}}>
                            {item.reason}
                          </div>
                          {item.unavailable_workers && item.unavailable_workers.length > 0 && (
                            <div style={{fontSize: '0.85rem', color: '#7f1d1d', backgroundColor: '#fff7f7', padding: '0.5rem', borderRadius: '4px'}}>
                              <div style={{fontWeight: 500, marginBottom: '0.3rem'}}>פירוט עובדים:</div>
                              {item.unavailable_workers.map((w, wIdx) => (
                                <div key={wIdx} style={{marginLeft: '1rem', fontSize: '0.85rem', padding: '0.2rem 0'}}>
                                  • <span style={{fontWeight: 500}}>{w.worker_name}</span>: {w.reason}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <div>
              <button className="btn-secondary" onClick={() => setSuggestionModal(null)}>ביטול</button>
              <button
                className="btn-primary"
                disabled={Object.keys(suggestionModal.selected).length === 0}
                onClick={async () => {
                  try {
                    const toApply = suggestionModal.suggestions.filter((_, i) => suggestionModal.selected[i]);
                    for (const suggestion of toApply) {
                      await fetch('/api/worker-site-assignments', {
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
                    }
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
    </>
  );
}
