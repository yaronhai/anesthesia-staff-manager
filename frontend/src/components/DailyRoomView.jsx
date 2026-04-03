import { useState, useEffect } from 'react';

export default function DailyRoomView({ config, authToken }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingToSite, setAddingToSite] = useState(null);
  const [newAssignment, setNewAssignment] = useState({ worker_id: null, position_id: null, notes: '' });

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();
  const day = viewDate.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

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
        setWorkers(data.workers || []);
        setAssignments(data.siteAssignments || []);
      } else {
        console.error('API error:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Error fetching staffing data:', err);
    } finally {
      setLoading(false);
    }
  }

  function getDayAssignmentsForSite(siteId) {
    return assignments.filter(a => a.site_id === siteId && a.date === dateStr);
  }

  function prevDay() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  }
  function nextDay() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  }
  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()));
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }
  function prevYear() {
    setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()));
  }
  function nextYear() {
    setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
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

  function openAddModal(siteId, siteName) {
    setAddingToSite({ site_id: siteId, site_name: siteName });
    setNewAssignment({ worker_id: null, position_id: null, notes: '' });
  }

  function handleWorkerChange(workerId) {
    setNewAssignment({ ...newAssignment, worker_id: parseInt(workerId), position_id: null });
  }

  function handlePositionChange(positionId) {
    setNewAssignment({ ...newAssignment, position_id: parseInt(positionId) });
  }

  async function saveNewAssignment() {
    if (!addingToSite || !newAssignment.worker_id || !newAssignment.position_id) return;

    try {
      const res = await fetch('/api/worker-site-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          worker_id: newAssignment.worker_id,
          date: dateStr,
          site_id: addingToSite.site_id,
          position_id: newAssignment.position_id,
          notes: newAssignment.notes || null,
        }),
      });

      if (res.ok) {
        fetchStaffingData();
        setAddingToSite(null);
      } else {
        const error = await res.json();
        alert('שגיאה: ' + (error.error || 'לא ניתן להוסיף שיבוץ'));
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
      alert('שגיאת חיבור לשרת');
    }
  }

  const positionsForSite = addingToSite
    ? config.site_positions.filter(p => p.site_id === addingToSite.site_id)
    : [];

  const dateLabel = viewDate.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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
        <div className="room-cards-grid">
          {config.sites.map(site => {
            const siteAssignments = getDayAssignmentsForSite(site.id);
            return (
              <div key={site.id} className="room-card">
                <div className="room-card-title">{site.name}</div>
                <div className="room-card-content">
                  {siteAssignments.length === 0 ? (
                    <div className="room-empty">אין שיבוצים</div>
                  ) : (
                    <div className="room-assignments-list">
                      {siteAssignments.map(a => (
                        <div key={a.id} className="room-assignment-row">
                          <span className="room-assignment-text">
                            {a.position_name} · {a.first_name || 'ללא שם'} {a.family_name || ''}
                          </span>
                          <button
                            className="btn-delete-small"
                            onClick={() => deleteAssignment(a.id)}
                            title="הסר שיבוץ"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="room-add-btn"
                  onClick={() => openAddModal(site.id, site.name)}
                >
                  + הוסף שיבוץ
                </button>
              </div>
            );
          })}
        </div>
      )}

      {addingToSite && (
        <div className="form-overlay" onClick={() => setAddingToSite(null)}>
          <div className="assignment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>הוסף שיבוץ לחדר</h3>
              <button className="btn-close" onClick={() => setAddingToSite(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="modal-info">
                <p><strong>אתר:</strong> {addingToSite.site_name}</p>
                <p><strong>תאריך:</strong> {dateStr}</p>
              </div>

              <div className="form-group">
                <label>עובד:</label>
                <select
                  value={newAssignment.worker_id || ''}
                  onChange={e => handleWorkerChange(e.target.value)}
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
                    onChange={e => handlePositionChange(e.target.value)}
                  >
                    <option value="">בחר תפקיד...</option>
                    {positionsForSite.map(pos => (
                      <option key={pos.id} value={pos.id}>{pos.position_name}</option>
                    ))}
                  </select>
                </div>
              )}

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
                <button className="btn-secondary" onClick={() => setAddingToSite(null)}>ביטול</button>
                <button
                  className="btn-primary"
                  onClick={saveNewAssignment}
                  disabled={!newAssignment.worker_id || !newAssignment.position_id}
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
