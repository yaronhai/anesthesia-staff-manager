import { useState, useEffect, useRef } from 'react';

export default function DailyRoomView({ config, authToken, branchId }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [shiftRequests, setShiftRequests] = useState([]);
  const [siteShiftActivities, setSiteShiftActivities] = useState([]);
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

  // Suggestions modal
  const [suggestionModal, setSuggestionModal] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Send schedule modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendWorkerIds, setSendWorkerIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Site card size
  const [cardSize, setCardSize] = useState(148);
  const MIN_CARD = 90;
  const MAX_CARD = 280;
  const STEP = 20;

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();
  const day = viewDate.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  useEffect(() => { fetchAll(); }, [month, year, authToken, branchId]);

  // Auto-select first group on mount
  useEffect(() => {
    if (config.site_groups?.length && !selectedGroupId) {
      const groups = Object.keys(groupSitesByGroup(config.sites));
      if (groups.length > 0) {
        setSelectedGroupId(groups[0]);
      }
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
        fetch(`/api/vacation-requests?status=approved`, { headers: { Authorization: `Bearer ${authToken}` } }),
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
      if (vacRes.ok) setVacations(await vacRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
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

  async function sendSchedule() {
    if (sendWorkerIds.length === 0) {
      alert('בחר לפחות עובד אחד');
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/send-schedule-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ date: dateStr, workerIds: sendWorkerIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult(data);
      } else {
        alert(`שגיאה: ${data.error || 'שגיאה בserver'}`);
      }
    } catch (err) {
      console.error('Error sending schedule:', err);
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

  const dayRequests = shiftRequests.filter(r => r.date === dateStr);
  const availabilityShifts = (config.shift_types || []).filter(st => st.show_in_availability_bar);
  const requestsByShift = Object.fromEntries(
    availabilityShifts.map(st => [st.key, dayRequests.filter(r => r.shift_type === st.key)])
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

    const sd = shiftDefaults[shiftType];
    const fallbacks = { morning: [morningStart, morningEnd], evening: [eveningStart, eveningEnd], night: [nightStart, nightEnd] };
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

    const allWorkers = hasJobRestrictions
      ? workers.filter(w => allowedJobs.some(j => j.job_id === w.job_id))
      : workers;

    if (showAllWorkers) {
      return allWorkers;
    }

    // Get workers with shift request for today with can/prefer
    return allWorkers.filter(w => didWorkerRequestShift(w.id, shiftType));
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

  function getUnassignedWorkers() {
    const assignedWorkerIds = new Set(assignments.filter(a => a.date === dateStr).map(a => a.worker_id));
    const requestedWorkerIds = new Set(
      shiftRequests.filter(r => r.date === dateStr && (r.preference_type === 'can' || r.preference_type === 'prefer')).map(r => r.worker_id)
    );
    return workers
      .filter(w => !assignedWorkerIds.has(w.id) && requestedWorkerIds.has(w.id))
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

  const branchQS = branchId ? `?branch_id=${branchId}` : '';

  async function loadTemplates() {
    try {
      const res = await fetch(`/api/config/activity-templates${branchQS}`, {
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
        body: JSON.stringify({ name }),
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
        <div className="room-nav">
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
          <span style={{width: '1px', background: '#d1d5db', alignSelf: 'stretch', margin: '0 0.25rem'}} />
          <button onClick={loadTemplates} className="btn-primary btn-sm" title="החל תבנית">📋</button>
          <button onClick={() => setShowSaveAsTemplate(true)} className="btn-secondary btn-sm" title="שמור תצורה נוכחית כתבנית">💾</button>
          <button onClick={fetchSuggestions} disabled={suggestLoading} className="btn-primary btn-sm" title="הצע שיבוצים עובדים בהתאם לבקשות ולהרשאות">🤖</button>
          <button onClick={openReportPreview} className="btn-primary btn-sm" title="הדפס דו״ח שיבוצים">🖨️</button>
          <button onClick={() => {
            setShowSendModal(true);
            const todayAssignments = assignments.filter(a => a.date === dateStr);
            const workerIds = [...new Set(todayAssignments.map(a => a.worker_id))];
            setSendWorkerIds(workerIds);
          }} className="btn-primary btn-sm" title="שלח תוכנית יומית בהודעה">💬</button>
          <button onClick={fetchFairnessReport} disabled={fairnessLoading} className="btn-secondary btn-sm" title="טבלת צדק לפי אתרים">⚖️</button>
          <div style={{flex: 1}} />
          {/* ── Daily staffing summary (inline) ───────────────────────── */}
          {(() => {
            const sitesInSelectedGroup = (selectedGroupId === '__all__' || !selectedGroupId)
              ? config.sites
              : selectedGroupId === 'ungrouped'
              ? config.sites.filter(s => !s.group_id || s.group_id === null)
              : config.sites.filter(s => s.group_id === parseInt(selectedGroupId));

            const configuredSlots = siteShiftActivities.filter(
              a => a.date === dateStr && a.activity_type_id && sitesInSelectedGroup.some(s => s.id === a.site_id)
            );
            if (configuredSlots.length === 0) return null;

            const dayAssignments = assignments.filter(a => a.date === dateStr);
            const shiftStats = (config.shift_types || [])
              .filter(st => st.show_in_assignments)
              .map(st => {
                const slotsForShift = configuredSlots.filter(a => a.shift_type === st.key);
                const assignedSiteIds = new Set(
                  dayAssignments.filter(a => a.shift_type === st.key).map(a => a.site_id)
                );
                const filled = slotsForShift.filter(a => assignedSiteIds.has(a.site_id)).length;
                return { key: st.key, label: st.label_he, total: slotsForShift.length, filled, missing: slotsForShift.length - filled };
              })
              .filter(s => s.total > 0);

            const totalSlots   = shiftStats.reduce((s, x) => s + x.total,  0);
            const totalFilled  = shiftStats.reduce((s, x) => s + x.filled, 0);
            const totalMissing = totalSlots - totalFilled;
            const pct = totalSlots > 0 ? Math.round((totalFilled / totalSlots) * 100) : 0;
            const barColor = totalMissing === 0 ? '#16a34a' : totalFilled === 0 ? '#ef4444' : '#f59e0b';

            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'white',
                border: '1.5px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.3rem 0.75rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div style={{ width: '80px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '4px', transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontWeight: 600, color: '#1a2e4a', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  {totalFilled}/{totalSlots}
                </span>
                <span style={{
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: totalMissing === 0 ? '#dcfce7' : '#fef2f2',
                  color:      totalMissing === 0 ? '#166534' : '#991b1b',
                  whiteSpace: 'nowrap',
                }}>
                  {totalMissing === 0 ? '✓ מלא' : `${totalMissing} חסרים`}
                </span>
                {shiftStats.map(s => {
                    const chipBg     = s.missing === 0 ? '#dcfce7' : s.filled === 0 ? '#fef2f2' : '#fef9e7';
                    const chipColor  = s.missing === 0 ? '#166534' : s.filled === 0 ? '#991b1b' : '#92400e';
                    const chipBorder = s.missing === 0 ? '#86efac' : s.filled === 0 ? '#fca5a5' : '#fde68a';
                    return (
                      <div key={s.key} style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        background: chipBg, border: `1px solid ${chipBorder}`,
                        borderRadius: '6px', padding: '0.15rem 0.45rem',
                        fontSize: '0.78rem', fontWeight: 600, color: chipColor,
                      }}>
                        <span>{s.label}</span>
                        <span>{s.filled}/{s.total}</span>
                      </div>
                    );
                  })}
              </div>
            );
          })()}
        </div>
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
        </div>
      </div>

      {!config.sites || config.sites.length === 0 ? (
        <div className="loading">❌ אין אתרים מוגדרים. אנא הוסף אתרים בהגדרות ⚙️</div>
      ) : loading ? (
        <div className="loading">טוען...</div>
      ) : (
        <>
          <div className="room-requests-bar">
            <span className="room-requests-label">עובדים זמינים:</span>
            <div className="room-requests-content">
              {availabilityShifts.map(st => {
                const requests = requestsByShift[st.key] || [];
                const { icon, label_he: label, color, bg_color: bg } = st;
                return ({ icon, label, requests, color, bg });
              }).map(({ icon, label, requests, color, bg }) => (
                <div key={label} className="room-requests-shift">
                  <span className="room-requests-icon" style={{color, background: bg, padding: '0.05rem 0.35rem', borderRadius: '3px', fontWeight: 700}}>{icon} {label}:</span>
                  {requests.length === 0 ? (
                    <span className="room-requests-empty">אין</span>
                  ) : (
                    Object.entries(groupRequestsByJob(requests)).map(([job, reqs]) => (
                      <span key={job} style={{display:'inline-flex', alignItems:'center', gap:'0.15rem', marginRight:'0.4rem'}}>
                        <span style={{fontSize:'0.6rem', color:'#7f1d1d', fontWeight:700, whiteSpace:'nowrap'}}>{job}:</span>
                        {reqs.map(r => (
                          <span
                            key={r.id}
                            className={`room-requests-worker pref-${r.preference_type}${isSaturday(r.date) && r.preference_type === 'cannot' ? ' saturday' : ''}`}
                            title={prefLabel[r.preference_type]}
                          >
                            {r.first_name} {r.family_name}
                          </span>
                        ))}
                      </span>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="room-unassigned-bar">
            <span className="room-unassigned-label">עובדים שלא משובצים:</span>
            <div className="room-unassigned-content">
              {getUnassignedWorkers().length === 0 ? (
                <span className="room-unassigned-empty">כל העובדים משובצים ✓</span>
              ) : (
                Object.entries(groupWorkersByJob(getUnassignedWorkers())).map(([job, wList]) => (
                  <span key={job} style={{display:'inline-flex', alignItems:'center', gap:'0.15rem', marginRight:'0.4rem'}}>
                    <span style={{fontSize:'0.6rem', color:'#7f1d1d', fontWeight:700, whiteSpace:'nowrap'}}>{job}:</span>
                    {wList.map(w => (
                      <span key={w.id} className="room-unassigned-worker">
                        {w.first_name} {w.family_name}
                      </span>
                    ))}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="room-view-body">
            {/* Group tabs */}
            <div style={{
              display: 'flex', gap: '0.25rem', alignItems: 'center',
              borderBottom: '2px solid #e5e7eb',
              flexWrap: 'wrap', padding: '0.5rem 0.5rem 0 0.5rem',
              marginBottom: '1rem', flexShrink: 0
            }}>
              <button onClick={() => setCardSize(s => Math.max(MIN_CARD, s - STEP))} className="btn-secondary btn-sm" title="הקטן כרטיסייה" style={{fontWeight:700, fontSize:'1rem', padding:'0.1rem 0.5rem'}}>−</button>
              <button onClick={() => setCardSize(s => Math.min(MAX_CARD, s + STEP))} className="btn-secondary btn-sm" title="הגדל כרטיסייה" style={{fontWeight:700, fontSize:'1rem', padding:'0.1rem 0.5rem'}}>+</button>
              <button
                onClick={() => setSelectedGroupId('__all__')}
                style={{
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: selectedGroupId === '__all__' ? '#1a2e4a' : '#f3f4f6',
                  color: selectedGroupId === '__all__' ? 'white' : '#666',
                  fontWeight: selectedGroupId === '__all__' ? 600 : 400,
                  cursor: 'pointer',
                  borderRadius: '6px 6px 0 0',
                  whiteSpace: 'nowrap',
                }}
              >הכל</button>
              {Object.entries(groupSitesByGroup(config.sites)).map(([groupId, sites]) => {
                const group = getGroup(groupId);
                return (
                  <button
                    key={groupId}
                    onClick={() => setSelectedGroupId(groupId)}
                    style={{
                      padding: '0.75rem 1rem',
                      border: 'none',
                      background: selectedGroupId === groupId ? '#1a2e4a' : '#f3f4f6',
                      color: selectedGroupId === groupId ? 'white' : '#666',
                      fontWeight: selectedGroupId === groupId ? 600 : 400,
                      cursor: 'pointer',
                      borderRadius: '6px 6px 0 0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>

            {selectedGroupId ? (
              // Sites grid for selected group
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                justifyContent: 'flex-start',
                alignContent: 'flex-start',
                flex: 1,
                overflow: 'auto'
              }}>
                {(selectedGroupId === '__all__'
                  ? config.sites.slice().sort(sortSites)
                  : groupSitesByGroup(config.sites)[selectedGroupId] || []
                ).map((site) => {
                    const morningAssignments = getSiteShiftAssignments(site.id, 'morning');
                    const eveningAssignments = getSiteShiftAssignments(site.id, 'evening');
                    const morningActivity = getSiteShiftActivity(site.id, 'morning');
                    const eveningActivity = getSiteShiftActivity(site.id, 'evening');
                    const morningTimes = getSiteShiftTimes(site.id, 'morning');
                    const eveningTimes = getSiteShiftTimes(site.id, 'evening');

                    const scale = Math.max(0.6, Math.min(1.8, cardSize / 148));
                    const fs = v => `${(v * scale).toFixed(3)}rem`;

                    return (
                      <div
                        key={site.id}
                        className="site-square"
                        style={{ width: cardSize, padding: `${0.5 * scale}rem ${0.45 * scale}rem` }}
                        onClick={() => setSelectedSiteId(site.id)}
                      >
                        <div className="site-square-title" style={{fontSize: fs(0.78)}}>{site.name}</div>
                        <div className="site-square-shift" style={{flexDirection: 'column', alignItems: 'flex-start', gap: `${0.25 * scale}rem`}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: `${0.3 * scale}rem`, width: '100%'}}>
                            <span className="site-square-icon" style={{fontSize: fs(0.78)}}>☀</span>
                            <span style={{fontSize: fs(0.6), color: '#b45309', fontWeight: 600, whiteSpace: 'nowrap'}}>
                              {formatTime24(morningTimes.start_time)}–{formatTime24(morningTimes.end_time)}
                            </span>
                          </div>
                          {morningActivity?.activity_type_id && (
                            <div style={{marginRight: `${1.2 * scale}rem`}}>
                              <span style={{
                                fontSize: fs(0.65),
                                color: '#b45309', fontWeight: 600,
                                padding: `${0.2 * scale}rem ${0.35 * scale}rem`,
                                background: '#fef9e7', borderRadius: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block'
                              }}>
                                {(config.activity_types || []).find(at => at.id === morningActivity.activity_type_id)?.name}
                              </span>
                            </div>
                          )}
                          <div className="site-square-names" style={{marginRight: `${1.2 * scale}rem`, fontSize: fs(0.58), lineHeight: '1.3'}}>
                            {morningAssignments.length > 0 ? (
                              morningAssignments.map((a, idx) => (
                                <div key={idx}>{a.first_name} {a.family_name} ({a.job_name})</div>
                              ))
                            ) : (
                              <div>—</div>
                            )}
                          </div>
                        </div>
                        <div className="site-square-shift" style={{flexDirection: 'column', alignItems: 'flex-start', gap: `${0.25 * scale}rem`}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: `${0.3 * scale}rem`, width: '100%'}}>
                            <span className="site-square-icon" style={{fontSize: fs(0.78)}}>🌙</span>
                            <span style={{fontSize: fs(0.6), color: '#0369a1', fontWeight: 600, whiteSpace: 'nowrap'}}>
                              {formatTime24(eveningTimes.start_time)}–{formatTime24(eveningTimes.end_time)}
                            </span>
                          </div>
                          {eveningActivity?.activity_type_id && (
                            <div style={{marginRight: `${1.2 * scale}rem`}}>
                              <span style={{
                                fontSize: fs(0.65),
                                color: '#0369a1', fontWeight: 600,
                                padding: `${0.2 * scale}rem ${0.35 * scale}rem`,
                                background: '#f0f9ff', borderRadius: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block'
                              }}>
                                {(config.activity_types || []).find(at => at.id === eveningActivity.activity_type_id)?.name}
                              </span>
                            </div>
                          )}
                          <div className="site-square-names" style={{marginRight: `${1.2 * scale}rem`, fontSize: fs(0.58), lineHeight: '1.3'}}>
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
            ) : null}
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
                  <h3 style={{marginBottom: '1rem', color: '#1a2e4a'}}>הוסף שיבוץ — {shiftDefaults[addingToShiftInSite.shift_type]?.label_he || addingToShiftInSite.shift_type}</h3>

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
                      <h3 style={{margin: 0, color: '#b45309', fontSize: '1.1rem', fontWeight: 600}}>☀️ {shiftDefaults.morning?.label_he}</h3>
                      <button onClick={() => openAddModalInSite(site.id, 'morning')} style={{fontSize: '0.95rem', fontWeight: 700, padding: '0.5rem 1rem', background: '#fbbf24', color: '#92400e', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'}}>הוסף עובד</button>
                    </div>
                    <ShiftSection site={site} shiftType="morning" label={shiftDefaults.morning?.label_he}/>
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
                      <h3 style={{margin: 0, color: '#0369a1', fontSize: '1.1rem', fontWeight: 600}}>🌙 {shiftDefaults.evening?.label_he}</h3>
                      <button onClick={() => openAddModalInSite(site.id, 'evening')} style={{fontSize: '0.95rem', fontWeight: 700, padding: '0.5rem 1rem', background: '#7dd3fc', color: '#0369a1', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'}}>הוסף עובד</button>
                    </div>
                    <ShiftSection site={site} shiftType="evening" label={shiftDefaults.evening?.label_he}/>
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
        <div className="assignment-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '550px', maxHeight: '80vh', overflowY: 'auto'}}>
          <div className="modal-header" style={{padding: '0.6rem 1rem'}}>
            <h3 style={{fontSize: '0.95rem'}}>הצעות שיבוץ אוטומטי ל-{dateLabel}</h3>
            <button className="btn-close" onClick={() => setSuggestionModal(null)}>✕</button>
          </div>
          <div className="modal-body" style={{padding: '0.5rem 0.75rem'}}>
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

    {showSendModal && (
      <div className="form-overlay" onClick={() => setShowSendModal(false)}>
        <div className="settings-modal" onClick={e => e.stopPropagation()} style={{ direction: 'rtl', maxWidth: 500 }}>
          <div className="settings-header">
            <h2>💬 שלח תוכנית יום</h2>
            <button className="btn-close" onClick={() => { setShowSendModal(false); setSendResult(null); }}>✕</button>
          </div>
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!sendResult ? (
              <>
                <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>תאריך: <strong>{dateStr}</strong></p>
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {workers.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#999' }}>אין עובדים במערכת</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setSendWorkerIds(workers.map(w => w.id))} style={{ fontSize: '0.85rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          בחר הכל
                        </button>
                        <button onClick={() => setSendWorkerIds([])} style={{ fontSize: '0.85rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          בטל הכל
                        </button>
                      </div>
                      {workers.map(w => (
                        <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', padding: '0.25rem' }}>
                          <input
                            type="checkbox"
                            checked={sendWorkerIds.includes(w.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSendWorkerIds([...sendWorkerIds, w.id]);
                              } else {
                                setSendWorkerIds(sendWorkerIds.filter(id => id !== w.id));
                              }
                            }}
                          />
                          {w.first_name} {w.family_name} {w.user_id ? '' : '(אין חשבון)'}
                        </label>
                      ))}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={sendSchedule} disabled={sending || sendWorkerIds.length === 0} className="btn-primary" style={{ flex: 1 }}>
                    {sending ? '...שולח' : '✓ שלח'}
                  </button>
                  <button onClick={() => setShowSendModal(false)} className="btn-secondary">ביטול</button>
                </div>
              </>
            ) : (
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
                {sendResult.noAccount.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ea580c' }}>ללא חשבון ({sendResult.noAccount.length}):</p>
                    <ul style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0', paddingRight: '1.5rem' }}>
                      {sendResult.noAccount.map(name => <li key={name}>{name}</li>)}
                    </ul>
                  </div>
                )}
                {sendResult.failed.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>כשל ({sendResult.failed.length}):</p>
                    <ul style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0', paddingRight: '1.5rem' }}>
                      {sendResult.failed.map(name => <li key={name}>{name}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={() => { setShowSendModal(false); setSendResult(null); }} className="btn-secondary" style={{ width: '100%' }}>סגור</button>
              </>
            )}
          </div>
        </div>
      </div>
    )}

    {fairnessReport && (
      <div className="form-overlay" onClick={() => setFairnessReport(null)}>
        <div className="settings-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, direction: 'rtl' }}>
          <div className="settings-header">
            <h2>⚖️ טבלת צדק</h2>
            <button className="btn-close" onClick={() => setFairnessReport(null)}>✕</button>
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
