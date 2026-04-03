import { useState, useEffect } from 'react';

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

  // Expanded site card
  const [expandedSiteId, setExpandedSiteId] = useState(null);

  // Add assignment modal
  const [addingTo, setAddingTo] = useState(null); // { site_id, site_name, shift_type }
  const [newAssignment, setNewAssignment] = useState({ worker_id: null, position_id: null, start_time: '', end_time: '', notes: '' });

  // Edit times modal
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editTimes, setEditTimes] = useState({ start_time: '', end_time: '', notes: '' });

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
    setNewAssignment({ worker_id: null, position_id: null, start_time: defaultStart, end_time: defaultEnd, notes: '' });
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
    if (!addingTo || !newAssignment.worker_id || !newAssignment.position_id) return;
    try {
      const res = await fetch('/api/worker-site-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          worker_id:   newAssignment.worker_id,
          date:        dateStr,
          site_id:     addingTo.site_id,
          position_id: newAssignment.position_id,
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

  const positionsForAddSite = addingTo
    ? config.site_positions.filter(p => p.site_id === addingTo.site_id)
    : [];

  const dateLabel = viewDate.toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  function ShiftSection({ site, shiftType, label }) {
    const siteAssignments = getSiteShiftAssignments(site.id, shiftType);
    return (
      <div className={`room-shift-section room-shift-${shiftType}`}>
        <div className="room-shift-header">
          <span className="room-shift-label">{label}</span>
          <span className="room-shift-time">{shiftType === 'morning' ? morningStart : eveningStart}–{shiftType === 'morning' ? morningEnd : eveningEnd}</span>
        </div>
        <div className="room-card-content">
          {siteAssignments.length === 0 ? (
            <div className="room-empty">אין שיבוצים</div>
          ) : (
            <div className="room-assignments-list">
              {siteAssignments.map(a => (
                <div key={a.id} className="room-assignment-row" onClick={() => openEditModal(a)}>
                  <span className="room-assignment-text">
                    {a.position_name} · {a.first_name} {a.family_name}
                    <span className="room-assignment-time">
                      {resolveTime(a, shiftType, 'start_time')}–{resolveTime(a, shiftType, 'end_time')}
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

  function SidebarSection({ title, requests }) {
    return (
      <div className="room-sidebar-section">
        <div className="room-sidebar-section-title">{title}</div>
        {requests.length === 0 ? (
          <div className="room-sidebar-empty">אין בקשות</div>
        ) : (
          requests.map(r => (
            <div key={r.id} className={`room-sidebar-worker pref-${r.preference_type}`}>
              <span>{r.first_name} {r.family_name}</span>
              <span className="room-sidebar-pref">{PREF_LABEL[r.preference_type]}</span>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="room-view-container">
      <div className="room-view-header">
        <h2>שיבוצים לחדרים</h2>
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
        <div className="room-view-body">
          <div className="room-cards-grid">
            {config.sites.map(site => (
              <div
                key={site.id}
                className={`room-card${expandedSiteId === site.id ? ' room-card-expanded' : ''}`}
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
            ))}
          </div>

          <div className="room-sidebar">
            <div className="room-sidebar-title">בקשות משמרת — {dateStr}</div>
            <SidebarSection title="בוקר" requests={morningRequests} />
            <SidebarSection title="ערב" requests={eveningRequests} />
          </div>
        </div>
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
              <div className="form-group">
                <label>עובד:</label>
                <select
                  value={newAssignment.worker_id || ''}
                  onChange={e => setNewAssignment({ ...newAssignment, worker_id: parseInt(e.target.value), position_id: null })}
                >
                  <option value="">בחר עובד...</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.first_name} {w.family_name}</option>
                  ))}
                </select>
              </div>
              {newAssignment.worker_id && (
                <div className="form-group">
                  <label>תפקיד:</label>
                  <select
                    value={newAssignment.position_id || ''}
                    onChange={e => setNewAssignment({ ...newAssignment, position_id: parseInt(e.target.value) })}
                  >
                    <option value="">בחר תפקיד...</option>
                    {positionsForAddSite.map(pos => (
                      <option key={pos.id} value={pos.id}>{pos.position_name}</option>
                    ))}
                  </select>
                </div>
              )}
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
            </div>
            <div className="modal-footer">
              <div>
                <button className="btn-secondary" onClick={() => setAddingTo(null)}>ביטול</button>
                <button
                  className="btn-primary"
                  onClick={saveNewAssignment}
                  disabled={!newAssignment.worker_id || !newAssignment.position_id}
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
                <p><strong>תפקיד:</strong> {editingAssignment.position_name}</p>
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
    </div>
  );
}
