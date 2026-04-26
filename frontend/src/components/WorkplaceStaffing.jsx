import { useState, useEffect } from 'react';

export default function WorkplaceStaffing({ config, authToken }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [siteAssignments, setSiteAssignments] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState({ site_id: null, position_id: null, notes: '' });
  const [loading, setLoading] = useState(false);

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Auto-select first group on mount
  useEffect(() => {
    if (config.site_groups?.length && selectedGroupId === null) {
      setSelectedGroupId(config.site_groups[0].id);
    }
  }, [config.site_groups]);

  useEffect(() => {
    fetchStaffingData();
  }, [month, year, authToken]);

  async function fetchStaffingData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, year });
      const res = await fetch(`/api/staffing/month-view?${params}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Staffing data:', data);
        setWorkers(data.workers || []);
        setSiteAssignments(data.siteAssignments || []);
      } else {
        console.error('API error:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Error fetching staffing data:', err);
    } finally {
      setLoading(false);
    }
  }

  const sitesInGroup = selectedGroupId
    ? (config.sites || []).filter(s => s.group_id === selectedGroupId)
    : (config.sites || []);

  const allowedJobsForGroup = selectedGroupId
    ? (config.site_group_allowed_jobs?.[selectedGroupId] || null)
    : null;

  const filteredWorkers = allowedJobsForGroup && allowedJobsForGroup.length > 0
    ? workers.filter(w => allowedJobsForGroup.some(j => j.job_id === w.job_id))
    : workers;

  // Debug logging
  if (selectedGroupId && config.site_group_allowed_jobs) {
    console.log('Selected Group ID:', selectedGroupId);
    console.log('All allowed jobs config:', config.site_group_allowed_jobs);
    console.log('Allowed for this group:', allowedJobsForGroup);
    console.log('All workers:', workers.map(w => ({ id: w.id, name: w.first_name + ' ' + w.family_name, job_id: w.job_id })));
    console.log('Filtered workers:', filteredWorkers.map(w => ({ id: w.id, name: w.first_name + ' ' + w.family_name, job_id: w.job_id })));
  }

  function getDayAssignments(workerId, dayOfMonth) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    let assignments = siteAssignments.filter(a => a.worker_id === workerId && a.date === dateStr);
    if (selectedGroupId) {
      const groupSiteIds = sitesInGroup.map(s => s.id);
      assignments = assignments.filter(a => groupSiteIds.includes(a.site_id));
    }
    return assignments;
  }

  async function saveAssignment() {
    if (!editingCell || !editingAssignment.site_id || !editingAssignment.position_id) return;

    try {
      const res = await fetch('/api/worker-site-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          worker_id: editingCell.workerId,
          date: editingCell.date,
          site_id: editingAssignment.site_id,
          position_id: editingAssignment.position_id,
          notes: editingAssignment.notes || null,
        }),
      });

      if (res.ok) {
        fetchStaffingData();
        setEditingCell(null);
      } else {
        const error = await res.json();
        alert('שגיאה: ' + (error.error || 'לא ניתן לשמור את השיבוץ'));
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
      alert('שגיאה בשמירת השיבוץ');
    }
  }

  async function deleteAssignment(assignmentId) {
    try {
      const res = await fetch(`/api/worker-site-assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (res.ok) {
        fetchStaffingData();
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
    }
  }

  function openEditModal(workerId, dayOfMonth) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    const existing = getDayAssignments(workerId, dayOfMonth)[0];

    setEditingCell({ workerId, dayOfMonth, date: dateStr, existingId: existing?.id });
    setEditingAssignment({
      site_id: existing?.site_id || null,
      position_id: existing?.position_id || null,
      notes: existing?.notes || '',
    });
  }

  function handleSiteChange(siteId) {
    setEditingAssignment({ site_id: parseInt(siteId), position_id: null, notes: editingAssignment.notes });
  }

  const positionsForSelectedSite = editingAssignment.site_id
    ? (config.site_positions || []).filter(p => p.site_id === editingAssignment.site_id)
    : [];

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const emptyDays = Array.from({ length: firstDay }, (_, i) => null);

  const monthName = new Date(year, month - 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  return (
    <div className="staffing-container">
      <div className="staffing-header">
        <div className="staffing-controls">
          <button onClick={() => setViewDate(new Date(year - 1, month - 1))}>◀ שנה</button>
          <button onClick={() => setViewDate(new Date(year, month - 2))}>◀ חודש</button>
          <span className="current-month">{monthName}</span>
          <button onClick={() => setViewDate(new Date(year, month))}>חודש ▶</button>
          <button onClick={() => setViewDate(new Date(year + 1, month - 1))}>שנה ▶</button>
        </div>

        {(config.site_groups?.length > 0) && (
          <div style={{
            display: 'flex', gap: '0.25rem',
            borderBottom: '2px solid #e5e7eb',
            flexWrap: 'wrap', padding: '0 0.5rem',
            marginTop: '0.5rem'
          }}>
            {config.site_groups.map(group => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                style={{
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: selectedGroupId === group.id ? '#1a2e4a' : '#f3f4f6',
                  color: selectedGroupId === group.id ? 'white' : '#666',
                  fontWeight: selectedGroupId === group.id ? 600 : 400,
                  cursor: 'pointer',
                  borderRadius: '6px 6px 0 0',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!config.sites || config.sites.length === 0 ? (
        <div className="loading">
          ❌ אין אתרים מוגדרים. אנא הוסף אתרים בהגדרות (סמל הגדרות ⚙️)
        </div>
      ) : loading ? (
        <div className="loading">טוען...</div>
      ) : !workers.length ? (
        <div className="loading">אין עובדים בעדיין. אנא הוסף עובדים בטאב ניהול עובדים.</div>
      ) : (
        <div className="staffing-grid">
          <table>
            <thead>
              <tr>
                <th className="worker-name-col">שם עובד</th>
                {days.map(day => (
                  <th key={day} className="day-col">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map(worker => (
                <tr key={worker.id} className="worker-row">
                  <td className="worker-name-col">
                    <div className="worker-name">{worker.first_name} {worker.family_name}</div>
                  </td>
                  {days.map(day => {
                    const assignments = getDayAssignments(worker.id, day);
                    const isToday = new Date().getFullYear() === year && new Date().getMonth() + 1 === month && new Date().getDate() === day;
                    return (
                      <td
                        key={day}
                        className={`day-cell ${isToday ? 'today' : ''}`}
                        onClick={() => openEditModal(worker.id, day)}
                      >
                        <div className="cell-content">
                          {assignments.map(a => {
                            const shiftDef = (config.shift_types || []).find(st => st.key === a.shift_type);
                            const startTime = a.start_time || shiftDef?.default_start || '';
                            const endTime = a.end_time || shiftDef?.default_end || '';
                            const hoursLabel = startTime && endTime ? `${startTime}–${endTime}` : shiftDef?.label_short || '';
                            return (
                              <div key={a.id} className="assignment-chip">
                                <span>{a.position_name}</span>
                                <span className="site-info">@ {a.site_name}</span>
                                {hoursLabel && <span className="shift-hours">{hoursLabel}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingCell && (
        <div className="form-overlay" onClick={() => setEditingCell(null)}>
          <div className="assignment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>עריכת התמנייה</h3>
              <button className="btn-close" onClick={() => setEditingCell(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="modal-info">
                <p><strong>עובד:</strong> {workers.find(w => w.id === editingCell.workerId)?.first_name} {workers.find(w => w.id === editingCell.workerId)?.family_name}</p>
                <p><strong>תאריך:</strong> {editingCell.date}</p>
              </div>

              <div className="form-group">
                <label>אתר:</label>
                <select
                  value={editingAssignment.site_id || ''}
                  onChange={e => handleSiteChange(e.target.value)}
                >
                  <option value="">בחר אתר...</option>
                  {config.sites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              {editingAssignment.site_id && (
                <div className="form-group">
                  <label>תפקיד:</label>
                  <select
                    value={editingAssignment.position_id || ''}
                    onChange={e => setEditingAssignment({ ...editingAssignment, position_id: parseInt(e.target.value) })}
                  >
                    <option value="">בחר תפקיד...</option>
                    {positionsForSelectedSite.map(pos => (
                      <option key={pos.id} value={pos.id}>{pos.position_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>הערות:</label>
                <input
                  type="text"
                  value={editingAssignment.notes}
                  onChange={e => setEditingAssignment({ ...editingAssignment, notes: e.target.value })}
                  placeholder="הערות אופציונליות..."
                />
              </div>
            </div>

            <div className="modal-footer">
              {editingCell.existingId && (
                <button
                  className="btn-delete"
                  onClick={() => {
                    deleteAssignment(editingCell.existingId);
                    setEditingCell(null);
                  }}
                >
                  הסר התמנייה
                </button>
              )}
              <div>
                <button className="btn-secondary" onClick={() => setEditingCell(null)}>ביטול</button>
                <button
                  className="btn-primary"
                  onClick={saveAssignment}
                  disabled={!editingAssignment.site_id || !editingAssignment.position_id}
                >
                  שמור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
