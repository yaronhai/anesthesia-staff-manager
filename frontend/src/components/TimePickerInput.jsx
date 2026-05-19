import { useState } from 'react';
import styles from '../styles/TimePickerInput.module.scss';

const SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

export default function TimePickerInput({ value, onChange, className }) {
  const [exactRaw, setExactRaw] = useState('');
  const [exactMode, setExactMode] = useState(false);

  const nearest = (() => {
    const [hh, mm] = (value || '00:00').split(':').map(Number);
    const total = hh * 60 + mm;
    const rounded = Math.round(total / 15) * 15;
    const nh = Math.min(23, Math.floor(rounded / 60));
    const nm = rounded % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  })();

  function commitExact(v) {
    const match = v.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const nh = Math.min(23, parseInt(match[1]));
      const nm = Math.min(59, parseInt(match[2]));
      onChange(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`);
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
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'Escape') { setExactMode(false); setExactRaw(''); }
          }}
          placeholder={value?.slice(0, 5)}
          maxLength={5}
          autoFocus
          dir="ltr"
        />
      ) : (
        <>
          <select value={nearest} onChange={e => onChange(e.target.value)} className={styles.timeSelect}>
            {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            type="button"
            className={styles.timeExactBtn}
            title="הקלד שעה מדויקת"
            onClick={() => { setExactRaw(value?.slice(0, 5) || ''); setExactMode(true); }}
          >✎</button>
        </>
      )}
    </span>
  );
}
