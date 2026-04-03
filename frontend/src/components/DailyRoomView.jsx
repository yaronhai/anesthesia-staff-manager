import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const PREF_LABEL = { prefer: 'מעדיף', can: 'יכול', cannot: 'לא יכול' };

export default function DailyRoomView({ config, authToken }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [shiftRequests, setShiftRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Global shift time defaults (component state, not persisted)
  const [morningStart, setMorningStart] = useState('07:00');
  const [morningEnd, setMorningEnd] = useState('15:00');
  const [eveningStart, setEveningStart] = useState('15:00');
  const [eveningEnd, setEveningEnd] = useState('23:00');

  // Expanded site modal
  const [expandedSiteId, setExpandedSiteId] = useState(null);

  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState({});

  // Add assignment modal
  const [addingTo, setAddingTo] = useState(null); // { site_id, site_name, shift_type }
  const [newAssignment, setNewAssignment] = useState({ worker_id: null, start_time: '', end_time: '', notes: '' });

  // Edit times modal
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editTimes, setEditTimes] = useState({ start_time: '', end_time: '', notes: '' });

  // Report preview modal
  const [showReportPreview, setShowReportPreview] = useState(false);

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

  function prevDay()   { setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)); }
  function nextDay()   { setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); }
  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate())); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate())); }
  function prevYear()  { setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), d.getDate())); }
  function nextYear()  { setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())); }

  function getSiteShiftAssignments(siteId, shiftType) {
    return assignments.filter(a => a.site_id === siteId && a.date === dateStr && a.shift_type === shiftType);
  }

  function morningNames(siteId) {
    return getSiteShiftAssignments(siteId, 'morning').map(a => a.first_name).join(', ');
  }

  function eveningNames(siteId) {
    return getSiteShiftAssignments(siteId, 'evening').map(a => a.first_name).join(', ');
  }

  const dayRequests = shiftRequests.filter(r => r.date === dateStr);
  const morningRequests = dayRequests.filter(r => r.shift_type === 'morning');
  const eveningRequests = dayRequests.filter(r => r.shift_type === 'evening');

  function resolveTime(assignment, shiftType, field) {
    if (assignment[field]) return assignment[field];
    if (shiftType === 'morning') return field === 'start_time' ? morningStart : morningEnd;
    return field === 'start_time' ? eveningStart : eveningEnd;
  }

  function openAddModal(siteId, siteName, shiftType) {
    const defaultStart = shiftType === 'morning' ? morningStart : eveningStart;
    const defaultEnd   = shiftType === 'morning' ? morningEnd   : eveningEnd;
    setAddingTo({ site_id: siteId, site_name: siteName, shift_type: shiftType });
    setNewAssignment({ worker_id: null, start_time: defaultStart, end_time: defaultEnd, notes: '' });
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
    if (!addingTo || !newAssignment.worker_id) {
      return;
    }

    // Check if worker has a shift request for this date+shift with can/prefer
    const hasRequest = shiftRequests.some(r =>
      r.worker_id === newAssignment.worker_id &&
      r.date === dateStr &&
      r.shift_type === addingTo.shift_type &&
      (r.preference_type === 'can' || r.preference_type === 'prefer')
    );

    if (!hasRequest) {
      alert('העובד לא סימן את עצמו כיכול או מעדיף באותו יום במשמרת זו');
      return;
    }

    try {
      const res = await fetch('/api/worker-site-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          worker_id:   newAssignment.worker_id,
          date:        dateStr,
          site_id:     addingTo.site_id,
          shift_type:  addingTo.shift_type,
          start_time:  newAssignment.start_time || null,
          end_time:    newAssignment.end_time   || null,
          notes:       newAssignment.notes      || null,
        }),
      });
      if (res.ok) {
        fetchAll();
        setAddingTo(null);
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

  function getEligibleWorkers(shiftType) {
    // Only show workers who have a shift request for today with can/prefer
    return workers.filter(w =>
      shiftRequests.some(r =>
        r.worker_id === w.id &&
        r.date === dateStr &&
        r.shift_type === shiftType &&
        (r.preference_type === 'can' || r.preference_type === 'prefer')
      )
    );
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

  async function updateSiteGroup(siteId, groupId) {
    try {
      const res = await fetch(`/api/config/sites/${siteId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ group_id: groupId || null }),
      });
      if (res.ok) {
        // Update config with new site groups/sites data
        const newConfig = await res.json();
        // Force refresh by fetching config
        const configRes = await fetch('/api/config', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (configRes.ok) {
          // config is managed by parent, so this will update after parent refresh
        }
      }
    } catch (err) {
      console.error('Error updating site group:', err);
    }
  }

  function onDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const siteId = parseInt(draggableId);
    const targetGroupId = destination.droppableId === 'ungrouped' ? null : parseInt(destination.droppableId);

    updateSiteGroup(siteId, targetGroupId);
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

  function getGroupName(groupId) {
    return getGroup(groupId).name;
  }

  function getUnassignedWorkers() {
    const assignedWorkerIds = new Set(assignments.filter(a => a.date === dateStr).map(a => a.worker_id));
    return workers.filter(w => !assignedWorkerIds.has(w.id)).sort((a, b) => a.first_name.localeCompare(b.first_name, 'he'));
  }

  function toggleGroupExpanded(groupId) {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function expandAllGroups() {
    const allGroupIds = Object.keys(groupSitesByGroup(config.sites));
    const expanded = {};
    allGroupIds.forEach(id => { expanded[id] = true; });
    setExpandedGroups(expanded);
  }

  function collapseAllGroups() {
    setExpandedGroups({});
  }

  function formatTime24(timeStr) {
    if (!timeStr) return '';
    // Ensure HH:MM format (24-hour)
    const [hours, minutes] = timeStr.split(':');
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
                            const shiftLabel = a.shift_type === 'morning' ? '☀ בוקר' : '🌙 ערב';
                            const startTime = a.start_time || (a.shift_type === 'morning' ? morningStart : eveningStart);
                            const endTime = a.end_time || (a.shift_type === 'morning' ? morningEnd : eveningEnd);

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
    return (
      <div className={`room-shift-section room-shift-${shiftType}`}>
        <div className="room-shift-header">
          <span className="room-shift-label">{label}</span>
          <span className="room-shift-time">{formatTime24(shiftType === 'morning' ? morningStart : eveningStart)}–{formatTime24(shiftType === 'morning' ? morningEnd : eveningEnd)}</span>
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
        <button className="room-add-btn" onClick={() => openAddModal(site.id, site.name, shiftType)}>
          + הוסף ({label})
        </button>
      </div>
    );
  }


  return (
    <div className="room-view-container">
      <div className="room-view-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <h2>שיבוצים לחדרים</h2>
          <button onClick={openReportPreview} className="btn-primary btn-sm" title="הדפס דו״ח שיבוצים">🖨️ הדפס</button>
          <button onClick={expandAllGroups} className="btn-primary btn-sm" title="הרחב את כל הקבוצות">▼ הרחב הכל</button>
          <button onClick={collapseAllGroups} className="btn-secondary btn-sm" title="סגור את כל הקבוצות">▲ סגור הכל</button>
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
          <input type="time" value={morningStart} onChange={e => setMorningStart(e.target.value)} />
          <span>–</span>
          <input type="time" value={morningEnd} onChange={e => setMorningEnd(e.target.value)} />
          <span className="room-shift-times-sep" />
          <span>ערב:</span>
          <input type="time" value={eveningStart} onChange={e => setEveningStart(e.target.value)} />
          <span>–</span>
          <input type="time" value={eveningEnd} onChange={e => setEveningEnd(e.target.value)} />
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
            <DragDropContext onDragEnd={onDragEnd}>
              {Object.entries(groupSitesByGroup(config.sites)).map(([groupId, sites]) => {
                const group = getGroup(groupId);
                const isExpanded = expandedGroups[groupId];
                return (
                <div key={groupId} className="room-group-section" style={{backgroundColor: `${group.color}10`, borderColor: '#cbd5e1'}}>
                  <h3 className="room-group-title" onClick={() => toggleGroupExpanded(groupId)} style={{color: group.color, borderLeft: `4px solid ${group.color}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span>{group.name}</span>
                    <span style={{fontSize: '0.7rem', marginLeft: '0.5rem'}}>{isExpanded ? '▲' : '▼'}</span>
                  </h3>
                  {isExpanded && (
                  <Droppable droppableId={groupId} direction="horizontal" type="SITE">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`room-cards-grid${snapshot.isDraggingOver ? ' drag-over' : ''}`}
                      >
                        {sites.map((site, index) => (
                          <Draggable key={site.id} draggableId={String(site.id)} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`room-card${expandedSiteId === site.id ? ' room-card-expanded' : ''}${snapshot.isDragging ? ' dragging' : ''}`}
                                onClick={() => setExpandedSiteId(expandedSiteId === site.id ? null : site.id)}
                              >
                                <div className="room-card-title">
                                  <span>{site.name}</span>
                                  <span className="room-card-arrow">{expandedSiteId === site.id ? '▲' : '▼'}</span>
                                </div>
                                {expandedSiteId !== site.id && (
                                  <div className="room-card-summary">
                                    <div className="room-summary-row room-summary-morning">
                                      <span className="room-summary-icon">☀</span>
                                      <span>{morningNames(site.id) || '—'}</span>
                                    </div>
                                    <div className="room-summary-row room-summary-evening">
                                      <span className="room-summary-icon">🌙</span>
                                      <span>{eveningNames(site.id) || '—'}</span>
                                    </div>
                                  </div>
                                )}
                                {expandedSiteId === site.id && (
                                  <div onClick={e => e.stopPropagation()}>
                                    <ShiftSection site={site} shiftType="morning" label="בוקר"/>
                                    <ShiftSection site={site} shiftType="evening" label="ערב"/>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  )}
                </div>
              );
              })}
            </DragDropContext>
          </div>
        </>
      )}


      {/* Add assignment modal */}
      {addingTo && (
        <div className="form-overlay" onClick={() => setAddingTo(null)}>
          <div className="assignment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>הוסף שיבוץ — {addingTo.shift_type === 'morning' ? 'בוקר' : 'ערב'}</h3>
              <button className="btn-close" onClick={() => setAddingTo(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                <p><strong>אתר:</strong> {addingTo.site_name}</p>
                <p><strong>תאריך:</strong> {dateStr}</p>
              </div>
              {getEligibleWorkers(addingTo.shift_type).length === 0 ? (
                <div className="room-edit-hint">אין עובדים זמינים (שסומנו כיכולים או מעדיפים) במשמרת זו</div>
              ) : (
                <>
                  <div className="form-group">
                    <label>עובד:</label>
                    <select
                      value={newAssignment.worker_id || ''}
                      onChange={e => setNewAssignment({ ...newAssignment, worker_id: parseInt(e.target.value) })}
                    >
                      <option value="">בחר עובד...</option>
                      {getEligibleWorkers(addingTo.shift_type).map(w => (
                        <option key={w.id} value={w.id}>{w.first_name} {w.family_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group form-group-inline">
                    <div>
                      <label>שעת התחלה:</label>
                      <input type="time" value={newAssignment.start_time} onChange={e => setNewAssignment({ ...newAssignment, start_time: e.target.value })} />
                    </div>
                    <div>
                      <label>שעת סיום:</label>
                      <input type="time" value={newAssignment.end_time} onChange={e => setNewAssignment({ ...newAssignment, end_time: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>הערות:</label>
                    <input
                      type="text"
                      value={newAssignment.notes}
                      onChange={e => setNewAssignment({ ...newAssignment, notes: e.target.value })}
                      placeholder="הערות אופציונליות..."
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <div>
                <button className="btn-secondary" onClick={() => setAddingTo(null)}>ביטול</button>
                <button
                  className="btn-primary"
                  onClick={saveNewAssignment}
                  disabled={!newAssignment.worker_id}
                >שמור</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit times modal */}
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

      {showReportPreview && <ReportPreview />}
    </div>
  );
}
