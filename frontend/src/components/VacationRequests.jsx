import { useState, useEffect, useCallback } from 'react';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

const STATUS_LABEL = {
  pending:   { label: 'ממתין',       color: '#d97706' },
  approved:  { label: 'אושר',        color: '#16a34a' },
  partial:   { label: 'אושר חלקית',  color: '#2563eb' },
  rejected:  { label: 'נדחה',        color: '#dc2626' },
  cancelled: { label: 'בוטל',        color: '#6b7280' },
};

function formatDateHe(d) {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

function parseDate(d) {
  if (!d) return null;
  const [dd, m, y] = d.split('/');
  return `${y}-${m}-${dd}`;
}

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || { label: status, color: '#333' };
  return (
    <span style={{
      background: s.color, color: 'white',
      padding: '1px 6px', borderRadius: '12px',
      fontSize: '0.72rem', fontWeight: 600
    }}>
      {s.label}
    </span>
  );
}


function SortableHeader({ label, sortKey, sort, onSort, style }) {
  const active = sort.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ padding: '3px 8px', textAlign: 'right', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', ...style }}
    >
      {label}
      <span style={{ marginRight: '3px', fontSize: '0.65rem', color: active ? '#2563eb' : '#9ca3af' }}>
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

function sortRows(rows, { key, dir }) {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    let va = a[key] ?? '';
    let vb = b[key] ?? '';
    if (key === 'created_at') { va = va.split('T')[0]; vb = vb.split('T')[0]; }
    if (key === 'worker_name') { va = `${a.first_name} ${a.family_name}`; vb = `${b.first_name} ${b.family_name}`; }
    if (key === 'status') { va = STATUS_LABEL[va]?.label ?? va; vb = STATUS_LABEL[vb]?.label ?? vb; }
    const cmp = String(va).localeCompare(String(vb), 'he');
    return dir === 'asc' ? cmp : -cmp;
  });
}

function NewRequestModal({ onClose, onSuccess, token, isAdmin }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedWorkerLabel, setSelectedWorkerLabel] = useState('');
  const [workerSearch, setWorkerSearch] = useState('');
  const [showWorkerList, setShowWorkerList] = useState(false);
  const [allWorkers, setAllWorkers] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/workers?all_branches=true', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setAllWorkers)
      .catch(() => {});
  }, [isAdmin, token]);

  const filteredWorkers = allWorkers.filter((w) => {
    const q = workerSearch.trim().toLowerCase();
    if (!q) return true;
    const name = `${w.first_name} ${w.family_name}`.toLowerCase();
    const idNum = (w.id_number || '').toLowerCase();
    return name.includes(q) || idNum.includes(q);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isAdmin && !selectedWorkerId) {
      setError('יש לבחור עובד');
      return;
    }
    if (!startDate || !endDate) {
      setError('תאריך התחלה וסיום הם שדות חובה');
      return;
    }
    if (startDate > endDate) {
      setError('תאריך ההתחלה חייב להיות לפני תאריך הסיום');
      return;
    }

    setSubmitting(true);
    try {
      const body = { start_date: startDate, end_date: endDate, reason: reason || null };
      if (isAdmin && selectedWorkerId) body.on_behalf_of_worker_id = Number(selectedWorkerId);
      const res = await fetch('/api/vacation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setError(err.error || 'שגיאה בהגשת הבקשה');
      }
    } catch (e) {
      setError('שגיאה בהגשת הבקשה');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="worker-form" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>{isAdmin ? 'הגשת בקשת חופשה עבור עובד' : 'הגשת בקשת חופשה'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {isAdmin && (
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>עובד *</label>
              {selectedWorkerId ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid #2563eb', borderRadius: '4px', background: '#eff6ff' }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{selectedWorkerLabel}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedWorkerId(''); setSelectedWorkerLabel(''); setWorkerSearch(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '16px', lineHeight: 1 }}
                  >✕</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="חפש שם או ת.ז..."
                    value={workerSearch}
                    onChange={(e) => { setWorkerSearch(e.target.value); setShowWorkerList(true); }}
                    onFocus={() => setShowWorkerList(true)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                    autoComplete="off"
                  />
                  {showWorkerList && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 100,
                      background: 'white', border: '1px solid #ccc', borderRadius: '4px',
                      maxHeight: '180px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      {filteredWorkers.length === 0 ? (
                        <div style={{ padding: '10px', color: '#9ca3af', fontSize: '0.9rem' }}>לא נמצאו עובדים</div>
                      ) : filteredWorkers.map((w) => (
                        <div
                          key={w.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedWorkerId(String(w.id));
                            setSelectedWorkerLabel(`${w.first_name} ${w.family_name}${w.id_number ? ` (${w.id_number})` : ''}`);
                            setShowWorkerList(false);
                            setWorkerSearch('');
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f4ff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <span style={{ fontWeight: 600 }}>{w.first_name} {w.family_name}</span>
                          {w.id_number && <span style={{ color: '#6b7280', fontSize: '0.85rem', marginRight: '8px' }}>{w.id_number}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>מתאריך *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>עד תאריך *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>סיבה (אופציונלי)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical', minHeight: '60px' }}
            />
          </div>
          {error && <div style={{ color: '#b91c1c', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: '#2563eb', color: 'white',
              padding: '8px 16px', borderRadius: '4px', border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1
            }}
          >
            {submitting ? 'שולח...' : 'הגשת בקשה'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminDecisionModal({ request, onClose, onSuccess, token }) {
  const [decision, setDecision] = useState('');
  const [approvedStart, setApprovedStart] = useState(formatDateHe(request.start_date));
  const [approvedEnd, setApprovedEnd] = useState(formatDateHe(request.end_date));
  const [adminNotes, setAdminNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!decision) {
      setError('בחר החלטה');
      return;
    }

    let finalStart = null, finalEnd = null;
    if (decision === 'partial') {
      const s = parseDate(approvedStart);
      const e = parseDate(approvedEnd);
      if (!s || !e) {
        setError('תאריכי אישור לא תקינים');
        return;
      }
      finalStart = s;
      finalEnd = e;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/vacation-requests/${request.id}/decision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          decision,
          approved_start: finalStart,
          approved_end: finalEnd,
          admin_notes: adminNotes || null
        })
      });
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setError(err.error || 'שגיאה בעיבוד ההחלטה');
      }
    } catch (e) {
      setError('שגיאה בעיבוד ההחלטה');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="worker-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>{request.status === 'pending' ? 'קבלת החלטה על בקשה' : 'עריכת החלטה'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>
              בקשה של <strong>{request.first_name} {request.family_name}</strong> מתאריך {formatDateHe(request.start_date)} עד {formatDateHe(request.end_date)}
            </p>
            {request.reason && <p style={{ fontSize: '0.85rem', color: '#666' }}>סיבה: {request.reason}</p>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>החלטה *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDecision('approved')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '4px',
                  background: decision === 'approved' ? '#16a34a' : '#f0f0f0',
                  color: decision === 'approved' ? 'white' : '#333',
                  border: 'none', cursor: 'pointer'
                }}
              >
                אישור מלא
              </button>
              <button
                type="button"
                onClick={() => setDecision('partial')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '4px',
                  background: decision === 'partial' ? '#2563eb' : '#f0f0f0',
                  color: decision === 'partial' ? 'white' : '#333',
                  border: 'none', cursor: 'pointer'
                }}
              >
                אישור חלקי
              </button>
              <button
                type="button"
                onClick={() => setDecision('rejected')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '4px',
                  background: decision === 'rejected' ? '#dc2626' : '#f0f0f0',
                  color: decision === 'rejected' ? 'white' : '#333',
                  border: 'none', cursor: 'pointer'
                }}
              >
                דחייה
              </button>
            </div>
          </div>

          {decision === 'partial' && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px' }}>מתאריך *</label>
                <input
                  type="text"
                  placeholder="DD.MM.YYYY"
                  value={approvedStart}
                  onChange={(e) => setApprovedStart(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px' }}>עד תאריך *</label>
                <input
                  type="text"
                  placeholder="DD.MM.YYYY"
                  value={approvedEnd}
                  onChange={(e) => setApprovedEnd(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>הערות מנהל</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical', minHeight: '60px' }}
            />
          </div>

          {error && <div style={{ color: '#b91c1c', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: '#2563eb', color: 'white',
              padding: '8px 16px', borderRadius: '4px', border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1
            }}
          >
            {submitting ? 'מעבד...' : 'שלח החלטה'}
          </button>
        </form>
      </div>
    </div>
  );
}

function WorkerView({ requests, onCancel, onNewRequest, token }) {
  const isMobile = useIsMobile();
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  function onSort(key) { setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' })); }
  const sorted = sortRows(requests, sort);
  return (
    <div>
      <button
        onClick={onNewRequest}
        style={{
          background: '#2563eb', color: 'white',
          padding: '8px 16px', borderRadius: '4px', border: 'none',
          cursor: 'pointer', marginBottom: '16px'
        }}
      >
        הגשת בקשת חופשה חדשה
      </button>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {requests.length === 0 && <p style={{ color: '#666' }}>אין בקשות חופשה</p>}
          {requests.map((r) => (
            <div key={r.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge status={r.status} />
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{formatDateHe(r.created_at?.split('T')[0])}</span>
              </div>
              <div style={{ fontWeight: 600 }}>{formatDateHe(r.start_date)} – {formatDateHe(r.end_date)}</div>
              {r.reason && <div style={{ fontSize: '0.88rem', color: '#374151' }}>סיבה: {r.reason}</div>}
              {r.approved_start && r.approved_end && (
                <div style={{ fontSize: '0.85rem', color: '#2563eb' }}>מאושר: {formatDateHe(r.approved_start)} – {formatDateHe(r.approved_end)}</div>
              )}
              {r.admin_notes && <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>הערות: {r.admin_notes}</div>}
              {r.status === 'pending' && (
                <button onClick={() => onCancel(r.id)} style={{ background: '#dc2626', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                  ביטול
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
        <div className="vacation-table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <SortableHeader label="תאריך הגשה"       sortKey="created_at"     sort={sort} onSort={onSort} />
              <SortableHeader label="מתאריך"            sortKey="start_date"     sort={sort} onSort={onSort} />
              <SortableHeader label="עד תאריך"          sortKey="end_date"       sort={sort} onSort={onSort} />
              <SortableHeader label="סיבה"              sortKey="reason"         sort={sort} onSort={onSort} />
              <SortableHeader label="סטטוס"             sortKey="status"         sort={sort} onSort={onSort} />
              <SortableHeader label="תאריכים מאושרים"  sortKey="approved_start" sort={sort} onSort={onSort} />
              <SortableHeader label="הערות"             sortKey="admin_notes"    sort={sort} onSort={onSort} />
              <th style={{ padding: '3px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>פעולה</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '3px 8px' }}>{formatDateHe(r.created_at?.split('T')[0])}</td>
                <td style={{ padding: '3px 8px' }}>{formatDateHe(r.start_date)}</td>
                <td style={{ padding: '3px 8px' }}>{formatDateHe(r.end_date)}</td>
                <td style={{ padding: '3px 8px', fontSize: '0.9rem' }}>{r.reason || '—'}</td>
                <td style={{ padding: '3px 8px' }}><StatusBadge status={r.status} /></td>
                <td style={{ padding: '3px 8px', fontSize: '0.9rem' }}>
                  {r.approved_start && r.approved_end
                    ? `${formatDateHe(r.approved_start)} – ${formatDateHe(r.approved_end)}`
                    : '—'}
                </td>
                <td style={{ padding: '3px 8px', fontSize: '0.9rem' }}>{r.admin_notes || '—'}</td>
                <td style={{ padding: '3px 8px' }}>
                  {r.status === 'pending' && (
                    <button
                      onClick={() => onCancel(r.id)}
                      style={{ background: '#dc2626', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ביטול
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {requests.length === 0 && <p style={{ color: '#666' }}>אין בקשות חופשה</p>}
        </>
      )}
    </div>
  );
}

function AdminView({ requests, onDecide, onDelete, token, statusFilter, onStatusFilterChange, onNewRequest, nameFilter, onNameFilterChange }) {
  const isMobile = useIsMobile();
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  function onSort(key) { setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' })); }

  const statuses = ['', 'pending', 'approved', 'partial', 'rejected', 'cancelled'];
  const statusLabels = {
    '': 'כל הסטטוסים',
    pending: 'ממתינה',
    approved: 'אושרה',
    partial: 'אושרה חלקית',
    rejected: 'נדחתה',
    cancelled: 'בוטלה'
  };

  const filtered = nameFilter.trim()
    ? requests.filter(r => `${r.first_name} ${r.family_name}`.includes(nameFilter.trim()))
    : requests;
  const sorted = sortRows(filtered, sort);

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={onNewRequest}
          style={{ background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
        >
          הגש בקשה עבור עובד
        </button>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="חיפוש לפי שם..."
          value={nameFilter}
          onChange={(e) => onNameFilterChange(e.target.value)}
          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', flex: '1 1 120px' }}
        />
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.length === 0 && <p style={{ color: '#666' }}>אין בקשות</p>}
          {filtered.map((r) => (
            <div key={r.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>{r.first_name} {r.family_name}</span>
                <StatusBadge status={r.status} />
              </div>
              <div style={{ fontSize: '0.88rem', color: '#374151' }}>{formatDateHe(r.start_date)} – {formatDateHe(r.end_date)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>הוגש: {formatDateHe(r.created_at?.split('T')[0])}</div>
              {r.reason && <div style={{ fontSize: '0.85rem' }}>סיבה: {r.reason}</div>}
              {r.approved_start && r.approved_end && (
                <div style={{ fontSize: '0.85rem', color: '#2563eb' }}>מאושר: {formatDateHe(r.approved_start)} – {formatDateHe(r.approved_end)}</div>
              )}
              {r.admin_notes && <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>הערות: {r.admin_notes}</div>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => onDecide(r)}
                  style={{ background: r.status === 'pending' ? '#2563eb' : '#6b7280', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', flex: 1 }}
                >
                  {r.status === 'pending' ? 'קבל החלטה' : 'ערוך החלטה'}
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  style={{ background: '#dc2626', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
        <div className="vacation-table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <SortableHeader label="שם עובד"           sortKey="worker_name"    sort={sort} onSort={onSort} />
              <SortableHeader label="תאריך הגשה"        sortKey="created_at"     sort={sort} onSort={onSort} />
              <SortableHeader label="מתאריך"            sortKey="start_date"     sort={sort} onSort={onSort} />
              <SortableHeader label="עד תאריך"          sortKey="end_date"       sort={sort} onSort={onSort} />
              <SortableHeader label="סיבה"              sortKey="reason"         sort={sort} onSort={onSort} />
              <SortableHeader label="סטטוס"             sortKey="status"         sort={sort} onSort={onSort} />
              <SortableHeader label="תאריכים מאושרים"  sortKey="approved_start" sort={sort} onSort={onSort} />
              <SortableHeader label="הערות"             sortKey="admin_notes"    sort={sort} onSort={onSort} />
              <th style={{ padding: '3px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>פעולה</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}>{r.first_name} {r.family_name}</td>
                <td style={{ padding: '3px 8px', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{formatDateHe(r.created_at?.split('T')[0])}</td>
                <td style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}>{formatDateHe(r.start_date)}</td>
                <td style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}>{formatDateHe(r.end_date)}</td>
                <td style={{ padding: '3px 8px', fontSize: '0.9rem' }}>{r.reason || '—'}</td>
                <td style={{ padding: '3px 8px' }}><StatusBadge status={r.status} /></td>
                <td style={{ padding: '3px 8px', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                  {r.approved_start && r.approved_end
                    ? `${formatDateHe(r.approved_start)} – ${formatDateHe(r.approved_end)}`
                    : '—'}
                </td>
                <td style={{ padding: '3px 8px', fontSize: '0.9rem' }}>{r.admin_notes || '—'}</td>
                <td style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => onDecide(r)}
                    style={{ background: r.status === 'pending' ? '#2563eb' : '#6b7280', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', marginLeft: '4px' }}
                  >
                    {r.status === 'pending' ? 'קבל החלטה' : 'ערוך החלטה'}
                  </button>
                  <button
                    onClick={() => onDelete(r.id)}
                    style={{ background: '#dc2626', color: 'white', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    מחק
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <p style={{ color: '#666' }}>אין בקשות</p>}
        </>
      )}
    </div>
  );
}

export default function VacationRequests({ currentUser, token, selectedBranchId, workers }) {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [decisionRequest, setDecisionRequest] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const statusQ = statusFilter ? `&status=${statusFilter}` : '';
      const res = await fetch(`/api/vacation-requests?${statusQ}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (e) {
      console.error('Error fetching vacation requests:', e);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAdminDelete = async (id) => {
    if (!window.confirm('למחוק בקשה זו לצמיתות?')) return;
    try {
      const res = await fetch(`/api/vacation-requests/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchRequests();
      else alert('שגיאה במחיקת בקשה');
    } catch (e) {
      alert('שגיאה במחיקת בקשה');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('בטוח לבטל בקשה זו?')) return;
    try {
      const res = await fetch(`/api/vacation-requests/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchRequests();
      } else {
        alert('שגיאה בביטול בקשה');
      }
    } catch (e) {
      alert('שגיאה בביטול בקשה');
    }
  };

  return (
    <div style={{ padding: '4px 16px 16px', direction: 'rtl' }}>
      <h2 style={{ marginTop: '0' }}>בקשות חופשה</h2>
      {loading ? <p>טוען...</p> : (
        isAdmin ? (
          <AdminView
            requests={requests}
            onDecide={setDecisionRequest}
            onDelete={handleAdminDelete}
            token={token}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onNewRequest={() => setShowNewModal(true)}
            nameFilter={nameFilter}
            onNameFilterChange={setNameFilter}
          />
        ) : (
          <WorkerView
            requests={requests}
            onCancel={handleCancel}
            onNewRequest={() => setShowNewModal(true)}
            token={token}
          />
        )
      )}

      {showNewModal && <NewRequestModal onClose={() => setShowNewModal(false)} onSuccess={fetchRequests} token={token} isAdmin={isAdmin} />}
      {decisionRequest && <AdminDecisionModal request={decisionRequest} onClose={() => setDecisionRequest(null)} onSuccess={fetchRequests} token={token} />}
    </div>
  );
}
