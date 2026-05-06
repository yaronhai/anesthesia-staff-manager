import { useState, useEffect } from 'react';
import styles from '../styles/ProfileChangeRequests.module.scss';

const STATUS_LABEL = {
  pending:  { label: 'ממתין',  color: '#d97706' },
  approved: { label: 'אושר',   color: '#16a34a' },
  rejected: { label: 'נדחה',   color: '#dc2626' },
};

function formatDate(d) {
  if (!d) return '';
  const s = d.slice(0, 10);
  const [y, m, dd] = s.split('-');
  return `${dd}.${m}.${y}`;
}

function FieldDiff({ label, current, requested }) {
  if (requested === null || requested === undefined) return null;
  const changed = String(current ?? '') !== String(requested ?? '');
  return (
    <tr className={changed ? styles.changedRow : ''}>
      <td className={styles.diffLabel}>{label}</td>
      <td className={styles.diffCurrent}>{current || '—'}</td>
      <td className={styles.diffArrow}>←</td>
      <td className={styles.diffRequested}>{requested || '—'}</td>
    </tr>
  );
}

export default function ProfileChangeRequests({ authToken, onDecision }) {
  const [requests, setRequests]  = useState([]);
  const [filter, setFilter]      = useState('pending');
  const [decisionModal, setModal] = useState(null);
  const [adminNotes, setNotes]   = useState('');
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState('');

  const headers = () => ({ Authorization: `Bearer ${authToken}` });

  async function load(status = filter) {
    const res = await fetch(`/api/profile/change-requests?status=${status}`, { headers: headers() });
    if (res.ok) setRequests(await res.json());
  }

  useEffect(() => { load(filter); }, [filter]);

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
          {requests.map(r => (
            <div key={r.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardName}>
                  {r.current_first_name} {r.current_family_name}
                </div>
                <div className={styles.cardMeta}>
                  <span
                    className={styles.statusBadge}
                    style={{ background: STATUS_LABEL[r.status]?.color }}
                  >
                    {STATUS_LABEL[r.status]?.label}
                  </span>
                  <span className={styles.dateText}>{formatDate(r.created_at)}</span>
                </div>
              </div>

              <table className={styles.diffTable}>
                <thead>
                  <tr>
                    <th>שדה</th>
                    <th>נוכחי</th>
                    <th></th>
                    <th className={styles.reqHead}>מבוקש</th>
                  </tr>
                </thead>
                <tbody>
                  <FieldDiff label="שם פרטי"    current={r.current_first_name}      requested={r.first_name} />
                  <FieldDiff label="שם משפחה"   current={r.current_family_name}     requested={r.family_name} />
                  <FieldDiff label="טלפון"       current={r.current_phone}           requested={r.phone} />
                  <FieldDiff label="אימייל אישי" current={r.current_personal_email}  requested={r.personal_email} />
                  <FieldDiff label="תאריך לידה"  current={formatDate(r.current_birth_date)} requested={r.birth_date ? formatDate(r.birth_date) : null} />
                </tbody>
              </table>

              {r.admin_notes && (
                <div className={styles.adminNotes}>הערת מנהל: {r.admin_notes}</div>
              )}

              {r.status === 'pending' && (
                <div className={styles.cardActions}>
                  <button className="btn btn-sm btn-primary" onClick={() => { setModal(r); setNotes(''); setError(''); }}>
                    קבל החלטה
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {decisionModal && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className={styles.decisionModal}>
            <div className={styles.decisionHeader}>
              <h4 style={{ margin: 0 }}>החלטה עבור {decisionModal.current_first_name} {decisionModal.current_family_name}</h4>
              <button className={styles.closeBtn} onClick={() => setModal(null)}>✕</button>
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
