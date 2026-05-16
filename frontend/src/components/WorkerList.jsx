import { useState, useEffect, useRef } from 'react';
import styles from '../styles/WorkerList.module.scss';
import PhotoCropModal from './PhotoCropModal';
import { useDraggableModal } from '../hooks/useDraggableModal';
import { COLUMN_LABELS, DEFAULT_COLUMN_ORDER, DEFAULT_NAME_FORMAT } from './WorkerColumnSettings';
const UPLOADS_BASE = import.meta.env.DEV ? 'http://localhost:5001' : '';
const resolvePhotoUrl = url => !url ? null : url.startsWith('data:') ? url : UPLOADS_BASE + url;

function waLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('0') ? '972' + digits.slice(1) : digits;
  return `whatsapp://send?phone=${intl}`;
}

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

export function WorkerAuthorizationsPanel({ worker, authToken, config }) {
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    fetchAuthorizations();
  }, [worker.id]);

  async function fetchAuthorizations() {
    setLoading(true);
    try {
      const res = await fetch(`/api/workers/${worker.id}/activity-authorizations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setAuthorizations(await res.json());
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ activity_type_id: activityTypeId }),
      });
      if (res.ok) setAuthorizations(await res.json());
      else { const err = await res.json(); alert('שגיאה: ' + (err.error || 'לא ניתן להוסיף הרשאה')); }
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
      if (res.ok) setAuthorizations(await res.json());
    } catch (err) {
      console.error('Error removing authorization:', err);
    }
  }

  async function updatePriority(activityTypeId, priority) {
    try {
      const res = await fetch(`/api/workers/${worker.id}/activity-authorizations/${activityTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ priority: Number(priority) }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAuthorizations(prev => prev.map(a => a.activity_type_id === activityTypeId ? { ...a, priority: updated.priority } : a));
      }
    } catch (err) {
      console.error('Error updating priority:', err);
    }
  }

  const authorizedIds = new Set(authorizations.map(a => a.activity_type_id));
  const availableActivities = (config.activity_types || []).filter(at => !authorizedIds.has(at.id));
  const actGroups = config.activity_type_groups || [];

  async function addGroupAuthorizations(groupId) {
    const items = availableActivities.filter(at => at.group_id === groupId);
    for (const at of items) await addAuthorization(at.id);
  }

  function renderActivityButton(at) {
    return (
      <button type="button" key={at.id} className={styles.activityBtn} onClick={() => addAuthorization(at.id)}>
        {at.name}
      </button>
    );
  }

  function renderAvailableGrouped() {
    if (availableActivities.length === 0)
      return <p className={styles.actAllAuthorized}>כל סוגי הפעילות מורשים כבר</p>;
    if (actGroups.length === 0)
      return <div className={styles.actGroupItems}>{availableActivities.map(renderActivityButton)}</div>;
    const sections = [];
    actGroups.forEach(group => {
      const items = availableActivities.filter(at => at.group_id === group.id);
      if (!items.length) return;
      sections.push(
        <div key={group.id}>
          <div className={styles.actGroupLabelRow}>
            <span className={styles.actGroupLabel}>{group.name}</span>
            <button type="button" className={styles.actGroupSelectAll} onClick={() => addGroupAuthorizations(group.id)}>
              + הוסף קבוצה
            </button>
          </div>
          <div className={styles.actGroupItems}>{items.map(renderActivityButton)}</div>
        </div>
      );
    });
    const ungrouped = availableActivities.filter(at => !at.group_id);
    if (ungrouped.length > 0)
      sections.push(
        <div key="ungrouped">
          <div className={styles.actGroupLabelRow}>
            <span className={`${styles.actGroupLabel} ${styles.actUngroupedLabel}`}>ללא קבוצה</span>
          </div>
          <div className={styles.actGroupItems}>{ungrouped.map(renderActivityButton)}</div>
        </div>
      );
    return sections.length > 0 ? <div>{sections}</div> : <p className={styles.actAllAuthorized}>כל סוגי הפעילות מורשים כבר</p>;
  }

  return (
    <div className={styles.authModalContent}>
      <div className={styles.authNote}>
        <p className={styles.authNotePreview}>
          הרשאות פעילות קובעות לאילו סוגי עבודה העובד מוסמך והן משפיעות על <strong>הצעות השיבוץ האוטומטי</strong>.{' '}
          {!noteOpen && (
            <button type="button" className={styles.authNoteMore} onClick={() => setNoteOpen(true)}>קרא עוד ▼</button>
          )}
        </p>
        {noteOpen && (
          <>
            <p>רק עובדים עם הרשאה מתאימה יוצעו לפעילות נתונה. עובד ברמת קושי גבוהה יותר יוצע תחילה; במקרה חוסר, עובד ברמה גבוהה עשוי לשמש גם ברמות נמוכות יותר (overqualified) אך בעדיפות נמוכה.</p>
            <p>הרשאה בקבוצת <strong>תורנים</strong> מאפשרת לעובד להגיש בקשת משמרת תורנות. הרשאה בקבוצת <strong>כוננים</strong> — משמרת כוננות.</p>
            <p><strong>עדיפות שיבוץ (1–5):</strong> קובעת את הנטייה לשבץ את העובד לפעילות זו ביחס לפעילויות אחרות שהוא מורשה להן. ערך <strong>5</strong> — פריוריטי גבוה לפעילות זו; ערך <strong>1</strong> — יוצע רק אם אין מתאימים אחרים. ברירת מחדל: <strong>3</strong>. הסקאלה משפיעה על ההסתברות — לא על הזכאות עצמה.</p>
            <button type="button" className={styles.authNoteMore} onClick={() => setNoteOpen(false)}>סגור ▲</button>
          </>
        )}
      </div>
      {loading ? <p>טוען...</p> : (
        <>
          <div className={styles.authSection}>
            <h4 className={styles.authSectionTitle}>מורשה עבור:</h4>
            {authorizations.length === 0 ? <p className={styles.authEmpty}>—</p> : (
              <div className={styles.authList}>
                {authorizations.map(auth => (
                  <div key={auth.activity_type_id} className={styles.authItem}>
                    <span>{auth.name}</span>
                    <div className={styles.authItemControls}>
                      <div className={styles.prioritySliderWrap} title="עדיפות שיבוץ: 1=נמוכה, 5=גבוהה">
                        <input
                          type="range"
                          min="1" max="5" step="1"
                          value={auth.priority ?? 3}
                          onChange={e => updatePriority(auth.activity_type_id, e.target.value)}
                          className={styles.prioritySlider}
                        />
                        <div className={styles.priorityTicks}>
                          {[1,2,3,4,5].map(n => (
                            <span key={n} className={(auth.priority ?? 3) === n ? styles.priorityTickActive : styles.priorityTick}>{n}</span>
                          ))}
                        </div>
                      </div>
                      <button type="button" className={`btn-remove ${styles.authRemoveBtn}`} onClick={() => removeAuthorization(auth.activity_type_id)}>✕</button>
                    </div>
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
  );
}

export function WorkerActivityAuthorizations({ worker, authToken, config, onClose }) {
  const { modalRef, dragHandleProps, modalStyle, overlayClass, reset } = useDraggableModal();
  const close = () => { onClose(); reset(); };
  return (
    <div className={overlayClass} onClick={close}>
      <div className="detail-modal" ref={modalRef} style={{ maxWidth: '500px', ...modalStyle }} onClick={e => e.stopPropagation()}>
        <div className="settings-header" {...dragHandleProps}>
          <h2>הרשאות לפעילויות — {worker.family_name} {worker.first_name}</h2>
          <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={close}>✕</button>
        </div>
        <WorkerAuthorizationsPanel worker={worker} authToken={authToken} config={config} />
        <div className="form-actions">
          <button className="btn-primary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}

function WorkerDetail({ worker, onClose, onEdit, authToken, config, isSuperAdmin, roles = [], canEdit }) {
  const { modalRef: detailRef, dragHandleProps: detailDrag, modalStyle: detailStyle, overlayClass: detailOverlay, reset: detailReset } = useDraggableModal();
  const independentTypeIds = new Set(
    (config.employment_types || []).filter(t => t.is_independent).map(t => t.id)
  );
  const roleDisplay = roles.length > 0
    ? (roles.find(r => r.name === worker.classification)?.display_name || worker.classification)
    : (worker.classification === 'admin' ? 'מנהל' : worker.classification === 'superadmin' ? 'מנהל ראשי' : 'משתמש');
  const isAdmin = worker.classification === 'admin' || worker.classification === 'superadmin';

  const [photoUrl, setPhotoUrl] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fetchedId = useRef(null);

  useEffect(() => {
    if (fetchedId.current === worker.id) return;
    fetchedId.current = worker.id;
    fetch(`/api/workers/${worker.id}`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.photo_url) setPhotoUrl(d.photo_url); });
  }, [worker.id, authToken]);

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setCropSrc(URL.createObjectURL(file));
  }

  async function handleCropConfirm(base64) {
    setCropSrc(null);
    const res = await fetch(`/api/workers/${worker.id}/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ photo_data: base64 }),
    });
    if (res.ok) {
      const data = await res.json();
      setPhotoUrl(data.photo_url);
    }
  }

  function formatDate(val) {
    if (!val) return '—';
    const s = val.slice(0, 10);
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }

  const closeDetail = () => { onClose(); detailReset(); };
  return (
    <div className={detailOverlay} onClick={closeDetail}>
      <div className="detail-modal" ref={detailRef} style={detailStyle} onClick={e => e.stopPropagation()}>
        <div className="settings-header" {...detailDrag}>
          <h2>{worker.title} {worker.family_name} {worker.first_name}</h2>
          <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={closeDetail}>✕</button>
        </div>
        <div className={styles.detailPhotoWrap}>
          {photoUrl
            ? <img src={resolvePhotoUrl(photoUrl)} alt="" className={styles.detailPhoto} />
            : <div className={styles.detailPhotoPlaceholder}>{(worker.first_name?.[0] || '?').toUpperCase()}</div>
          }
          {(isSuperAdmin || worker.is_primary_branch !== false) && canEdit && (
            <>
              <div className={styles.photoActions}>
                <button type="button" className={styles.changePhotoLink} onClick={() => fileInputRef.current?.click()}>
                  החלף תמונה
                </button>
                <button type="button" className={styles.cameraBtn} onClick={() => cameraInputRef.current?.click()} title="צלם תמונה">📷</button>
                {photoUrl && (
                  <button type="button" className={styles.changePhotoLink} onClick={() => setCropSrc(photoUrl)}>
                    ערוך תמונה
                  </button>
                )}
                {photoUrl && (
                  <button type="button" className={styles.deletePhotoLink} onClick={async () => {
                    if (!window.confirm('למחוק את תמונת הפרופיל?')) return;
                    const res = await fetch(`/api/workers/${worker.id}/photo`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${authToken}` },
                    });
                    if (res.ok) setPhotoUrl(null);
                  }}>
                    מחק תמונה
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="user" hidden onChange={handleFileSelect} />
            </>
          )}
        </div>
        {cropSrc && (
          <PhotoCropModal imageUrl={cropSrc} onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />
        )}
        <div className="detail-grid">
          <div className="detail-row">
            <span className="detail-label">תעודת זהות</span>
            <span className="detail-value">{worker.id_number || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">תאריך לידה</span>
            <span className="detail-value">{formatDate(worker.birth_date)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">סיווג</span>
            <span className="detail-value">
              <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-normal'}`}>
                {roleDisplay}
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
            <span className="detail-label">אימייל ארגוני</span>
            <span className="detail-value">{worker.email || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">אימייל אישי</span>
            <span className="detail-value">{worker.personal_email || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">סניף ראשי</span>
            <span className="detail-value">{worker.primary_branch_name || '—'}</span>
          </div>
          <div className="detail-row detail-row-full">
            <span className="detail-label">הערות</span>
            <span className="detail-value">{worker.notes || '—'}</span>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>סגור</button>
          {(isSuperAdmin || worker.is_primary_branch !== false) && canEdit && (
            <button className="btn-primary" onClick={() => { onClose(); onEdit(worker); }}>עריכה</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkerList({ workers, onEdit, onEditAuth, onDelete, onResetPassword, authToken, config, isSuperAdmin, currentBranchId, isAdmin, roles = [], onOpenMessage, currentUserRole, columnPrefs, fontSize = 1 }) {
  const hiddenCols = new Set(columnPrefs?.hidden_columns || []);
  const colOrder = (columnPrefs?.column_order || DEFAULT_COLUMN_ORDER).filter(c => !hiddenCols.has(c));
  const nameFormat = columnPrefs?.name_format || DEFAULT_NAME_FORMAT;

  function getWorkerName(w) {
    switch (nameFormat) {
      case 'first_family': return `${w.first_name || ''} ${w.family_name || ''}`.trim();
      case 'family_only':  return w.family_name || '';
      case 'first_only':   return w.first_name || '';
      default:             return `${w.family_name || ''} ${w.first_name || ''}`.trim();
    }
  }

  function nameSortField() {
    switch (nameFormat) {
      case 'first_family':
      case 'first_only': return 'first_name';
      default:           return 'family_name';
    }
  }
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

  function canEditWorker(w) {
    if (currentUserRole === 'master') return true;
    const myRole = roles.find(r => r.name === currentUserRole);
    if (!myRole) return true;
    const levelA = roles.find(r => r.name === w.user_role)?.level ?? 999;
    const levelB = roles.find(r => r.name === w.classification)?.level ?? 999;
    const workerLevel = Math.min(levelA, levelB);
    return myRole.level < workerLevel;
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
      roles={roles}
      canEdit={canEditWorker(viewing)}
    />
  );

  const fontStyle = { fontSize: `${fontSize}rem` };

  if (isMobile) {
    return (
      <>
        {detailModal}
        <div className="worker-card-list" style={fontStyle}>
          {sorted.map(w => (
            <div key={w.id} className={`worker-card${w.is_active === false ? ' worker-card-inactive' : ''}`}>
              <div className="worker-card-info">
                <span className="worker-card-name">
                  {w.title} {getWorkerName(w)}
                </span>
                <span className="worker-card-id">{w.id_number || '—'}</span>
                {w.phone && <a href={waLink(w.phone)} target="_blank" rel="noreferrer" className={styles.waLink}>{w.phone}</a>}
                {w.email && (
                  <a href={`mailto:${w.email}`}>{w.email}</a>
                )}
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
                    {canEditWorker(w) && <button onClick={() => onEditAuth(w)} className="btn-auth" title="הרשאות">🔑</button>}
                    {canEditWorker(w) && <button onClick={() => onEdit(w)} className="btn-edit" title="עריכה">✏️</button>}
                    <button onClick={() => {
                      if (window.confirm(`לאפס סיסמא של ${w.family_name} ${w.first_name}?`)) {
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
    const landscapeCols = colOrder.filter(c => ['title', 'name', 'phone', 'email'].includes(c));
    return (
      <>
        {detailModal}
        <div className="worker-table-wrap" style={fontStyle}>
        <table className="worker-table">
          <thead>
            <tr>
              {landscapeCols.map(colId => renderColHeader(colId))}
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(w => (
              <tr key={w.id} className={w.is_active === false ? 'worker-row-inactive' : ''}>
                {landscapeCols.map(colId => renderColCell(colId, w))}
                <td>
                  <button onClick={() => setViewing(w)} className="btn-view" title="צפייה">👁</button>
                  {(isSuperAdmin || w.is_primary_branch !== false) && (
                    <>
                      {canEditWorker(w) && <button onClick={() => onEditAuth(w)} className="btn-auth" title="הרשאות">🔑</button>}
                      {canEditWorker(w) && <button onClick={() => onEdit(w)} className="btn-edit" title="עריכה">✏️</button>}
                      <button onClick={() => {
                        if (window.confirm(`לאפס סיסמא של ${w.family_name} ${w.first_name}?`)) {
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

  function renderColHeader(colId) {
    switch (colId) {
      case 'title':           return <SortTh key={colId} field="title">{COLUMN_LABELS.title}</SortTh>;
      case 'name':            return <SortTh key={colId} field={nameSortField()}>{COLUMN_LABELS.name}</SortTh>;
      case 'id_number':       return <SortTh key={colId} field="id_number">{COLUMN_LABELS.id_number}</SortTh>;
      case 'classification':  return <SortTh key={colId} field="classification">{COLUMN_LABELS.classification}</SortTh>;
      case 'job':             return <SortTh key={colId} field="job">{COLUMN_LABELS.job}</SortTh>;
      case 'employment_type': return <SortTh key={colId} field="employment_type">{COLUMN_LABELS.employment_type}</SortTh>;
      case 'phone':           return <th key={colId}>{COLUMN_LABELS.phone}</th>;
      case 'email':           return <SortTh key={colId} field="email">{COLUMN_LABELS.email}</SortTh>;
      case 'personal_email':  return <SortTh key={colId} field="personal_email">{COLUMN_LABELS.personal_email}</SortTh>;
      default:                return null;
    }
  }

  function renderColCell(colId, w) {
    const msgProps = w.user_id && onOpenMessage
      ? { onDoubleClick: () => onOpenMessage(w.user_id), title: 'לחץ פעמיים לפתיחת הודעות', className: styles.clickableCell }
      : {};
    switch (colId) {
      case 'title':
        return <td key={colId}>{w.title}</td>;
      case 'name':
        return (
          <td key={colId} {...msgProps}>
            <strong>{getWorkerName(w)}</strong>
            {w.is_active === false && <span className={`badge badge-inactive ${styles.badgeMargin}`}>לא פעיל</span>}
            {currentBranchId && w.primary_branch_id && w.primary_branch_id !== currentBranchId && (
              <span className={`badge badge-normal ${styles.borrowedBadge}`} title={`סניף ראשי: ${w.primary_branch_name}`}>מושאל</span>
            )}
          </td>
        );
      case 'id_number':
        return <td key={colId} {...msgProps}>{w.id_number || '—'}</td>;
      case 'classification':
        return (
          <td key={colId}>
            <span className={`badge ${isAdminRole(w.classification) ? 'badge-admin' : 'badge-normal'}`}>
              {getRoleLabel(w.classification)}
            </span>
          </td>
        );
      case 'job':
        return <td key={colId}>{w.job}</td>;
      case 'employment_type':
        return (
          <td key={colId}>
            <span className={`badge ${independentTypeIds.has(w.employment_type_id) ? 'badge-self' : 'badge-normal'}`}>
              {w.employment_type}
            </span>
          </td>
        );
      case 'phone':
        return <td key={colId}>{w.phone ? <a href={waLink(w.phone)} target="_blank" rel="noreferrer" className={styles.waLink}>{w.phone}</a> : '—'}</td>;
      case 'email':
        return <td key={colId}>{w.email ? <a href={`mailto:${w.email}`}>{w.email}</a> : '—'}</td>;
      case 'personal_email':
        return <td key={colId}>{w.personal_email ? <a href={`mailto:${w.personal_email}`}>{w.personal_email}</a> : '—'}</td>;
      default:
        return null;
    }
  }

  return (
    <>
      {detailModal}
      <div className="worker-table-wrap" style={fontStyle}>
      <table className="worker-table">
        <thead>
          <tr>
            {colOrder.map(colId => renderColHeader(colId))}
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(w => (
            <tr key={w.id} className={w.is_active === false ? 'worker-row-inactive' : ''}>
              {colOrder.map(colId => renderColCell(colId, w))}
              <td>
                <button onClick={() => setViewing(w)} className="btn-view" title="צפייה">👁</button>
                {(isSuperAdmin || w.is_primary_branch !== false) && (
                  <>
                    {canEditWorker(w) && <button onClick={() => onEditAuth(w)} className="btn-auth" title="הרשאות">🔑</button>}
                    {canEditWorker(w) && <button onClick={() => onEdit(w)} className="btn-edit" title="עריכה">✏️</button>}
                    <button onClick={() => {
                      if (window.confirm(`לאפס סיסמא של ${w.family_name} ${w.first_name}?`)) {
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
