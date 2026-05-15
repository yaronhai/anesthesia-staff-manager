import { useState, useEffect } from 'react';
import styles from '../styles/WorkerForm.module.scss';
import PhotoCropModal from './PhotoCropModal';
import { WorkerAuthorizationsPanel } from './WorkerList';
const UPLOADS_BASE = import.meta.env.DEV ? 'http://localhost:5001' : '';

const HE_TO_EN = { א:'a',ב:'b',ג:'g',ד:'d',ה:'h',ו:'v',ז:'z',ח:'ch',ט:'t',י:'y',כ:'k',ך:'k',ל:'l',מ:'m',ם:'m',נ:'n',ן:'n',ס:'s',ע:'a',פ:'p',ף:'f',צ:'tz',ץ:'tz',ק:'k',ר:'r',ש:'sh',ת:'t' };
function hebrewToEnglish(str) {
  return (str || '').split('').map(c => HE_TO_EN[c] ?? (c === ' ' ? '' : c)).join('').toLowerCase().replace(/[^a-z0-9.\-]/g, '');
}
const resolvePhotoUrl = url => !url ? null : url.startsWith('data:') ? url : UPLOADS_BASE + url;

const TABS = [
  { key: 'personal', label: 'פרטים אישיים' },
  { key: 'org', label: 'פרטים ארגוניים' },
  { key: 'branches', label: 'שיוך לסניפים' },
  { key: 'authorizations', label: 'הרשאות פעילות' },
];

export default function WorkerForm({ initial, config, onSave, onCancel, isSuperAdmin, authToken, branches = [], roles = [], currentUser = null, defaultBranchId, initialTab = 'personal', onPhotoUpdate }) {
  const jobs = config?.jobs || [];
  const empTypes = config?.employment_types || [];
  const honorifics = config?.honorifics || [];
  const isSelfEdit = initial?.id && currentUser?.worker_id && initial.id === currentUser.worker_id;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [form, setForm] = useState({
    honorific_id: honorifics[0]?.id || '',
    first_name: '',
    family_name: '',
    job_id: jobs[0]?.id || '',
    employment_type_id: empTypes[0]?.id || '',
    phone: '',
    email: '',
    personal_email: '',
    birth_date: '',
    notes: '',
    id_number: '',
    classification: 'user',
    is_active: true,
    primary_branch_id: '',
    can_submit_requests: true,
    ...initial,
  });
  const [saveError, setSaveError] = useState('');
  const [workerBranches, setWorkerBranches] = useState([]);
  const [primaryBranchId, setPrimaryBranchId] = useState(defaultBranchId || '');
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url || null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

  useEffect(() => {
    if (isSuperAdmin && initial?.id) {
      fetch(`/api/workers/${initial.id}/branches`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }).then(r => r.ok ? r.json() : []).then(setWorkerBranches);
    }
  }, [initial?.id, isSuperAdmin, authToken]);

  function handleChange(e) {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    if (name === 'primary_branch_id' && value && initial?.id) {
      const bid = parseInt(value);
      if (!workerBranches.find(wb => wb.branch_id === bid)) addBranch(bid);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError('');

    const missing = [];
    if (!form.family_name?.trim()) missing.push('שם משפחה');
    if (!form.first_name?.trim()) missing.push('שם פרטי');
    if (!form.id_number?.trim()) missing.push('תעודת זהות');
    else if (!/^\d{9}$/.test(form.id_number.trim())) { setSaveError('תעודת זהות חייבת להכיל בדיוק 9 ספרות'); setActiveTab('personal'); return; }
    if (!form.email?.trim()) missing.push('אימייל ארגוני');
    if (!initial?.id) {
      if (!form.job_id) missing.push('תפקיד');
      if (isSuperAdmin && !primaryBranchId) missing.push('סניף ראשי');
    }
    if (missing.length > 0) {
      const hasPersonal = missing.some(f => ['שם משפחה','שם פרטי','תעודת זהות'].includes(f));
      const hasOrg = missing.some(f => ['אימייל ארגוני','תפקיד','סניף ראשי'].includes(f));
      setActiveTab(hasPersonal ? 'personal' : 'org');
      setSaveError('שדות חובה חסרים: ' + missing.join(', '));
      return;
    }

    const payload = initial?.id ? form : { ...form, branch_ids: primaryBranchId ? [parseInt(primaryBranchId)] : [] };
    const err = await onSave(payload);
    if (err) setSaveError(err);
  }

  async function addBranch(branchId) {
    const res = await fetch(`/api/workers/${initial.id}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ branch_id: parseInt(branchId) }),
    });
    if (res.ok) setWorkerBranches(await res.json());
    else { const e = await res.json(); alert(e.error || 'שגיאה'); }
  }

  async function toggleBranchActive(branchId, isActive) {
    const res = await fetch(`/api/workers/${initial.id}/branches/${branchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (res.ok) setWorkerBranches(await res.json());
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file || !initial?.id) return;
    e.target.value = '';
    const url = URL.createObjectURL(file);
    setCropSrc(url);
  }

  async function handleCropConfirm(base64) {
    setCropSrc(null);
    setPhotoUploading(true);
    try {
      const res = await fetch(`/api/workers/${initial.id}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ photo_data: base64 }),
      });
      setPhotoUploading(false);
      if (res.ok) {
        const data = await res.json();
        setPhotoUrl(data.photo_url);
        onPhotoUpdate?.(data.photo_url);
      } else {
        const err = await res.json();
        alert(err.error || 'שגיאה בהעלאת תמונה');
      }
    } catch {
      setPhotoUploading(false);
      alert('שגיאה בהעלאת תמונה');
    }
  }

  function handleCropCancel() {
    setCropSrc(null);
  }

  async function handlePhotoDelete() {
    if (!initial?.id) return;
    const res = await fetch(`/api/workers/${initial.id}/photo`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) { setPhotoUrl(null); onPhotoUpdate?.(null); }
  }

  async function removeBranch(branchId) {
    const res = await fetch(`/api/workers/${initial.id}/branches/${branchId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) setWorkerBranches(await res.json().catch(() => []));
    else setWorkerBranches(workerBranches.filter(b => b.branch_id !== branchId));
  }

  const unassignedBranches = branches.filter(b => !workerBranches.find(wb => wb.branch_id === b.id));

  const visibleTabs = TABS.filter(t => {
    if (t.key === 'branches') return isSuperAdmin;
    return true;
  });

  return (
    <div className="form-overlay">
      <form className={`worker-form ${styles.form}`} onSubmit={handleSubmit}>
        <div className={styles.titleRow}>
          <h2>
            {initial ? 'עריכת עובד' : 'הוספת עובד'}
            {(form.first_name || form.family_name) && (
              <span className={styles.workerNameInTitle}> - {[honorifics.find(h => h.id == form.honorific_id)?.name, form.family_name, form.first_name].filter(Boolean).join(' ')}{form.id_number ? ` (${form.id_number})` : ''}</span>
            )}
          </h2>
          {!isSelfEdit && initial?.id && (
            <label className={styles.activeToggle}>
              <input type="checkbox" name="is_active" checked={form.is_active !== false} onChange={handleChange} />
              פעיל
            </label>
          )}
        </div>

        <div className={styles.tabs}>
          {visibleTabs.map(t => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'personal' && (
          <div className={styles.tabContent}>
            {initial?.id && (
              <div className={styles.photoRow}>
                <div className={styles.photoPreview}>
                  {photoUrl
                    ? <img src={resolvePhotoUrl(photoUrl)} alt="תמונת פרופיל" className={styles.photoImg} />
                    : <div className={styles.photoPlaceholder}>{form.first_name?.[0] || '?'}</div>
                  }
                </div>
                <div className={styles.photoActions}>
                  <label className={styles.photoUploadBtn}>
                    {photoUploading ? 'מעלה...' : 'העלה תמונה'}
                    <input type="file" accept="image/*" onChange={handlePhotoChange} hidden disabled={photoUploading} />
                  </label>
                  <label className={styles.cameraCaptureBtn} title="צלם תמונה">
                    📷
                    <input type="file" accept="image/*" capture="user" onChange={handlePhotoChange} hidden disabled={photoUploading} />
                  </label>
                  {photoUrl && (
                    <button type="button" className={styles.photoDeleteBtn} onClick={handlePhotoDelete}>הסר תמונה</button>
                  )}
                </div>
              </div>
            )}
            <div className="form-row form-row-3">
              <label>
                תואר
                <select name="honorific_id" value={form.honorific_id} onChange={handleChange}>
                  {honorifics.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>
              <label>
                שם משפחה *
                <input name="family_name" value={form.family_name} onChange={handleChange} placeholder="כהן" required />
              </label>
              <label>
                שם פרטי *
                <input name="first_name" value={form.first_name} onChange={handleChange} placeholder="שרה" required />
              </label>
            </div>

            <div className="form-row">
              <label>
                תעודת זהות *
                <input name="id_number" value={form.id_number} onChange={handleChange} placeholder="9 ספרות" required />
              </label>
              <label>
                תאריך לידה
                <input
                  name="birth_date"
                  type="date"
                  value={form.birth_date ? form.birth_date.slice(0, 10) : ''}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                טלפון
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="050-000-0000" />
              </label>
              <label>
                אימייל אישי
                <input name="personal_email" type="email" value={form.personal_email} onChange={handleChange} placeholder="name@gmail.com" />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'org' && (
          <div className={styles.tabContent}>
            <div className="form-row">
              <label>
                תפקיד {!initial?.id && <span className="required-star">*</span>}
                <select name="job_id" value={form.job_id} onChange={handleChange}>
                  {!initial?.id && <option value="">— בחר תפקיד —</option>}
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </label>
              <label>
                סוג העסקה
                <select name="employment_type_id" value={form.employment_type_id} onChange={handleChange}>
                  {empTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                אימייל ארגוני *
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@assuta.co.il" required
                  onFocus={e => { if (!e.target.value && (form.family_name?.trim() || form.first_name?.trim())) setForm(f => ({ ...f, email: [hebrewToEnglish(f.family_name), hebrewToEnglish(f.first_name)].filter(Boolean).join('.') + '@assuta.co.il' })); }}
                  onBlur={e => { if (e.target.value && !e.target.value.includes('@')) setForm(f => ({ ...f, email: e.target.value + '@assuta.co.il' })); }} />
              </label>
              {!isSelfEdit && (
                <label>
                  סיווג
                  <select name="classification" value={form.classification} onChange={handleChange}>
                    {roles.length > 0
                      ? roles
                          .filter(r => r.tier !== 'master' && (r.name === form.classification || currentUser?.role_level == null || r.level > currentUser.role_level))
                          .map(r => <option key={r.name} value={r.name}>{r.display_name}</option>)
                      : <>
                          <option value="user">משתמש</option>
                          <option value="admin">מנהל סניף</option>
                          <option value="superadmin">מנהל ראשי</option>
                        </>
                    }
                  </select>
                </label>
              )}
            </div>

            {isSuperAdmin && !initial?.id && branches.length > 0 && (
              <label>
                סניף ראשי <span className="required-star">*</span>
                <select value={primaryBranchId} onChange={e => setPrimaryBranchId(e.target.value)}>
                  <option value="">— בחר סניף —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}

            {initial?.id && branches.length > 0 && (
              <label>
                סניף ראשי
                <select name="primary_branch_id" value={form.primary_branch_id || ''} onChange={handleChange}>
                  <option value="">— ללא סניף —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}

            <label>
              הערות
              <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="פרטים נוספים..." rows={2} />
            </label>

            {!isSelfEdit && (
              <div className={styles.canSubmitRow}>
                <label className={styles.canSubmitLabel}>
                  <input type="checkbox" name="can_submit_requests" checked={form.can_submit_requests} onChange={handleChange} />
                  רשאי להגיש בקשות למשמרות
                </label>
              </div>
            )}
          </div>
        )}

        {activeTab === 'branches' && isSuperAdmin && (
          <div className={styles.tabContent}>
            <div className={styles.branchNote}>
              <p>שיוך לסניף מאפשר לעובד להופיע ברשימת העובדים של אותו סניף ולהיות מוצע לשיבוצים בו. <strong>הסניף הראשי</strong> נקבע בפרטים הארגוניים. סניפים נוספים הם שיוך משני — העובד יסומן כ"מושאל" בהם. ניתן להשבית שיוך לסניף מסוים מבלי להסיר אותו לחלוטין.</p>
            </div>
            {!initial?.id ? (
              <p className={styles.tabPendingSave}>יש לשמור את העובד תחילה כדי לנהל שיוך לסניפים נוספים.</p>
            ) : (
              <>
                {workerBranches.length === 0 && <div className={styles.branchAssignEmpty}>לא משויך לסניפים</div>}
                {workerBranches.map(wb => (
                  <div key={wb.branch_id} className={styles.branchRow}>
                    <span className={styles.branchName}>{wb.branch_name}</span>
                    <label className={styles.activeLabel}>
                      <input type="checkbox" checked={wb.is_active} onChange={e => toggleBranchActive(wb.branch_id, e.target.checked)} />
                      פעיל
                    </label>
                    <button type="button" onClick={() => removeBranch(wb.branch_id)} className={styles.removeBtn} disabled={wb.branch_id === Number(form.primary_branch_id)} title={wb.branch_id === Number(form.primary_branch_id) ? 'לא ניתן להסיר את הסניף הראשי' : undefined}>הסר</button>
                  </div>
                ))}
                {unassignedBranches.length > 0 && (
                  <div className={styles.addBranchRow}>
                    <select
                      defaultValue=""
                      onChange={e => { if (e.target.value) { addBranch(e.target.value); e.target.value = ''; } }}
                      className={styles.addBranchSelect}
                    >
                      <option value="">+ הוסף לסניף...</option>
                      {unassignedBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'authorizations' && (
          <div className={styles.tabContent}>
            {!initial?.id ? (
              <p className={styles.tabPendingSave}>יש לשמור את העובד תחילה כדי להגדיר הרשאות פעילות.</p>
            ) : (
              <WorkerAuthorizationsPanel worker={initial} authToken={authToken} config={config} />
            )}
          </div>
        )}

        {cropSrc && (
          <PhotoCropModal
            imageUrl={cropSrc}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />
        )}

        {saveError && <p className="error-msg">{saveError}</p>}

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">ביטול</button>
          <button type="submit" className="btn-primary">שמור</button>
        </div>
      </form>
    </div>
  );
}
