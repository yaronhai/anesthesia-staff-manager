import { useState, useRef } from 'react';
import { useDraggableModal } from '../hooks/useDraggableModal';
import styles from '../styles/WorkerList.module.scss';

export const COLUMN_LABELS = {
  title: 'תואר',
  name: 'שם',
  id_number: 'ת.ז.',
  classification: 'סיווג',
  job: 'תפקיד',
  employment_type: 'סוג העסקה',
  phone: 'טלפון',
  email: 'אימייל ארגוני',
  personal_email: 'אימייל פרטי',
};

export const NAME_FORMAT_LABELS = {
  family_first: 'שם משפחה + שם פרטי (כהן ישראל)',
  first_family: 'שם פרטי + שם משפחה (ישראל כהן)',
  family_only: 'שם משפחה בלבד',
  first_only: 'שם פרטי בלבד',
};

export const DEFAULT_COLUMN_ORDER = ['title', 'name', 'id_number', 'classification', 'job', 'employment_type', 'phone', 'email', 'personal_email'];
export const DEFAULT_NAME_FORMAT = 'family_first';

export default function WorkerColumnSettings({ prefs, onSave, onClose }) {
  const { modalRef, dragHandleProps, modalStyle, overlayClass, reset } = useDraggableModal();
  const [order, setOrder] = useState(prefs.column_order || DEFAULT_COLUMN_ORDER);
  const [nameFormat, setNameFormat] = useState(prefs.name_format || DEFAULT_NAME_FORMAT);
  const [hidden, setHidden] = useState(new Set(prefs.hidden_columns || []));
  const dragIdx = useRef(null);

  function toggleVisible(colId) {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }

  function handleDragStart(e, idx) {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const newOrder = [...order];
    const [moved] = newOrder.splice(dragIdx.current, 1);
    newOrder.splice(idx, 0, moved);
    dragIdx.current = idx;
    setOrder(newOrder);
  }

  function handleDragEnd() {
    dragIdx.current = null;
  }

  function moveUp(idx) {
    if (idx === 0) return;
    const newOrder = [...order];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    setOrder(newOrder);
  }

  function moveDown(idx) {
    if (idx === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
    setOrder(newOrder);
  }

  function handleSave() {
    onSave({ name_format: nameFormat, column_order: order, hidden_columns: [...hidden] });
    reset();
    onClose();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <div className={overlayClass} onClick={handleClose}>
      <div className="detail-modal" ref={modalRef} style={{ maxWidth: '420px', ...modalStyle }} onClick={e => e.stopPropagation()}>
        <div className="settings-header" {...dragHandleProps}>
          <h2>הגדרות עמודות</h2>
          <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.colSettingsBody}>
          <div className={styles.colSettingsSection}>
            <h4 className={styles.colSettingsSectionTitle}>פורמט שם</h4>
            <div className={styles.nameFormatList}>
              {Object.entries(NAME_FORMAT_LABELS).map(([key, label]) => (
                <label key={key} className={styles.nameFormatOption}>
                  <input
                    type="radio"
                    name="nameFormat"
                    value={key}
                    checked={nameFormat === key}
                    onChange={() => setNameFormat(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.colSettingsSection}>
            <h4 className={styles.colSettingsSectionTitle}>עמודות <span className={styles.colSettingsHint}>(סמן להצגה • גרור לשינוי סדר)</span></h4>
            <ul className={styles.colOrderList}>
              {order.map((colId, idx) => {
                const visible = !hidden.has(colId);
                return (
                  <li
                    key={colId}
                    className={`${styles.colOrderItem}${!visible ? ` ${styles.colOrderItemHidden}` : ''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleVisible(colId)}
                      className={styles.colVisibleCheck}
                      onClick={e => e.stopPropagation()}
                    />
                    <span className={styles.colDragHandle}>⠿</span>
                    <span className={`${styles.colOrderLabel}${!visible ? ` ${styles.colOrderLabelHidden}` : ''}`}>
                      {colId === 'name' ? `שם (${NAME_FORMAT_LABELS[nameFormat]?.split(' ')[0] || 'שם'})` : COLUMN_LABELS[colId]}
                    </span>
                    <div className={styles.colOrderArrows}>
                      <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0} className={styles.colArrowBtn} title="הזז למעלה">▲</button>
                      <button type="button" onClick={() => moveDown(idx)} disabled={idx === order.length - 1} className={styles.colArrowBtn} title="הזז למטה">▼</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className={styles.colSettingsNote}>עמודת פעולות תמיד מוצגת בסוף</p>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-secondary" onClick={handleClose}>ביטול</button>
          <button className="btn-primary" onClick={handleSave}>שמור</button>
        </div>
      </div>
    </div>
  );
}
