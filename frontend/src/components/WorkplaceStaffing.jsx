import { useState, useEffect } from 'react';

export default function WorkplaceStaffing({ config, authToken }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [siteAssignments, setSiteAssignments] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState({ site_id: null, position_id: null, notes: '' });
  const [loading, setLoading] = useState(false);

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();

  useEffect(() => {
    fetchStaffingData();
  }, [month, year, selectedSiteId, authToken]);

  async function fetchStaffingData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, year });
      if (selectedSiteId) params.append('siteId', selectedSiteId);
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

  function getDayAssignments(workerId, dayOfMonth) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    return siteAssignments.filter(a => a.worker_id === workerId && a.date === dateStr);
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
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
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
    ? config.site_positions.filter(p => p.site_id === editingAssignment.site_id)
    : [];

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const emptyDays = Array.from({ length: firstDay }, (_, i) => null);

  const monthName = new Date(year, month - 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  return (
    <div className="staffing-container">
      <div className="staffing-header">
        <h2>ניהול התמנויות אתר</h2>
        <div className="staffing-controls">
          <button onClick={() => setViewDate(new Date(year - 1, month - 1))}>◀ שנה</button>
          <button onClick={() => setViewDate(new Date(year, month - 2))}>◀ חודש</button>
          <span className="current-month">{monthName}</span>
          <button onClick={() => setViewDate(new Date(year, month))}>חודש ▶</button>
          <button onClick={() => setViewDate(new Date(year + 1, month - 1))}>שנה ▶</button>

          {(!config.sites || config.sites.length === 0) ? (
            <div className="site-filter">
              <select disabled>
                <option>אנא הוסף אתרים בהגדרות</option>
              </select>
            </div>
          ) : (
            <div className="site-filter">
              <select value={selectedSiteId || ''} onChange={e => setSelectedSiteId(e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">כל האתרים</option>
                {(config.sites || []).map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
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
              {workers.map(worker => (
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
                          {assignments.map(a => (
                            <div key={a.id} className="assignment-chip">
                              <span>{a.position_name}</span>
                              <span className="site-info">@ {a.site_name}</span>
                            </div>
                          ))}
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
