import { useState, useEffect } from 'react';

function WorkerAuthButton({ worker, authToken, config }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)} className="btn-auth" title="הרשאות">
        🔑
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
  const availableActivities = (config.activity_types || []).filter(at => !authorizedIds.has(at.id));
  const actGroups = config.activity_type_groups || [];

  function renderActivityButton(at) {
    return (
      <button
        key={at.id}
        onClick={() => addAuthorization(at.id)}
        style={{
          padding: '0.2rem 0.5rem',
          background: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          cursor: 'pointer',
          textAlign: 'right',
          fontSize: '0.82rem',
        }}
      >
        {at.name}
      </button>
    );
  }

  function renderAvailableGrouped() {
    if (availableActivities.length === 0) {
      return <p style={{ color: '#666', margin: 0 }}>כל סוגי הפעילות מורשים כבר</p>;
    }
    if (actGroups.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {availableActivities.map(renderActivityButton)}
        </div>
      );
    }
    const sections = [];
    actGroups.forEach(group => {
      const items = availableActivities.filter(at => at.group_id === group.id);
      if (items.length === 0) return;
      sections.push(
        <div key={group.id}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem', marginTop: '0.4rem' }}>
            {group.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {items.map(renderActivityButton)}
          </div>
        </div>
      );
    });
    const ungrouped = availableActivities.filter(at => !at.group_id);
    if (ungrouped.length > 0) {
      sections.push(
        <div key="ungrouped">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.2rem', marginTop: '0.4rem' }}>
            ללא קבוצה
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {ungrouped.map(renderActivityButton)}
          </div>
        </div>
      );
    }
    return sections.length > 0 ? <div>{sections}</div> : <p style={{ color: '#666', margin: 0 }}>כל סוגי הפעילות מורשים כבר</p>;
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="settings-header">
          <h2>הרשאות לפעילויות — {worker.first_name} {worker.family_name}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
          {loading ? (
            <p>טוען...</p>
          ) : (
            <>
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 style={{ marginBottom: '0.25rem', color: '#1a2e4a', fontSize: '0.8rem' }}>מורשה עבור:</h4>
                {authorizations.length === 0 ? (
                  <p style={{ color: '#666', margin: 0 }}>—</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {authorizations.map(auth => (
                      <div key={auth.activity_type_id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.2rem 0.4rem',
                        background: '#dbeafe',
                        borderRadius: '4px',
                        border: '1px solid #0369a1'
                      }}>
                        <span>{auth.name}</span>
                        <button
                          className="btn-remove"
                          onClick={() => removeAuthorization(auth.activity_type_id)}
                          style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ marginBottom: '0.25rem', color: '#1a2e4a', fontSize: '0.8rem' }}>הוסף הרשאה:</h4>
                {renderAvailableGrouped()}
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

function WorkerDetail({ worker, onClose, onEdit, authToken, config, isSuperAdmin }) {
  const independentTypeIds = new Set(
    (config.employment_types || []).filter(t => t.is_independent).map(t => t.id)
  );
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
          {(isSuperAdmin || worker.is_primary_branch !== false) && (
            <button className="btn-primary" onClick={() => { onClose(); onEdit(worker); }}>עריכה</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkerList({ workers, onEdit, onDelete, onResetPassword, authToken, config, isSuperAdmin, currentBranchId, isAdmin, roles = [] }) {
  const [viewing, setViewing] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const independentTypeIds = new Set(
    (config.employment_types || []).filter(t => t.is_independent).map(t => t.id)
  );

  const roleDisplayMap = roles.reduce((acc, r) => { acc[r.name] = r.display_name; return acc; }, {});
  function getRoleLabel(classification) {
    return roleDisplayMap[classification] ||
      (classification === 'superadmin' ? 'מנהל ראשי' : classification === 'admin' ? 'מנהל סניף' : 'משתמש');
  }
  function isAdminRole(classification) {
    const role = roles.find(r => r.name === classification);
    return role ? role.tier !== 'user' : classification === 'admin' || classification === 'superadmin';
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const sorted = sortField ? [...workers].sort((a, b) => {
    const av = (a[sortField] || '').toString().toLowerCase();
    const bv = (b[sortField] || '').toString().toLowerCase();
    return sortDir === 'asc' ? av.localeCompare(bv, 'he') : bv.localeCompare(av, 'he');
  }) : workers;

  function SortTh({ field, children }) {
    const active = sortField === field;
    return (
      <th onClick={() => handleSort(field)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
        {children}
        <span style={{ marginRight: '4px', opacity: active ? 1 : 0.3, fontSize: '0.7rem' }}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </th>
    );
  }

  if (workers.length === 0) {
    return <p className="empty">אין עובדים להצגה.</p>;
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
          isSuperAdmin={isSuperAdmin}
        />
      )}
      <div className="worker-table-wrap">
      <table className="worker-table">
        <thead>
          <tr>
            <SortTh field="title">תואר</SortTh>
            <SortTh field="first_name">שם פרטי</SortTh>
            <SortTh field="family_name">שם משפחה</SortTh>
            <SortTh field="id_number">ת.ז.</SortTh>
            <SortTh field="classification">סיווג</SortTh>
            <SortTh field="job">תפקיד</SortTh>
            <SortTh field="employment_type">סוג העסקה</SortTh>
            <th>טלפון</th>
            <SortTh field="email">אימייל</SortTh>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(w => (
            <tr key={w.id} className={w.is_active === false ? 'worker-row-inactive' : ''}>
              <td>{w.title}</td>
              <td>
                <strong>{w.first_name}</strong>
                {w.is_active === false && <span className="badge badge-inactive" style={{ marginRight: '0.3rem' }}>לא פעיל</span>}
                {currentBranchId && w.primary_branch_id && w.primary_branch_id !== currentBranchId && (
                  <span
                    className="badge badge-normal"
                    title={`סניף ראשי: ${w.primary_branch_name}`}
                    style={{ marginRight: '0.3rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
                  >
                    מושאל
                  </span>
                )}
              </td>
              <td><strong>{w.family_name}</strong></td>
              <td>{w.id_number || '—'}</td>
              <td>
                <span className={`badge ${isAdminRole(w.classification) ? 'badge-admin' : 'badge-normal'}`}>
                  {getRoleLabel(w.classification)}
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
                <button onClick={() => setViewing(w)} className="btn-view" title="צפייה">👁</button>
                {(isSuperAdmin || w.is_primary_branch !== false) && (
                  <>
                    <WorkerAuthButton worker={w} authToken={authToken} config={config} />
                    <button onClick={() => onEdit(w)} className="btn-edit" title="עריכה">✏️</button>
                    <button onClick={() => {
                      if (window.confirm(`לאפס סיסמא של ${w.first_name} ${w.family_name}?`)) {
                        onResetPassword(w.id);
                      }
                    }} className="btn-reset" title="איפוס סיסמא">🔄</button>
                    <button onClick={() => onDelete(w.id)} className="btn-delete" title="מחיקה">🗑️</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
