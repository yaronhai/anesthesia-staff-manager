import { useState, useEffect } from 'react';
import styles from '../styles/ProfileChangeRequests.module.scss';
import { useDraggableModal } from '../hooks/useDraggableModal';

const STATUS_LABEL = {
  pending:  { label: 'ממתין',  color: '#d97706' },
  approved: { label: 'אושר',   color: '#16a34a' },
  rejected: { label: 'נדחה',   color: '#dc2626' },
};

const FIELD_LABELS = {
  first_name:     'שם פרטי',
  family_name:    'שם משפחה',
  phone:          'טלפון',
  personal_email: 'אימייל אישי',
  birth_date:     'תאריך לידה',
  honorific_id:   'תואר',
};

function formatDate(d) {
  if (!d) return '';
  const s = d.slice(0, 10);
  const [y, m, dd] = s.split('-');
  return `${dd}/${m.padStart(2, '0')}/${y}`;
}

function getChangedFields(r) {
  const diff = (requested, orig) =>
    requested !== null && requested !== undefined &&
    String(requested ?? '') !== String(orig ?? '');
  const fields = [];
  if (diff(r.first_name,     r.orig_first_name))     fields.push('שם פרטי');
  if (diff(r.family_name,    r.orig_family_name))    fields.push('שם משפחה');
  if (diff(r.phone,          r.orig_phone))          fields.push('טלפון');
  if (diff(r.personal_email, r.orig_personal_email)) fields.push('אימייל אישי');
  if (diff(r.birth_date,     r.orig_birth_date))     fields.push('תאריך לידה');
  if (diff(r.honorific_id,   r.orig_honorific_id))   fields.push('תואר');
  return fields;
}

function FieldDiff({ label, orig, requested }) {
  if (requested === null || requested === undefined) return null;
  if (String(requested ?? '') === String(orig ?? '')) return null;
  return (
    <tr className={styles.changedRow}>
      <td className={styles.diffLabel}>{label}</td>
      <td className={styles.diffCurrent}>{orig || '—'}</td>
      <td className={styles.diffArrow}>←</td>
      <td className={styles.diffRequested}>{requested || '—'}</td>
    </tr>
  );
}

export default function ProfileChangeRequests({ authToken, branchId, isSuperAdmin, onDecision }) {
  const { modalRef, dragHandleProps, modalStyle, dragged, reset } = useDraggableModal();
  const [requests, setRequests]  = useState([]);
  const [filter, setFilter]      = useState('pending');
  const [expandedId, setExpandedId] = useState(null);
  const [decisionModal, setModal] = useState(null);
  const [adminNotes, setNotes]   = useState('');
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState('');

  const headers = () => ({ Authorization: `Bearer ${authToken}` });

  async function load(status = filter) {
    const params = new URLSearchParams({ status });
    if (branchId) params.set('branch_id', branchId);
    const res = await fetch(`/api/profile/change-requests?${params}`, { headers: headers() });
    if (res.ok) setRequests(await res.json());
  }

  useEffect(() => { load(filter); }, [filter, branchId]);

  async function handleDelete(id) {
    if (!window.confirm('למחוק בקשה זו לצמיתות?')) return;
    const res = await fetch(`/api/profile/change-requests/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (res.ok) load(filter);
  }

  async function handleDecision(decision) {
    setSaving(true); setError('');
    const res = await fetch(`/api/profile/change-requests/${decisionModal.id}/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ decision, admin_notes: adminNotes }),
    });
    setSaving(false);
    if (res.ok) {
      setModal(null); setNotes('');
      load(filter);
      if (onDecision) onDecision();
    } else {
      const d = await res.json();
      setError(d.error || 'שגיאה');
    }
  }

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.topBar}>
        <h3 className={styles.heading}>בקשות עדכון פרטים אישיים</h3>
        <div className={styles.filterGroup}>
          {['pending', 'approved', 'rejected', 'all'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(s)}
            >
              {s === 'pending' ? 'ממתינות' : s === 'approved' ? 'אושרו' : s === 'rejected' ? 'נדחו' : 'הכל'}
            </button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <div className={styles.empty}>אין בקשות</div>
      ) : (
        <div className={styles.list}>
          {requests.map(r => {
            const changedFields = getChangedFields(r);
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className={styles.card}>
                <div
                  className={styles.row}
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <span className={styles.rowName}>
                    {r.current_family_name} {r.current_first_name}
                  </span>
                  <span className={styles.rowFields}>
                    {changedFields.length > 0 ? changedFields.join(', ') : 'ללא שינוי'}
                  </span>
                  <span className={styles.rowDate}>{formatDate(r.created_at)}</span>
                  <span
                    className={styles.statusBadge}
                    style={{ background: STATUS_LABEL[r.status]?.color }}
                  >
                    {STATUS_LABEL[r.status]?.label}
                  </span>
                  {r.status === 'pending' && (
                    <button
                      className={`btn btn-sm btn-primary ${styles.rowBtn}`}
                      onClick={e => { e.stopPropagation(); setModal(r); setNotes(''); setError(''); }}
                    >
                      החלטה
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      className={styles.deleteBtn}
                      title="מחק בקשה"
                      onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                    >🗑</button>
                  )}
                  <span className={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div className={styles.expandedBody}>
                    <table className={styles.diffTable}>
                      <tbody>
                        <FieldDiff label="שם פרטי"    orig={r.orig_first_name}                   requested={r.first_name} />
                        <FieldDiff label="שם משפחה"   orig={r.orig_family_name}                  requested={r.family_name} />
                        <FieldDiff label="טלפון"       orig={r.orig_phone}                        requested={r.phone} />
                        <FieldDiff label="אימייל אישי" orig={r.orig_personal_email}               requested={r.personal_email} />
                        <FieldDiff label="תאריך לידה"  orig={formatDate(r.orig_birth_date)}       requested={r.birth_date ? formatDate(r.birth_date) : null} />
                      </tbody>
                    </table>
                    {r.admin_notes && (
                      <div className={styles.adminNotes}>הערת מנהל: {r.admin_notes}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {decisionModal && (
        <div className={`${styles.overlay}${dragged ? ' form-overlay--transparent' : ''}`} onClick={e => e.target === e.currentTarget && (setModal(null), reset())}>
          <div className={styles.decisionModal} ref={modalRef} style={modalStyle}>
            <div className={styles.decisionHeader} {...dragHandleProps}>
              <h4 style={{ margin: 0 }}>החלטה עבור {decisionModal.current_family_name} {decisionModal.current_first_name}</h4>
              <button className={styles.closeBtn} onMouseDown={e => e.stopPropagation()} onClick={() => { setModal(null); reset(); }}>✕</button>
            </div>
            {error && <div className={styles.errorMsg}>{error}</div>}
            <label className={styles.notesLabel}>הערת מנהל (אופציונלי)</label>
            <textarea
              className={styles.notesInput}
              value={adminNotes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="הוסף הערה..."
            />
            <div className={styles.decisionBtns}>
              <button className="btn btn-success" onClick={() => handleDecision('approved')} disabled={saving}>
                {saving ? '...' : '✓ אשר'}
              </button>
              <button className="btn btn-danger" onClick={() => handleDecision('rejected')} disabled={saving}>
                {saving ? '...' : '✕ דחה'}
              </button>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
