import { useState, useEffect, useCallback } from 'react';
import styles from '../styles/VacationRequests.module.scss';

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
    <span className={styles.badge} style={{ '--badge-bg': s.color }}>
      {s.label}
    </span>
  );
}


function SortableHeader({ label, sortKey, sort, onSort, style }) {
  const active = sort.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={styles.sortTh}
      style={style}
    >
      {label}
      <span className={`${styles.sortIcon} ${active ? styles.active : styles.inactive}`}>
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
        <div className={styles.modalHeader}>
          <h3 className={styles.modalHeading}>{isAdmin ? 'הגשת בקשת חופשה עבור עובד' : 'הגשת בקשת חופשה'}</h3>
          <button onClick={onClose} className={styles.modalCloseBtn}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {isAdmin && (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>עובד *</label>
              {selectedWorkerId ? (
                <div className={styles.selectedWorkerBox}>
                  <span className={styles.selectedWorkerName}>{selectedWorkerLabel}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedWorkerId(''); setSelectedWorkerLabel(''); setWorkerSearch(''); }}
                    className={styles.clearWorkerBtn}
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
                    className={styles.workerSearchInput}
                    autoComplete="off"
                  />
                  {showWorkerList && (
                    <div className={styles.dropdownList}>
                      {filteredWorkers.length === 0 ? (
                        <div className={styles.dropdownEmpty}>לא נמצאו עובדים</div>
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
                          className={styles.dropdownItem}
                        >
                          <span className={styles.dropdownItemName}>{w.first_name} {w.family_name}</span>
                          {w.id_number && <span className={styles.dropdownItemId}>{w.id_number}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className={styles.dateRow}>
            <div className={styles.dateField}>
              <label className={styles.fieldLabel}>מתאריך *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
            <div className={styles.dateField}>
              <label className={styles.fieldLabel}>עד תאריך *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
          </div>
          <div className={styles.reasonGroup}>
            <label className={styles.fieldLabel}>סיבה (אופציונלי)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={styles.reasonTextarea}
            />
          </div>
          {error && <div className={styles.errorText}>{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className={styles.submitBtn}
            style={{ '--btn-cursor': submitting ? 'not-allowed' : 'pointer', '--btn-opacity': submitting ? 0.5 : 1 }}
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
      <div className={`worker-form ${styles.maxWidth500}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalHeading}>{request.status === 'pending' ? 'קבלת החלטה על בקשה' : 'עריכת החלטה'}</h3>
          <button onClick={onClose} className={styles.modalCloseBtn}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <p className={styles.requestInfoText}>
              בקשה של <strong>{request.first_name} {request.family_name}</strong> מתאריך {formatDateHe(request.start_date)} עד {formatDateHe(request.end_date)}
            </p>
            {request.reason && <p className={styles.reasonText}>סיבה: {request.reason}</p>}
          </div>

          <div className={styles.decisionGroup}>
            <label className={styles.decisionLabel}>החלטה *</label>
            <div className={styles.decisionBtns}>
              <button
                type="button"
                onClick={() => setDecision('approved')}
                className={styles.decisionBtn}
                style={{ '--decision-bg': decision === 'approved' ? '#16a34a' : '#f0f0f0', '--decision-color': decision === 'approved' ? 'white' : '#333' }}
              >
                אישור מלא
              </button>
              <button
                type="button"
                onClick={() => setDecision('partial')}
                className={styles.decisionBtn}
                style={{ '--decision-bg': decision === 'partial' ? '#2563eb' : '#f0f0f0', '--decision-color': decision === 'partial' ? 'white' : '#333' }}
              >
                אישור חלקי
              </button>
              <button
                type="button"
                onClick={() => setDecision('rejected')}
                className={styles.decisionBtn}
                style={{ '--decision-bg': decision === 'rejected' ? '#dc2626' : '#f0f0f0', '--decision-color': decision === 'rejected' ? 'white' : '#333' }}
              >
                דחייה
              </button>
            </div>
          </div>

          {decision === 'partial' && (
            <>
              <div className={styles.partialFieldGroup}>
                <label className={styles.fieldLabel}>מתאריך *</label>
                <input
                  type="text"
                  placeholder="DD.MM.YYYY"
                  value={approvedStart}
                  onChange={(e) => setApprovedStart(e.target.value)}
                  className={styles.partialInput}
                />
              </div>
              <div className={styles.partialFieldGroup}>
                <label className={styles.fieldLabel}>עד תאריך *</label>
                <input
                  type="text"
                  placeholder="DD.MM.YYYY"
                  value={approvedEnd}
                  onChange={(e) => setApprovedEnd(e.target.value)}
                  className={styles.partialInput}
                />
              </div>
            </>
          )}

          <div className={styles.adminNotesGroup}>
            <label className={styles.fieldLabel}>הערות מנהל</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className={styles.adminNotesTextarea}
            />
          </div>

          {error && <div className={styles.errorText}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className={styles.submitBtn}
            style={{ '--btn-cursor': submitting ? 'not-allowed' : 'pointer', '--btn-opacity': submitting ? 0.5 : 1 }}
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
      <button onClick={onNewRequest} className={styles.newRequestBtn}>
        הגשת בקשת חופשה חדשה
      </button>

      {isMobile ? (
        <div className={styles.mobileCardList}>
          {requests.length === 0 && <p className={styles.emptyMsg}>אין בקשות חופשה</p>}
          {requests.map((r) => (
            <div key={r.id} className={styles.mobileCard}>
              <div className={styles.cardTopRow}>
                <StatusBadge status={r.status} />
                <span className={styles.cardDate}>{formatDateHe(r.created_at?.split('T')[0])}</span>
              </div>
              <div className={styles.cardDateRange}>{formatDateHe(r.start_date)} – {formatDateHe(r.end_date)}</div>
              {r.reason && <div className={styles.cardReason}>סיבה: {r.reason}</div>}
              {r.approved_start && r.approved_end && (
                <div className={styles.cardApproved}>מאושר: {formatDateHe(r.approved_start)} – {formatDateHe(r.approved_end)}</div>
              )}
              {r.admin_notes && <div className={styles.cardNotes}>הערות: {r.admin_notes}</div>}
              {r.status === 'pending' && (
                <button onClick={() => onCancel(r.id)} className={styles.cancelBtn}>
                  ביטול
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
        <div className="vacation-table-wrap">
        <table className={styles.vacationTable}>
          <thead className={styles.tableHead}>
            <tr>
              <SortableHeader label="תאריך הגשה"       sortKey="created_at"     sort={sort} onSort={onSort} />
              <SortableHeader label="מתאריך"            sortKey="start_date"     sort={sort} onSort={onSort} />
              <SortableHeader label="עד תאריך"          sortKey="end_date"       sort={sort} onSort={onSort} />
              <SortableHeader label="סיבה"              sortKey="reason"         sort={sort} onSort={onSort} />
              <SortableHeader label="סטטוס"             sortKey="status"         sort={sort} onSort={onSort} />
              <SortableHeader label="תאריכים מאושרים"  sortKey="approved_start" sort={sort} onSort={onSort} />
              <SortableHeader label="הערות"             sortKey="admin_notes"    sort={sort} onSort={onSort} />
              <th className={styles.sortTh}>פעולה</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className={styles.tableRow}>
                <td className={styles.tableCell}>{formatDateHe(r.created_at?.split('T')[0])}</td>
                <td className={styles.tableCell}>{formatDateHe(r.start_date)}</td>
                <td className={styles.tableCell}>{formatDateHe(r.end_date)}</td>
                <td className={styles.tableCellSm}>{r.reason || '—'}</td>
                <td className={styles.tableCell}><StatusBadge status={r.status} /></td>
                <td className={styles.tableCellSm}>
                  {r.approved_start && r.approved_end
                    ? `${formatDateHe(r.approved_start)} – ${formatDateHe(r.approved_end)}`
                    : '—'}
                </td>
                <td className={styles.tableCellSm}>{r.admin_notes || '—'}</td>
                <td className={styles.tableCell}>
                  {r.status === 'pending' && (
                    <button onClick={() => onCancel(r.id)} className={styles.tableCancelBtn}>
                      ביטול
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {requests.length === 0 && <p className={styles.emptyMsg}>אין בקשות חופשה</p>}
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
      <div className={styles.filterRow}>
        <button onClick={onNewRequest} className={styles.newRequestBtn}>
          הגש בקשה עבור עובד
        </button>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className={styles.filterSelect}
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
          className={styles.filterSearch}
        />
      </div>

      {isMobile ? (
        <div className={styles.mobileCardList}>
          {filtered.length === 0 && <p className={styles.emptyMsg}>אין בקשות</p>}
          {filtered.map((r) => (
            <div key={r.id} className={styles.mobileCard}>
              <div className={styles.cardTopRow}>
                <span className={styles.cardWorkerName}>{r.first_name} {r.family_name}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className={styles.cardReason}>{formatDateHe(r.start_date)} – {formatDateHe(r.end_date)}</div>
              <div className={styles.cardSubmittedDate}>הוגש: {formatDateHe(r.created_at?.split('T')[0])}</div>
              {r.reason && <div className={styles.cardReason}>סיבה: {r.reason}</div>}
              {r.approved_start && r.approved_end && (
                <div className={styles.cardApproved}>מאושר: {formatDateHe(r.approved_start)} – {formatDateHe(r.approved_end)}</div>
              )}
              {r.admin_notes && <div className={styles.cardNotes}>הערות: {r.admin_notes}</div>}
              <div className={styles.cardActions}>
                <button
                  onClick={() => onDecide(r)}
                  className={styles.cardActionBtn}
                  style={{ '--card-btn-bg': r.status === 'pending' ? '#2563eb' : '#6b7280' }}
                >
                  {r.status === 'pending' ? 'קבל החלטה' : 'ערוך החלטה'}
                </button>
                <button onClick={() => onDelete(r.id)} className={styles.cardDeleteBtn}>
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
        <div className="vacation-table-wrap">
        <table className={styles.vacationTable}>
          <thead className={styles.tableHead}>
            <tr>
              <SortableHeader label="שם עובד"           sortKey="worker_name"    sort={sort} onSort={onSort} />
              <SortableHeader label="תאריך הגשה"        sortKey="created_at"     sort={sort} onSort={onSort} />
              <SortableHeader label="מתאריך"            sortKey="start_date"     sort={sort} onSort={onSort} />
              <SortableHeader label="עד תאריך"          sortKey="end_date"       sort={sort} onSort={onSort} />
              <SortableHeader label="סיבה"              sortKey="reason"         sort={sort} onSort={onSort} />
              <SortableHeader label="סטטוס"             sortKey="status"         sort={sort} onSort={onSort} />
              <SortableHeader label="תאריכים מאושרים"  sortKey="approved_start" sort={sort} onSort={onSort} />
              <SortableHeader label="הערות"             sortKey="admin_notes"    sort={sort} onSort={onSort} />
              <th className={styles.sortTh}>פעולה</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className={styles.tableRow}>
                <td className={styles.tableCellNoWrap}>{r.first_name} {r.family_name}</td>
                <td className={styles.tableCellSmNoWrap}>{formatDateHe(r.created_at?.split('T')[0])}</td>
                <td className={styles.tableCellNoWrap}>{formatDateHe(r.start_date)}</td>
                <td className={styles.tableCellNoWrap}>{formatDateHe(r.end_date)}</td>
                <td className={styles.tableCellSm}>{r.reason || '—'}</td>
                <td className={styles.tableCell}><StatusBadge status={r.status} /></td>
                <td className={styles.tableCellSmNoWrap}>
                  {r.approved_start && r.approved_end
                    ? `${formatDateHe(r.approved_start)} – ${formatDateHe(r.approved_end)}`
                    : '—'}
                </td>
                <td className={styles.tableCellSm}>{r.admin_notes || '—'}</td>
                <td className={styles.tableActionCell}>
                  <button
                    onClick={() => onDecide(r)}
                    className={styles.tableActionBtn}
                    style={{ '--action-btn-bg': r.status === 'pending' ? '#2563eb' : '#6b7280' }}
                  >
                    {r.status === 'pending' ? 'קבל החלטה' : 'ערוך החלטה'}
                  </button>
                  <button onClick={() => onDelete(r.id)} className={styles.tableDeleteBtn}>
                    מחק
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <p className={styles.emptyMsg}>אין בקשות</p>}
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
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>בקשות חופשה</h2>
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
