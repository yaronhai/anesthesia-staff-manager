import { useState } from 'react';

export default function WorkerForm({ initial, config, onSave, onCancel }) {
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
    ...initial,
  });
  const [saveError, setSaveError] = useState('');

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError('');
    const err = await onSave(form);
    if (err) setSaveError(err);
  }

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
              <option value="user">משתמש</option>
              <option value="admin">מנהל</option>
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

        {saveError && <p className="error-msg">{saveError}</p>}

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">ביטול</button>
          <button type="submit" className="btn-primary">שמור</button>
        </div>
      </form>
    </div>
  );
}
