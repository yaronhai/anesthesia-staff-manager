import { useState, useEffect } from 'react';
import styles from '../styles/WorkerForm.module.scss';

export default function WorkerForm({ initial, config, onSave, onCancel, isSuperAdmin, authToken, branches = [], roles = [], currentUser = null }) {
  const jobs = config?.jobs || [];
  const empTypes = config?.employment_types || [];
  const honorifics = config?.honorifics || [];

  const [form, setForm] = useState({
    honorific_id: honorifics[0]?.id || '',
    first_name: '',
    family_name: '',
    job_id: jobs[0]?.id || '',
    employment_type_id: empTypes[0]?.id || '',
    phone: '',
    email: '',
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
  const [primaryBranchId, setPrimaryBranchId] = useState('');

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
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError('');
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

  async function removeBranch(branchId) {
    const res = await fetch(`/api/workers/${initial.id}/branches/${branchId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) setWorkerBranches(await res.json().catch(() => []));
    else setWorkerBranches(workerBranches.filter(b => b.branch_id !== branchId));
  }

  const unassignedBranches = branches.filter(b => !workerBranches.find(wb => wb.branch_id === b.id));

  return (
    <div className="form-overlay">
      <form className="worker-form" onSubmit={handleSubmit}>
        <h2>{initial ? 'עריכת עובד' : 'הוספת עובד'}</h2>

        <div className="form-row form-row-3">
          <label>
            תואר
            <select name="honorific_id" value={form.honorific_id} onChange={handleChange}>
              {honorifics.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
          <label>
            שם פרטי *
            <input
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              placeholder="לדוגמה: שרה"
              required
            />
          </label>
          <label>
            שם משפחה *
            <input
              name="family_name"
              value={form.family_name}
              onChange={handleChange}
              placeholder="לדוגמה: כהן"
              required
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            תעודת זהות *
            <input
              name="id_number"
              value={form.id_number}
              onChange={handleChange}
              placeholder="9 ספרות"
              required
            />
          </label>
          <label>
            סיווג
            <select name="classification" value={form.classification} onChange={handleChange}>
              {roles.length > 0
                ? roles
                    .filter(r => currentUser?.role_level == null || r.level > currentUser.role_level)
                    .map(r => <option key={r.name} value={r.name}>{r.display_name}</option>)
                : <>
                    <option value="user">משתמש</option>
                    <option value="admin">מנהל סניף</option>
                    <option value="superadmin">מנהל ראשי</option>
                  </>
              }
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            תפקיד
            <select name="job_id" value={form.job_id} onChange={handleChange}>
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
            טלפון
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="לדוגמה: 050-000-0000"
            />
          </label>
          <label>
            אימייל *
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="לדוגמה: name@hospital.com"
              required
            />
          </label>
        </div>

        <label>
          הערות
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="פרטים נוספים..."
            rows={3}
          />
        </label>

        {isSuperAdmin && !initial?.id && branches.length > 0 && (
          <div className={styles.branchSection}>
            <label>
              סניף ראשי
              <select value={primaryBranchId} onChange={e => setPrimaryBranchId(e.target.value)}>
                <option value="">— ללא סניף —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {initial?.id && branches.length > 0 && (
          <div className={styles.branchSection}>
            <label>
              סניף ראשי
              <select name="primary_branch_id" value={form.primary_branch_id || ''} onChange={handleChange}>
                <option value="">— ללא סניף —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {isSuperAdmin && initial?.id && (
          <div className={styles.branchAssignSection}>
            <div className={styles.branchAssignTitle}>שיוך לסניפים</div>
            {workerBranches.length === 0 && <div className={styles.branchAssignEmpty}>לא משויך לסניפים</div>}
            {workerBranches.map(wb => (
              <div key={wb.branch_id} className={styles.branchRow}>
                <span className={styles.branchName}>{wb.branch_name}</span>
                <label className={styles.activeLabel}>
                  <input
                    type="checkbox"
                    checked={wb.is_active}
                    onChange={e => toggleBranchActive(wb.branch_id, e.target.checked)}
                  />
                  פעיל
                </label>
                <button type="button" onClick={() => removeBranch(wb.branch_id)} className={styles.removeBtn}>הסר</button>
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
                  {unassignedBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className={styles.canSubmitRow}>
          <label className={styles.canSubmitLabel}>
            <input
              type="checkbox"
              name="can_submit_requests"
              checked={form.can_submit_requests}
              onChange={handleChange}
            />
            רשאי להגיש בקשות למשמרות
          </label>
        </div>

        {saveError && <p className="error-msg">{saveError}</p>}

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">ביטול</button>
          <button type="submit" className="btn-primary">שמור</button>
        </div>
      </form>
    </div>
  );
}
