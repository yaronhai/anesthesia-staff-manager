import { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../styles/EventsManagement.module.scss';
import { useDraggableModal } from '../hooks/useDraggableModal';

export default function EventsManagement({ workers, config, authToken, currentUser, selectedBranchId }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showPredictModal, setShowPredictModal] = useState(false);
  const [predictResult, setPredictResult] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  const [optimizeResult, setOptimizeResult] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [showInviteesModal, setShowInviteesModal] = useState(false);

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role_tier ?? currentUser?.role);

  const fetchEvents = useCallback(async () => {
    try {
      const params = selectedBranchId ? `?branch_id=${selectedBranchId}` : '';
      const res = await fetch(`/api/events${params}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setEvents(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [authToken, selectedBranchId]);

  const fetchEventDetail = useCallback(async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setEventDetail(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => { setSelectedEvent(null); }, [selectedBranchId]);

  useEffect(() => {
    if (selectedEvent) fetchEventDetail(selectedEvent.id);
    else setEventDetail(null);
  }, [selectedEvent, fetchEventDetail]);

  async function deleteEvent(id) {
    if (!confirm('למחוק את האירוע? פעולה בלתי הפיכה.')) return;
    const res = await fetch(`/api/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      setSelectedEvent(null);
      fetchEvents();
    }
  }

  async function saveInvitees(workerIds) {
    const res = await fetch(`/api/events/${eventDetail.id}/invitees`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ workerIds }),
    });
    if (res.ok) { fetchEventDetail(eventDetail.id); setShowInviteesModal(false); }
    else alert('שגיאה בשמירת מוזמנים');
  }

  async function assignToSession(sessionId, workerIds) {
    const res = await fetch(`/api/events/${eventDetail.id}/sessions/${sessionId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ workerIds }),
    });
    if (!res.ok) { alert('שגיאה בשיבוץ'); return; }
    const data = await res.json();
    if (data.conflicts && data.conflicts.length) {
      setConflictData({ sessionId, conflicts: data.conflicts });
    }
    fetchEventDetail(eventDetail.id);
  }

  async function removeFromSession(sessionId, workerId) {
    await fetch(`/api/events/${eventDetail.id}/sessions/${sessionId}/assign/${workerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    fetchEventDetail(eventDetail.id);
  }

  async function resolveConflict(sessionId, originalWorkerId, replacementWorkerId, assignmentId) {
    const res = await fetch(`/api/events/${eventDetail.id}/sessions/${sessionId}/resolve-conflict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ originalWorkerId, replacementWorkerId, assignmentId }),
    });
    if (res.ok) {
      setConflictData(null);
      fetchEventDetail(eventDetail.id);
    } else {
      alert('שגיאה בפתרון ניגוד');
    }
  }

  async function runOptimize() {
    const hasAssignments = eventDetail.sessions?.some(s => s.assignments?.length > 0);
    const reset = hasAssignments
      ? confirm('קיימים שיבוצים לסשנים. לנקות ולחשב מחדש מאפס?\n\nאישור = נקה הכל וחשב מחדש\nביטול = הוסף רק למי שטרם שובץ')
      : false;
    setOptimizing(true);
    document.body.style.cursor = 'wait';
    try {
      const res = await fetch(`/api/events/${eventDetail.id}/optimize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset }),
      });
      if (!res.ok) { alert('שגיאה באופטימיזציה'); return; }
      const data = await res.json();
      setOptimizeResult(data);
      fetchEventDetail(eventDetail.id);
    } finally {
      setOptimizing(false);
      document.body.style.cursor = '';
    }
  }

  async function deleteSession(sessionId) {
    if (!confirm('למחוק את הסשן?')) return;
    await fetch(`/api/events/${eventDetail.id}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    fetchEventDetail(eventDetail.id);
  }

  async function clearSessionAssignments(sessionId, workerIds) {
    await Promise.all(workerIds.map(wid =>
      fetch(`/api/events/${eventDetail.id}/sessions/${sessionId}/assign/${wid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
    ));
    fetchEventDetail(eventDetail.id);
  }

  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    const weekday = dt.toLocaleDateString('he-IL', { weekday: 'short' });
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    return `${weekday}, ${day}/${month}/${dt.getFullYear()}`;
  }

  function formatTime(t) {
    if (!t) return '';
    return t.slice(0, 5);
  }

  const unassignedInvitees = eventDetail
    ? eventDetail.invitees.filter(i => !i.attended)
    : [];

  return (
    <div className={styles.container}>
      {/* ── Left panel: event list ── */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>אירועים</h2>
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setEditingEvent(null); setShowEventForm(true); }}>
              + אירוע חדש
            </button>
          )}
        </div>
        {events.length === 0 ? (
          <p className={styles.empty}>אין אירועים מתוכננים</p>
        ) : (
          <ul className={styles.eventList}>
            {events.map(ev => (
              <li
                key={ev.id}
                className={`${styles.eventItem} ${selectedEvent?.id === ev.id ? styles.eventItemActive : ''}`}
                onClick={() => setSelectedEvent(ev)}
              >
                <div className={styles.eventItemName}>{ev.name}</div>
                {ev.event_type_name && (
                  <div className={styles.eventItemType}>{ev.event_type_name}</div>
                )}
                <div className={styles.eventItemMeta}>
                  {ev.session_count} סשנים · {ev.invitee_count} מוזמנים
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Right panel: event detail ── */}
      <div className={styles.detail}>
        {!selectedEvent && (
          <div className={styles.placeholder}>
            <p>בחר אירוע מהרשימה לצפייה ועריכה</p>
          </div>
        )}

        {selectedEvent && loading && <p className={styles.loading}>טוען...</p>}

        {eventDetail && !loading && (
          <>
            <div className={styles.detailHeader}>
              <div>
                <h2 className={styles.detailTitle}>{eventDetail.name}</h2>
                {eventDetail.event_type_name && (
                  <span className={styles.detailType}>{eventDetail.event_type_name}</span>
                )}
                {eventDetail.description && (
                  <p className={styles.detailDesc}>{eventDetail.description}</p>
                )}
              </div>
              {isAdmin && (
                <div className={styles.detailActions}>
                  <button className="btn-secondary" onClick={() => { setEditingEvent(eventDetail); setShowEventForm(true); }}>
                    עריכה
                  </button>
                  <button className="btn-remove" onClick={() => deleteEvent(eventDetail.id)}>
                    מחק אירוע
                  </button>
                </div>
              )}
            </div>

            {/* Optimize + Predict buttons */}
            {isAdmin && (
              <div className={styles.algoBar}>
                <button className="btn-primary" onClick={runOptimize} disabled={optimizing}>
                  {optimizing ? '⏳ מחשב...' : '⚡ שיבוץ מקסימלי'}
                </button>
                <button className="btn-secondary" onClick={() => { setPredictResult(null); setShowPredictModal(true); }}>
                  🔮 חיזוי סשן חדש
                </button>
                {optimizeResult && (() => {
                  const assigned = Object.values(optimizeResult.assignments).flat().length;
                  return assigned === 0 && optimizeResult.reasons?.length ? (
                    <span className={styles.optimizeWarn}>
                      לא שובץ אף עובד — {optimizeResult.reasons.join('; ')}
                    </span>
                  ) : (
                    <span className={styles.optimizeInfo}>
                      שובצו {assigned} עובדים · {optimizeResult.unassigned.length} לא שובצו
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Sessions */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>סשנים</h3>
                {isAdmin && (
                  <AddSessionInline eventId={eventDetail.id} authToken={authToken} onAdded={() => fetchEventDetail(eventDetail.id)} />
                )}
              </div>
              {eventDetail.sessions.length === 0 ? (
                <p className={styles.empty}>אין סשנים. הוסף סשן ראשון.</p>
              ) : (
                <div className={styles.sessionsList}>
                  {(() => {
                    const sessions = eventDetail.sessions;
                    const fixed = sessions.filter(s => s.participant_pct != null);
                    const free  = sessions.filter(s => s.participant_pct == null);
                    const usedPct = fixed.reduce((sum, s) => sum + s.participant_pct, 0);
                    const freePct = Math.max(0, 100 - usedPct);
                    const perFree = free.length ? Math.floor(freePct / free.length) : 0;
                    let rem = free.length ? freePct - perFree * free.length : 0;
                    const effectivePcts = {};
                    for (const s of sessions) {
                      effectivePcts[s.id] = s.participant_pct != null ? s.participant_pct : (perFree + (rem-- > 0 ? 1 : 0));
                    }
                    return sessions.map(session => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        effectivePct={effectivePcts[session.id]}
                        invitees={eventDetail.invitees}
                        isAdmin={isAdmin}
                        onAssign={(workerIds) => assignToSession(session.id, workerIds)}
                        onRemove={(wid) => removeFromSession(session.id, wid)}
                        onClearAll={(wids) => clearSessionAssignments(session.id, wids)}
                        onDelete={() => deleteSession(session.id)}
                        onEdited={() => fetchEventDetail(eventDetail.id)}
                        authToken={authToken}
                        eventId={eventDetail.id}
                        formatDate={formatDate}
                        formatTime={formatTime}
                      />
                    ));
                  })()}
                </div>
              )}
            </section>

            {/* Invitees */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>
                  מוזמנים ({eventDetail.invitees.length})
                  {unassignedInvitees.length > 0 && (
                    <span className={styles.unassignedBadge}>{unassignedInvitees.length} לא שובצו</span>
                  )}
                </h3>
                {isAdmin && (
                  <button className="btn-secondary" onClick={() => setShowInviteesModal(true)}>
                    ניהול מוזמנים
                  </button>
                )}
              </div>
              <div className={styles.inviteeSummary}>
                {eventDetail.invitees.length === 0 ? (
                  <span className={styles.empty}>אין מוזמנים</span>
                ) : (
                  eventDetail.invitees.map(inv => (
                    <span
                      key={inv.worker_id}
                      className={`${styles.inviteeChip} ${inv.attended ? styles.inviteeChipAttended : styles.inviteeChipMissing}`}
                      title={inv.attended ? 'שובץ לסשן' : 'לא שובץ עדיין'}
                    >
                      {inv.attended ? '✓' : '●'} {inv.worker_name}
                    </span>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── Event form modal ── */}
      {showEventForm && (
        <EventFormModal
          event={editingEvent}
          config={config}
          authToken={authToken}
          selectedBranchId={selectedBranchId}
          onSave={(saved) => {
            setShowEventForm(false);
            fetchEvents();
            setSelectedEvent(saved);
          }}
          onClose={() => setShowEventForm(false)}
        />
      )}

      {/* ── Conflict resolution modal ── */}
      {conflictData && (
        <ConflictModal
          conflicts={conflictData.conflicts}
          sessionId={conflictData.sessionId}
          onResolve={(orig, repl, asgId) => resolveConflict(conflictData.sessionId, orig, repl, asgId)}
          onClose={() => setConflictData(null)}
        />
      )}

      {/* ── Invitees modal ── */}
      {showInviteesModal && eventDetail && (
        <InviteesModal
          invitees={eventDetail.invitees}
          workers={workers}
          onSave={saveInvitees}
          onClose={() => setShowInviteesModal(false)}
          authToken={authToken}
          selectedBranchId={selectedBranchId}
        />
      )}

      {/* ── Predict modal ── */}
      {showPredictModal && (
        <PredictModal
          eventId={eventDetail?.id}
          authToken={authToken}
          result={predictResult}
          onResult={setPredictResult}
          onClose={() => setShowPredictModal(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DatePickerInput({ value, onChange, className }) {
  const ref = useRef(null);

  function shift(days) {
    const d = value ? new Date(value + 'T12:00:00') : new Date();
    d.setDate(d.getDate() + days);
    onChange(d.toISOString().slice(0, 10));
  }

  const display = value ? value.split('-').reverse().join('/') : '--/--/----';

  return (
    <span className={`${styles.datePickerWrap} ${className || ''}`}>
      <button type="button" className={styles.dateNavBtn} onClick={() => shift(-1)}>‹</button>
      <span className={styles.dateDisplay} onClick={() => ref.current?.showPicker()}>
        {display}
      </span>
      <input
        ref={ref}
        type="date"
        value={value || ''}
        onChange={e => { if (e.target.value) onChange(e.target.value); }}
        className={styles.hiddenDateInput}
      />
      <button type="button" className={styles.dateNavBtn} onClick={() => shift(1)}>›</button>
    </span>
  );
}

function TimePickerInput({ value, onChange, className }) {
  const [exactRaw, setExactRaw] = useState('');
  const [exactMode, setExactMode] = useState(false);
  const slots = Array.from({ length: 96 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  });

  const nearest = (() => {
    const [hh, mm] = (value || '00:00').split(':').map(Number);
    const total = hh * 60 + mm;
    const rounded = Math.round(total / 15) * 15;
    const nh = Math.min(23, Math.floor(rounded / 60));
    const nm = rounded % 60;
    return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
  })();

  function commitExact(v) {
    const match = v.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const nh = Math.min(23, parseInt(match[1]));
      const nm = Math.min(59, parseInt(match[2]));
      onChange(`${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`);
    }
    setExactMode(false);
    setExactRaw('');
  }

  return (
    <span className={`${styles.timePickerWrap} ${className || ''}`} dir="ltr">
      {exactMode ? (
        <input
          className={styles.timeExactInput}
          value={exactRaw}
          onChange={e => setExactRaw(e.target.value)}
          onBlur={e => commitExact(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setExactMode(false); setExactRaw(''); } }}
          placeholder={value?.slice(0,5)}
          maxLength={5}
          autoFocus
          dir="ltr"
        />
      ) : (
        <>
          <select value={nearest} onChange={e => onChange(e.target.value)} className={styles.timeSelect}>
            {slots.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className={styles.timeExactBtn} title="הקלד שעה מדויקת" onClick={() => { setExactRaw(value?.slice(0,5) || ''); setExactMode(true); }}>
            ✎
          </button>
        </>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({ session, effectivePct, invitees, isAdmin, onAssign, onRemove, onClearAll, onDelete, onEdited, authToken, eventId, formatDate, formatTime }) {
  const [addMode, setAddMode] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const assignedIds = new Set(session.assignments.map(a => a.worker_id));
  const eligible = invitees.filter(i => !assignedIds.has(i.worker_id));
  const filled = session.assignments.length;


  return (
    <>
    {editMode && (
      <SessionEditModal
        session={session}
        authToken={authToken}
        eventId={eventId}
        onSaved={() => { setEditMode(false); onEdited(); }}
        onClose={() => setEditMode(false)}
      />
    )}
    <div className={styles.sessionCard}>
      <div className={styles.sessionCardHeader}>
        <div className={styles.sessionCardInfo}>
          <span className={styles.sessionDate}>{formatDate(session.session_date)}</span>
          <span className={styles.sessionTime} dir="ltr">{formatTime(session.start_time)}–{formatTime(session.end_time)}</span>
          {session.location && <span className={styles.sessionLocation}>📍 {session.location}</span>}
        </div>
        <div className={styles.sessionCapacity}>
          <span className={`${styles.sessionPctBadge}${session.participant_pct == null ? ` ${styles.sessionPctBadgeAuto}` : ''}`}>
            {effectivePct}%
          </span>
          <span className={styles.capacityBar}>
            {filled} משובצים
          </span>
          {isAdmin && (
            <button className={styles.editSessionBtn} onClick={() => setEditMode(true)}>✎</button>
          )}
          {isAdmin && (
            <button className={`btn-remove ${styles.deleteSessionBtn}`} onClick={onDelete}>✕</button>
          )}
        </div>
      </div>

      {/* Assigned workers */}
      <div className={styles.assignedListHeader}>
        <span className={styles.assignedListLabel}>משובצים</span>
        {isAdmin && session.assignments.length > 0 && (
          <button
            className={styles.clearAllBtn}
            onClick={() => {
              if (confirm(`לנקות את כל ${session.assignments.length} המשובצים מסשן זה?`))
                onClearAll(session.assignments.map(a => a.worker_id));
            }}
          >
            נקה הכל
          </button>
        )}
      </div>
      <div className={styles.assignedList}>
        {session.assignments.length === 0 && <span className={styles.empty}>אין משובצים</span>}
        {session.assignments.map(a => (
          <span key={a.worker_id} className={styles.assignedChip}>
            {a.worker_name}
            {isAdmin && (
              <button className={styles.chipRemove} onClick={() => onRemove(a.worker_id)}>✕</button>
            )}
          </span>
        ))}
      </div>

      {/* Add workers */}
      {isAdmin && (
        <>
          {addMode ? (
            <div className={styles.addWorkerBar}>
              <select
                onChange={e => {
                  if (e.target.value) {
                    onAssign([parseInt(e.target.value)]);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>בחר עובד לשיבוץ...</option>
                {eligible.map(i => (
                  <option key={i.worker_id} value={i.worker_id}>
                    {i.worker_name}{i.attended ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              <button className="btn-secondary" onClick={() => setAddMode(false)}>סגור</button>
            </div>
          ) : (
            <button className={styles.addWorkerBtn} onClick={() => setAddMode(true)}>
              + שבץ עובד
            </button>
          )}
        </>
      )}
    </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SessionEditModal({ session, authToken, eventId, onSaved, onClose }) {
  const { modalRef, dragHandleProps, modalStyle, overlayClass, reset } = useDraggableModal();
  const close = () => { onClose(); reset(); };
  const [form, setForm] = useState({
    session_date: session.session_date?.slice(0, 10) || '',
    start_time:   session.start_time?.slice(0, 5) || '07:00',
    end_time:     session.end_time?.slice(0, 5) || '08:00',
    location:     session.location || '',
    participant_pct: session.participant_pct ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const pct = form.participant_pct === '' ? null : Math.min(100, Math.max(0, parseInt(form.participant_pct)));
      const res = await fetch(`/api/events/${eventId}/sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ ...form, max_capacity: 9999, participant_pct: pct }),
      });
      if (!res.ok) { alert('שגיאה בשמירה'); return; }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className={overlayClass} onClick={close}>
      <div className={styles.sessionEditModal} ref={modalRef} style={modalStyle} onClick={e => e.stopPropagation()}>
        <div className={styles.sessionEditHeader} {...dragHandleProps}>
          <div className={styles.sessionEditHeaderIcon}>📅</div>
          <h3 className={styles.sessionEditTitle}>עריכת סשן</h3>
          <button className={styles.sessionEditClose} onMouseDown={e => e.stopPropagation()} onClick={close}>✕</button>
        </div>

        <div className={styles.sessionEditBody}>

          <div className={styles.sessionEditField}>
            <label className={styles.sessionEditLabel}>תאריך</label>
            <DatePickerInput value={form.session_date} onChange={v => setForm(p => ({ ...p, session_date: v }))} />
          </div>

          <div className={styles.sessionEditField}>
            <label className={styles.sessionEditLabel}>שעות</label>
            <div className={styles.sessionEditTimeRow}>
              <TimePickerInput value={form.start_time} onChange={v => setForm(p => ({ ...p, start_time: v }))} className={styles.timePickerInput} />
              <span className={styles.sessionEditTimeDash}>–</span>
              <TimePickerInput value={form.end_time} onChange={v => setForm(p => ({ ...p, end_time: v }))} className={styles.timePickerInput} />
            </div>
          </div>

          <div className={styles.sessionEditField}>
            <label className={styles.sessionEditLabel}>מיקום</label>
            <input
              className={styles.sessionEditInput}
              value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              placeholder="אופציונלי..."
            />
          </div>

          <div className={styles.sessionEditField}>
            <label className={styles.sessionEditLabel}>% משתתפים</label>
            <div className={styles.sessionEditPctWrap}>
              <input
                className={styles.sessionEditPctInput}
                type="number" min="0" max="100"
                value={form.participant_pct}
                placeholder="אוטומטי"
                onChange={e => setForm(p => ({ ...p, participant_pct: e.target.value }))}
              />
              <span className={styles.sessionEditPctSuffix}>%</span>
              <span className={styles.sessionEditPctHint}>ריק = חלוקה שווה</span>
            </div>
          </div>

        </div>

        <div className={styles.sessionEditFooter}>
          <button className="btn-secondary" onClick={close}>ביטול</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AddSessionInline({ eventId, authToken, onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ session_date: '', start_time: '07:00', end_time: '08:00', max_capacity: 20, location: '' });

  async function submit() {
    if (!form.session_date || !form.start_time || !form.end_time) { alert('נא למלא תאריך ושעות'); return; }
    const res = await fetch(`/api/events/${eventId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(form),
    });
    if (res.ok) { setOpen(false); setForm({ session_date: '', start_time: '07:00', end_time: '08:00', max_capacity: 20, location: '' }); onAdded(); }
    else alert('שגיאה בהוספת סשן');
  }

  if (!open) return <button className="btn-secondary" onClick={() => setOpen(true)}>+ סשן חדש</button>;

  return (
    <div className={styles.addSessionForm}>
      <DatePickerInput value={form.session_date} onChange={v => setForm(p => ({ ...p, session_date: v }))} className={styles.datePickerInput} />
      <TimePickerInput value={form.start_time} onChange={v => setForm(p => ({ ...p, start_time: v }))} className={styles.timePickerInput} />
      <span className={styles.timeSep}>–</span>
      <TimePickerInput value={form.end_time} onChange={v => setForm(p => ({ ...p, end_time: v }))} className={styles.timePickerInput} />
      <input className={styles.editLocationInput} value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="מיקום..." />
      <button className="btn-primary" onClick={submit}>הוסף</button>
      <button className="btn-secondary" onClick={() => setOpen(false)}>ביטול</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function InviteesModal({ invitees, workers, onSave, onClose, authToken, selectedBranchId }) {
  const { modalRef, dragHandleProps, modalStyle, overlayClass, reset } = useDraggableModal();
  const close = () => { onClose(); reset(); };
  const attendedIds = new Set(invitees.filter(i => i.attended).map(i => i.worker_id));
  const [selected, setSelected] = useState(new Set(invitees.map(i => i.worker_id)));
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    fetch('/api/invitee-templates', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setTemplates)
      .catch(() => {});
  }, [authToken]);

  async function saveTemplate() {
    if (!templateName.trim()) return;
    const res = await fetch('/api/invitee-templates', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: templateName.trim(), worker_ids: [...selected] }),
    });
    if (res.ok) {
      const t = await res.json();
      setTemplates(prev => [...prev, t].sort((a, b) => a.name.localeCompare(b.name, 'he')));
      setTemplateName('');
      setShowSaveTemplate(false);
    }
  }

  async function deleteTemplate(id) {
    if (!confirm('למחוק תבנית זו?')) return;
    await fetch(`/api/invitee-templates/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  function loadTemplate(templateId) {
    const t = templates.find(t => t.id === parseInt(templateId));
    if (!t) return;
    setSelected(new Set([...attendedIds, ...t.worker_ids]));
  }

  const activeWorkers = (workers || []).filter(w => w.is_active !== false);
  const jobOptions = [...new Set(activeWorkers.map(w => w.job).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
  const filtered = activeWorkers.filter(w => {
    const name = `${w.first_name} ${w.family_name}`.toLowerCase();
    return name.includes(search.toLowerCase()) && (!jobFilter || w.job === jobFilter);
  });

  function toggle(id) {
    if (attendedIds.has(id)) return; // cannot remove attended
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(prev => new Set([...prev, ...filtered.map(w => w.id)]));
  }

  function clearAll() {
    const filteredIds = new Set(filtered.map(w => w.id));
    setSelected(prev => new Set([...prev].filter(id => attendedIds.has(id) || !filteredIds.has(id))));
  }

  const invited = filtered.filter(w => selected.has(w.id));
  const notInvited = filtered.filter(w => !selected.has(w.id));

  return (
    <div className={overlayClass} onClick={close}>
      <div className={styles.inviteesModal} ref={modalRef} style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.inviteesHeader} {...dragHandleProps}>
          <span className={styles.inviteesHeaderIcon}>👥</span>
          <div className={styles.inviteesHeaderText}>
            <h3 className={styles.inviteesHeaderTitle}>ניהול מוזמנים</h3>
            <span className={styles.inviteesHeaderCount}>{selected.size} נבחרו</span>
          </div>
          <button className={styles.inviteesCloseBtn} onMouseDown={e => e.stopPropagation()} onClick={close}>✕</button>
        </div>

        {/* Body */}
        <div className={styles.inviteesBody}>
          {/* Search + filter */}
          <div className={styles.inviteesSearchRow}>
            <input
              className={styles.inviteesSearch}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש שם..."
              autoFocus
            />
            <select
              className={styles.inviteesJobFilter}
              value={jobFilter}
              onChange={e => setJobFilter(e.target.value)}
            >
              <option value="">כל התפקידים</option>
              {jobOptions.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          {/* Quick actions */}
          <div className={styles.inviteesActions}>
            <button className={styles.inviteesActionBtn} onClick={selectAll}>בחר הכל</button>
            <button className={styles.inviteesActionBtn} onClick={clearAll}>נקה הכל</button>
          </div>

          {/* Templates */}
          <div className={styles.inviteesTemplateSection}>
            <span className={styles.inviteesTemplateSectionLabel}>תבניות:</span>
            <div className={styles.inviteesTemplateSectionContent}>
              {templates.length > 0 && (
                <div className={styles.inviteesTemplateChips}>
                  {templates.map(t => (
                    <span key={t.id} className={styles.inviteesTemplateChip}>
                      <button type="button" className={styles.inviteesTemplateChipName} title={`טען "${t.name}"`} onClick={() => loadTemplate(t.id)}>{t.name}</button>
                      <button type="button" className={styles.inviteesTemplateChipDel} title={`מחק "${t.name}"`} onClick={() => deleteTemplate(t.id)}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              {showSaveTemplate ? (
                <div className={styles.inviteesTemplateSaveRow}>
                  <input
                    className={styles.inviteesTemplateNameInput}
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="שם התבנית..."
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false); }}
                  />
                  <button className="btn-primary" onClick={saveTemplate}>שמור</button>
                  <button className="btn-secondary" onClick={() => setShowSaveTemplate(false)}>ביטול</button>
                </div>
              ) : (
                <button className={styles.inviteesTemplateSaveBtn} onClick={() => setShowSaveTemplate(true)}>+ שמור תבנית</button>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div className={styles.inviteesCheckList}>
            {filtered.length === 0 && <p className={styles.empty}>לא נמצאו עובדים</p>}
            {invited.length > 0 && (
              <div className={styles.inviteeSectionHeader}>
                <span>מוזמנים</span>
                <span className={styles.inviteeSectionCount}>{invited.length}</span>
              </div>
            )}
            {invited.map(w => (
              <label key={w.id} className={`${styles.inviteeCheckRow} ${attendedIds.has(w.id) ? styles.inviteeCheckAttended : ''}`}>
                <input type="checkbox" checked onChange={() => toggle(w.id)} disabled={attendedIds.has(w.id)} />
                <span className={styles.inviteeCheckName}>{w.first_name} {w.family_name}{w.job && <span className={styles.inviteeJob}>{w.job}</span>}</span>
                {attendedIds.has(w.id) && <span className={styles.attendedTag}>שובץ</span>}
              </label>
            ))}
            {notInvited.length > 0 && (
              <div className={styles.inviteeSectionHeader}>
                <span>שאר העובדים</span>
                <span className={styles.inviteeSectionCount}>{notInvited.length}</span>
              </div>
            )}
            {notInvited.map(w => (
              <label key={w.id} className={`${styles.inviteeCheckRow} ${styles.inviteeCheckRowDimmed}`}>
                <input type="checkbox" checked={false} onChange={() => toggle(w.id)} />
                <span className={styles.inviteeCheckName}>{w.first_name} {w.family_name}{w.job && <span className={styles.inviteeJob}>{w.job}</span>}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.inviteesFooter}>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-primary" onClick={() => onSave([...selected])}>שמור</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function EventFormModal({ event, config, authToken, selectedBranchId, onSave, onClose }) {
  const { modalRef, dragHandleProps, modalStyle, overlayClass, reset } = useDraggableModal();
  const close = () => { onClose(); reset(); };
  const [form, setForm] = useState({
    name: event?.name || '',
    event_type_id: event?.event_type_id || '',
    description: event?.description || '',
    branch_id: selectedBranchId || null,
  });
  const [sessions, setSessions] = useState(
    event?.sessions?.length
      ? event.sessions.map(s => ({ session_date: s.session_date?.slice(0, 10) || '', start_time: s.start_time?.slice(0, 5) || '', end_time: s.end_time?.slice(0, 5) || '', max_capacity: s.max_capacity, location: s.location || '' }))
      : [{ session_date: '', start_time: '07:00', end_time: '08:00', max_capacity: 20, location: '' }]
  );
  const [saving, setSaving] = useState(false);

  function addSessionRow() {
    setSessions(p => [...p, { session_date: '', start_time: '07:00', end_time: '08:00', max_capacity: 20, location: '' }]);
  }

  function removeSessionRow(i) {
    setSessions(p => p.filter((_, idx) => idx !== i));
  }

  function updateSession(i, key, val) {
    setSessions(p => p.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  }

  async function save() {
    const eventTypeName = eventTypes.find(et => String(et.id) === String(form.event_type_id))?.name || '';
    const resolvedName = form.name.trim() || eventTypeName;
    if (!resolvedName) { alert('נא להזין שם אירוע או לבחור סוג אירוע'); return; }
    setSaving(true);
    try {
      const method = event ? 'PUT' : 'POST';
      const url = event ? `/api/events/${event.id}` : '/api/events';
      const body = { ...form, name: resolvedName, sessions: event ? undefined : sessions };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { alert('שגיאה בשמירה'); return; }
      const saved = await res.json();
      onSave(saved);
    } finally {
      setSaving(false);
    }
  }

  const eventTypes = config?.event_types || [];

  return (
    <div className={overlayClass} onClick={close}>
      <div className={`assignment-modal ${styles.eventFormModal}`} ref={modalRef} style={modalStyle} onClick={e => e.stopPropagation()}>
        <div className="modal-header" {...dragHandleProps}>
          <h3>{event ? 'עריכת אירוע' : 'אירוע חדש'}</h3>
          <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={close}>✕</button>
        </div>
        <div className={`modal-body ${styles.eventFormBody}`}>
          <div className={styles.formRow2}>
            <div className={styles.formField}>
              <label>שם האירוע</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="שם האירוע..." autoFocus />
            </div>
            <div className={styles.formField}>
              <label>סוג אירוע</label>
              <select value={form.event_type_id} onChange={e => setForm(p => ({ ...p, event_type_id: e.target.value || null }))}>
                <option value="">— ללא סוג —</option>
                {eventTypes.map(et => (
                  <option key={et.id} value={et.id}>{et.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formField}>
            <label>תיאור</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="תיאור אופציונלי..." />
          </div>

          {!event && (
            <div className={styles.sessionsForm}>
              <div className={styles.sessionsFormHeader}>
                <label>סשנים</label>
                <button type="button" className="btn-secondary" onClick={addSessionRow}>+ סשן</button>
              </div>
              {sessions.map((s, i) => (
                <div key={i} className={styles.sessionFormRow}>
                  <DatePickerInput value={s.session_date} onChange={v => updateSession(i, 'session_date', v)} className={styles.datePickerInput} />
                  <TimePickerInput value={s.start_time} onChange={v => updateSession(i, 'start_time', v)} className={styles.timePickerInput} />
                  <span className={styles.timeSep}>–</span>
                  <TimePickerInput value={s.end_time} onChange={v => updateSession(i, 'end_time', v)} className={styles.timePickerInput} />
                  {sessions.length > 1 && (
                    <button type="button" className="btn-remove" onClick={() => removeSessionRow(i)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ConflictModal({ conflicts, sessionId, onResolve, onClose }) {
  const { modalRef, dragHandleProps, modalStyle, overlayClass, reset } = useDraggableModal();
  const close = () => { onClose(); reset(); };
  return (
    <div className={overlayClass} onClick={close}>
      <div className={`assignment-modal ${styles.conflictModal}`} ref={modalRef} style={modalStyle} onClick={e => e.stopPropagation()}>
        <div className="modal-header" {...dragHandleProps}>
          <h3>ניגוד לוז — נדרש מחליף</h3>
          <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          {conflicts.map(conflict => (
            <div key={conflict.workerId} className={styles.conflictItem}>
              <div className={styles.conflictWorkerName}>
                עובד #{conflict.workerId} משובץ כבר למשמרת:
              </div>
              <div className={styles.conflictAssignment}>
                {conflict.sessionAssignments.map(a => (
                  <span key={a.id} className={styles.conflictChip}>{a.site_name} ({a.shift_type})</span>
                ))}
              </div>
              {conflict.suggestions.length > 0 ? (
                <div>
                  <div className={styles.suggestionsLabel}>מחליפים מוצעים:</div>
                  <div className={styles.suggestionsList}>
                    {conflict.suggestions.map(s => (
                      <button
                        key={s.id}
                        className="btn-secondary"
                        onClick={() => onResolve(
                          conflict.workerId,
                          s.id,
                          conflict.sessionAssignments[0]?.id
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className={styles.noSuggestions}>לא נמצאו מחליפים זמינים</p>
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PredictModal({ eventId, authToken, result, onResult, onClose }) {
  const { modalRef, dragHandleProps, modalStyle, overlayClass, reset } = useDraggableModal();
  const close = () => { onClose(); reset(); };
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00');
  const [loading, setLoading] = useState(false);

  async function predict() {
    if (!date || !startTime || !endTime) { alert('נא למלא תאריך ושעות'); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/predict?date=${date}&startTime=${startTime}&endTime=${endTime}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.ok) onResult(await res.json());
      else alert('שגיאה בחיזוי');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={overlayClass} onClick={close}>
      <div className={`assignment-modal ${styles.predictModal}`} ref={modalRef} style={modalStyle} onClick={e => e.stopPropagation()}>
        <div className="modal-header" {...dragHandleProps}>
          <h3>חיזוי סשן חדש</h3>
          <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          <p className={styles.predictInfo}>כמה מוזמנים שעדיין לא השתתפו יכולים להגיע לסשן חדש?</p>
          <div className={styles.predictForm}>
            <label>תאריך</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <label>שעת התחלה</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            <label>שעת סיום</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            <button className="btn-primary" onClick={predict} disabled={loading}>
              {loading ? 'מחשב...' : 'חשב'}
            </button>
          </div>
          {result && (
            <div className={styles.predictResult}>
              <div className={styles.predictCount}>
                {result.count} עובדים יכולים להגיע
              </div>
              <ul className={styles.predictList}>
                {result.workers.map(w => (
                  <li key={w.id} className={w.has_conflict ? styles.predictConflict : ''}>
                    {w.name}
                    {w.has_conflict && <span className={styles.conflictTag}> (ניגוד משמרת)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}
