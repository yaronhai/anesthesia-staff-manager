import { useState } from 'react';

function WorkerDetail({ worker, onClose, onEdit }) {
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
              <span className={`badge ${worker.employment_type === 'עצמאי' ? 'badge-self' : 'badge-normal'}`}>
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

export default function WorkerList({ workers, onEdit, onDelete }) {
  const [viewing, setViewing] = useState(null);

  if (workers.length === 0) {
    return <p className="empty">אין עובדים עדיין. לחץ על "+ הוסף עובד" כדי להתחיל.</p>;
  }

  return (
    <>
      {viewing && (
        <WorkerDetail worker={viewing} onClose={() => setViewing(null)} onEdit={onEdit} />
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
                <span className={`badge ${w.employment_type === 'עצמאי' ? 'badge-self' : 'badge-normal'}`}>
                  {w.employment_type}
                </span>
              </td>
              <td>{w.phone || '—'}</td>
              <td>{w.email || '—'}</td>
              <td>
                <button onClick={() => setViewing(w)} className="btn-view">צפייה</button>
                <button onClick={() => onEdit(w)} className="btn-edit">עריכה</button>
                <button onClick={() => onDelete(w.id)} className="btn-delete">מחיקה</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
