import { useState, useEffect } from 'react';

function WorkerAuthButton({ worker, authToken, config }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)} className="btn-auth">
        הרשאות
      </button>
      {showModal && (
        <WorkerActivityAuthorizations
          worker={worker}
          authToken={authToken}
          config={config}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function WorkerActivityAuthorizations({ worker, authToken, config, onClose }) {
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAuthorizations();
  }, [worker.id]);

  async function fetchAuthorizations() {
    setLoading(true);
    try {
      const res = await fetch(`/api/workers/${worker.id}/activity-authorizations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setAuthorizations(await res.json());
      }
    } catch (err) {
      console.error('Error fetching authorizations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function addAuthorization(activityTypeId) {
    try {
      const res = await fetch(`/api/workers/${worker.id}/activity-authorizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ activity_type_id: activityTypeId }),
      });
      if (res.ok) {
        setAuthorizations(await res.json());
      } else {
        const err = await res.json();
        alert('שגיאה: ' + (err.error || 'לא ניתן להוסיף הרשאה'));
      }
    } catch (err) {
      console.error('Error adding authorization:', err);
    }
  }

  async function removeAuthorization(activityTypeId) {
    try {
      const res = await fetch(`/api/workers/${worker.id}/activity-authorizations/${activityTypeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setAuthorizations(await res.json());
      }
    } catch (err) {
      console.error('Error removing authorization:', err);
    }
  }

  const authorizedIds = new Set(authorizations.map(a => a.activity_type_id));
  const unavailableActivities = (config.activity_types || []).filter(at => authorizedIds.has(at.id));
  const availableActivities = (config.activity_types || []).filter(at => !authorizedIds.has(at.id));

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="settings-header">
          <h2>הרשאות לפעילויות — {worker.first_name} {worker.family_name}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '1rem', fontSize: '0.9rem' }}>
          {loading ? (
            <p>טוען...</p>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem', color: '#1a2e4a' }}>מורשה עבור:</h4>
                {authorizations.length === 0 ? (
                  <p style={{ color: '#666' }}>—</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {authorizations.map(auth => (
                      <div key={auth.activity_type_id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem',
                        background: '#dbeafe',
                        borderRadius: '4px',
                        border: '1px solid #0369a1'
                      }}>
                        <span>{auth.name}</span>
                        <button
                          className="btn-remove"
                          onClick={() => removeAuthorization(auth.activity_type_id)}
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ marginBottom: '0.5rem', color: '#1a2e4a' }}>הוסף הרשאה:</h4>
                {availableActivities.length === 0 ? (
                  <p style={{ color: '#666' }}>כל סוגי הפעילות מורשים כבר</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {availableActivities.map(at => (
                      <button
                        key={at.id}
                        onClick={() => addAuthorization(at.id)}
                        style={{
                          padding: '0.5rem',
                          background: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          textAlign: 'right'
                        }}
                      >
                        {at.name}
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

function WorkerDetail({ worker, onClose, onEdit, authToken, config }) {
  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{worker.title} {worker.first_name} {worker.family_name}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="detail-grid">
          <div className="detail-row">
            <span className="detail-label">תעודת זהות</span>
            <span className="detail-value">{worker.id_number || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">סיווג</span>
            <span className="detail-value">
              <span className={`badge ${worker.classification === 'admin' ? 'badge-admin' : 'badge-normal'}`}>
                {worker.classification === 'admin' ? 'מנהל' : 'משתמש'}
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">תואר</span>
            <span className="detail-value">{worker.title || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">שם פרטי</span>
            <span className="detail-value">{worker.first_name || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">שם משפחה</span>
            <span className="detail-value">{worker.family_name || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">תפקיד</span>
            <span className="detail-value">{worker.job || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">סוג העסקה</span>
            <span className="detail-value">
              <span className={`badge ${independentTypeIds.has(worker.employment_type_id) ? 'badge-self' : 'badge-normal'}`}>
                {worker.employment_type}
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">טלפון</span>
            <span className="detail-value">{worker.phone || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">אימייל</span>
            <span className="detail-value">{worker.email || '—'}</span>
          </div>
          <div className="detail-row detail-row-full">
            <span className="detail-label">הערות</span>
            <span className="detail-value">{worker.notes || '—'}</span>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>סגור</button>
          <button className="btn-primary" onClick={() => { onClose(); onEdit(worker); }}>עריכה</button>
        </div>
      </div>
    </div>
  );
}

export default function WorkerList({ workers, onEdit, onDelete, onResetPassword, authToken, config }) {
  const [viewing, setViewing] = useState(null);

  const independentTypeIds = new Set(
    (config.employment_types || []).filter(t => t.is_independent).map(t => t.id)
  );

  if (workers.length === 0) {
    return <p className="empty">אין עובדים עדיין. לחץ על "+ הוסף עובד" כדי להתחיל.</p>;
  }

  return (
    <>
      {viewing && (
        <WorkerDetail
          worker={viewing}
          onClose={() => setViewing(null)}
          onEdit={onEdit}
          authToken={authToken}
          config={config}
        />
      )}
      <table className="worker-table">
        <thead>
          <tr>
            <th>תואר</th>
            <th>שם פרטי</th>
            <th>שם משפחה</th>
            <th>ת.ז.</th>
            <th>סיווג</th>
            <th>תפקיד</th>
            <th>סוג העסקה</th>
            <th>טלפון</th>
            <th>אימייל</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {workers.map(w => (
            <tr key={w.id}>
              <td>{w.title}</td>
              <td><strong>{w.first_name}</strong></td>
              <td><strong>{w.family_name}</strong></td>
              <td>{w.id_number || '—'}</td>
              <td>
                <span className={`badge ${w.classification === 'admin' ? 'badge-admin' : 'badge-normal'}`}>
                  {w.classification === 'admin' ? 'מנהל' : 'משתמש'}
                </span>
              </td>
              <td>{w.job}</td>
              <td>
                <span className={`badge ${independentTypeIds.has(w.employment_type_id) ? 'badge-self' : 'badge-normal'}`}>
                  {w.employment_type}
                </span>
              </td>
              <td>{w.phone || '—'}</td>
              <td>{w.email || '—'}</td>
              <td>
                <button onClick={() => setViewing(w)} className="btn-view">צפייה</button>
                <WorkerAuthButton worker={w} authToken={authToken} config={config} />
                <button onClick={() => onEdit(w)} className="btn-edit">עריכה</button>
                <button onClick={() => {
                  if (window.confirm(`לאפס סיסמא של ${w.first_name} ${w.family_name}?`)) {
                    onResetPassword(w.id);
                  }
                }} className="btn-reset">איפוס</button>
                <button onClick={() => onDelete(w.id)} className="btn-delete">מחיקה</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
