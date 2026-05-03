import { useState, useEffect } from 'react';
import styles from '../styles/WorkerList.module.scss';

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
        className={styles.activityBtn}
        onClick={() => addAuthorization(at.id)}
      >
        {at.name}
      </button>
    );
  }

  function renderAvailableGrouped() {
    if (availableActivities.length === 0) {
      return <p className={styles.actAllAuthorized}>כל סוגי הפעילות מורשים כבר</p>;
    }
    if (actGroups.length === 0) {
      return (
        <div className={styles.actGroupItems}>
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
          <div className={styles.actGroupLabel}>{group.name}</div>
          <div className={styles.actGroupItems}>
            {items.map(renderActivityButton)}
          </div>
        </div>
      );
    });
    const ungrouped = availableActivities.filter(at => !at.group_id);
    if (ungrouped.length > 0) {
      sections.push(
        <div key="ungrouped">
          <div className={`${styles.actGroupLabel} ${styles.actUngroupedLabel}`}>ללא קבוצה</div>
          <div className={styles.actGroupItems}>
            {ungrouped.map(renderActivityButton)}
          </div>
        </div>
      );
    }
    return sections.length > 0 ? <div>{sections}</div> : <p className={styles.actAllAuthorized}>כל סוגי הפעילות מורשים כבר</p>;
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="settings-header">
          <h2>הרשאות לפעילויות — {worker.first_name} {worker.family_name}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className={styles.authModalContent}>
          {loading ? (
            <p>טוען...</p>
          ) : (
            <>
              <div className={styles.authSection}>
                <h4 className={styles.authSectionTitle}>מורשה עבור:</h4>
                {authorizations.length === 0 ? (
                  <p className={styles.authEmpty}>—</p>
                ) : (
                  <div className={styles.authList}>
                    {authorizations.map(auth => (
                      <div key={auth.activity_type_id} className={styles.authItem}>
                        <span>{auth.name}</span>
                        <button
                          className={`btn-remove ${styles.authRemoveBtn}`}
                          onClick={() => removeAuthorization(auth.activity_type_id)}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className={styles.authSectionTitle}>הוסף הרשאה:</h4>
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
  const checkMobile = () => window.innerWidth < 640;
  const checkLandscape = () => window.innerWidth < 900 && window.innerHeight < 500;
  const [isMobile, setIsMobile] = useState(checkMobile);
  const [isLandscape, setIsLandscape] = useState(checkLandscape);

  useEffect(() => {
    const handler = () => { setIsMobile(checkMobile()); setIsLandscape(checkLandscape()); };
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);

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
      <th className={styles.sortTh} onClick={() => handleSort(field)}>
        {children}
        <span className={styles.sortIcon} style={{ '--sort-opacity': active ? 1 : 0.3 }}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </th>
    );
  }

  if (workers.length === 0) {
    return <p className="empty">אין עובדים להצגה.</p>;
  }

  const detailModal = viewing && (
    <WorkerDetail
      worker={viewing}
      onClose={() => setViewing(null)}
      onEdit={onEdit}
      authToken={authToken}
      config={config}
      isSuperAdmin={isSuperAdmin}
    />
  );

  if (isMobile) {
    return (
      <>
        {detailModal}
        <div className="worker-card-list">
          {sorted.map(w => (
            <div key={w.id} className={`worker-card${w.is_active === false ? ' worker-card-inactive' : ''}`}>
              <div className="worker-card-info">
                <span className="worker-card-name">
                  {w.title} {w.first_name} {w.family_name}
                </span>
                <span className="worker-card-id">{w.id_number || '—'}</span>
                {w.phone && <span className="worker-card-id">{w.phone}</span>}
                {w.email && <span className="worker-card-id">{w.email}</span>}
                <span className="worker-card-badges">
                  {w.is_active === false && <span className="badge badge-inactive">לא פעיל</span>}
                  {currentBranchId && w.primary_branch_id && w.primary_branch_id !== currentBranchId && (
                    <span className={`badge badge-normal ${styles.borrowedBadge}`}>מושאל</span>
                  )}
                </span>
              </div>
              <div className="worker-card-actions">
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
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (isLandscape) {
    return (
      <>
        {detailModal}
        <div className="worker-table-wrap">
        <table className="worker-table">
          <thead>
            <tr>
              <SortTh field="title">תואר</SortTh>
              <SortTh field="first_name">שם פרטי</SortTh>
              <SortTh field="family_name">שם משפחה</SortTh>
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
                  {w.is_active === false && <span className={`badge badge-inactive ${styles.badgeMargin}`}>לא פעיל</span>}
                  {currentBranchId && w.primary_branch_id && w.primary_branch_id !== currentBranchId && (
                    <span className={`badge badge-normal ${styles.borrowedBadge}`} title={`סניף ראשי: ${w.primary_branch_name}`}>מושאל</span>
                  )}
                </td>
                <td><strong>{w.family_name}</strong></td>
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

  return (
    <>
      {detailModal}
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
                {w.is_active === false && <span className={`badge badge-inactive ${styles.badgeMargin}`}>לא פעיל</span>}
                {currentBranchId && w.primary_branch_id && w.primary_branch_id !== currentBranchId && (
                  <span
                    className={`badge badge-normal ${styles.borrowedBadge}`}
                    title={`סניף ראשי: ${w.primary_branch_name}`}
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
