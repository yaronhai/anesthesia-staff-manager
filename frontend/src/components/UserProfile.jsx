import { useState, useEffect, useRef } from 'react';
import styles from '../styles/UserProfile.module.scss';

const STATUS_LABEL = {
  pending:  { label: 'ממתין לאישור', color: '#d97706' },
  approved: { label: 'אושר',         color: '#16a34a' },
  rejected: { label: 'נדחה',          color: '#dc2626' },
};

function formatDate(d) {
  if (!d) return '';
  const s = d.slice(0, 10);
  const [y, m, dd] = s.split('-');
  return `${dd}.${m}.${y}`;
}

export default function UserProfile({ authToken, currentUser, config, onClose, onPhotoUpdate, inline = false }) {
  const honorifics = config?.honorifics || [];

  const [profile, setProfile]           = useState(null);
  const [pendingRequest, setPending]     = useState(null);
  const [editMode, setEditMode]          = useState(false);
  const [form, setForm]                  = useState({});
  const [saving, setSaving]              = useState(false);
  const [error, setError]                = useState('');
  const [success, setSuccess]            = useState('');
  const [photoUploading, setPhotoUp]     = useState(false);
  const fileInputRef = useRef(null);

  const headers = () => ({ Authorization: `Bearer ${authToken}` });

  async function load() {
    const res = await fetch('/api/profile', { headers: headers() });
    if (res.ok) {
      const data = await res.json();
      setProfile(data.worker);
      setPending(data.pendingRequest);
      setForm({
        honorific_id:   data.worker.honorific_id ?? '',
        first_name:     data.worker.first_name   ?? '',
        family_name:    data.worker.family_name  ?? '',
        phone:          data.worker.phone        ?? '',
        personal_email: data.worker.personal_email ?? '',
        birth_date:     data.worker.birth_date ? data.worker.birth_date.slice(0, 10) : '',
      });
    }
  }

  useEffect(() => { load(); }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    const res = await fetch('/api/profile/change-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({
        honorific_id:   form.honorific_id   || null,
        first_name:     form.first_name     || null,
        family_name:    form.family_name    || null,
        phone:          form.phone          || null,
        personal_email: form.personal_email || null,
        birth_date:     form.birth_date     || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSuccess('בקשתך נשלחה לאישור המנהל');
      setEditMode(false);
      load();
    } else {
      const d = await res.json();
      setError(d.error || 'שגיאה בשמירה');
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUp(true);
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch('/api/profile/photo', {
      method: 'POST',
      headers: headers(),
      body: fd,
    });
    setPhotoUp(false);
    if (res.ok) {
      const d = await res.json();
      setProfile(p => ({ ...p, photo_url: d.photo_url }));
      if (onPhotoUpdate) onPhotoUpdate(d.photo_url);
    } else {
      setError('שגיאה בהעלאת תמונה');
    }
  }

  if (!profile) return <div className={styles.loading}>טוען...</div>;

  const displayName = [profile.honorific_name, profile.first_name, profile.family_name].filter(Boolean).join(' ');

  const content = (
    <div className={inline ? styles.inlineWrap : styles.modal} dir="rtl">
      {!inline && (
        <div className={styles.header}>
          <h2 className={styles.title}>הפרופיל שלי</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
      )}

        {/* Photo section */}
        <div className={styles.photoSection}>
          <div className={styles.avatarWrap}>
            {profile.photo_url
              ? <img src={profile.photo_url} alt="תמונת פרופיל" className={styles.avatar} />
              : <div className={styles.avatarPlaceholder}>{(profile.first_name?.[0] || '?').toUpperCase()}</div>
            }
            <button
              className={styles.changePhotoBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              title="החלף תמונה"
            >
              {photoUploading ? '⏳' : '📷'}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handlePhoto} />
          <div className={styles.displayName}>{displayName}</div>
          <div className={styles.usernameLine}>שם משתמש: {currentUser?.username}</div>
        </div>

        {/* Pending request banner */}
        {pendingRequest && (
          <div className={styles.pendingBanner} style={{ borderColor: STATUS_LABEL[pendingRequest.status]?.color }}>
            <span className={styles.pendingBadge} style={{ background: STATUS_LABEL[pendingRequest.status]?.color }}>
              {STATUS_LABEL[pendingRequest.status]?.label}
            </span>
            <span className={styles.pendingText}>
              בקשה לעדכון פרטים מ-{formatDate(pendingRequest.created_at)}
              {pendingRequest.status === 'rejected' && pendingRequest.admin_notes && ` — ${pendingRequest.admin_notes}`}
            </span>
          </div>
        )}

        {/* Messages */}
        {error   && <div className={styles.errorMsg}>{error}</div>}
        {success && <div className={styles.successMsg}>{success}</div>}

        {!editMode ? (
          <div className={styles.viewSection}>
            <table className={styles.infoTable}>
              <tbody>
                <tr><td className={styles.lbl}>כינוי</td><td>{profile.honorific_name || '—'}</td></tr>
                <tr><td className={styles.lbl}>שם פרטי</td><td>{profile.first_name || '—'}</td></tr>
                <tr><td className={styles.lbl}>שם משפחה</td><td>{profile.family_name || '—'}</td></tr>
                <tr><td className={styles.lbl}>טלפון</td><td>{profile.phone || '—'}</td></tr>
                <tr><td className={styles.lbl}>אימייל אישי</td><td>{profile.personal_email || '—'}</td></tr>
                <tr><td className={styles.lbl}>תאריך לידה</td><td>{formatDate(profile.birth_date) || '—'}</td></tr>
              </tbody>
            </table>
            {!pendingRequest?.status || pendingRequest.status !== 'pending' ? (
              <button className={`btn btn-primary ${styles.editBtn}`} onClick={() => { setEditMode(true); setError(''); setSuccess(''); }}>
                ערוך פרטים
              </button>
            ) : null}
          </div>
        ) : (
          <form className={styles.editForm} onSubmit={handleSubmit}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>כינוי</label>
              <select name="honorific_id" value={form.honorific_id} onChange={handleChange} className={styles.input}>
                <option value="">ללא</option>
                {honorifics.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>שם פרטי</label>
              <input name="first_name" value={form.first_name} onChange={handleChange} className={styles.input} required />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>שם משפחה</label>
              <input name="family_name" value={form.family_name} onChange={handleChange} className={styles.input} required />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>טלפון</label>
              <input name="phone" value={form.phone} onChange={handleChange} className={styles.input} type="tel" dir="ltr" />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>אימייל אישי</label>
              <input name="personal_email" value={form.personal_email} onChange={handleChange} className={styles.input} type="email" dir="ltr" />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>תאריך לידה</label>
              <input name="birth_date" value={form.birth_date} onChange={handleChange} className={styles.input} type="date" />
            </div>
            <div className={styles.formNote}>
              הבקשה תישלח למנהל לאישור — הפרטים יתעדכנו רק לאחר אישורו.
            </div>
            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'שולח...' : 'שלח לאישור'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)}>ביטול</button>
            </div>
          </form>
        )}
    </div>
  );

  if (inline) return content;
  return <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>{content}</div>;
}
