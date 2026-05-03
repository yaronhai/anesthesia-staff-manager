import { useState } from 'react';
import styles from '../styles/RolesManagement.module.scss';

const TIER_LABELS = { superadmin: 'מנהל ראשי', admin: 'מנהל סניף', user: 'משתמש' };
const TIER_COLORS = {
  superadmin: { bg: '#fee2e2', color: '#991b1b' },
  admin:      { bg: '#dbeafe', color: '#1e40af' },
  user:       { bg: '#f0fdf4', color: '#166534' },
};

export default function RolesManagement({ roles, authToken, onRolesChange }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newForm, setNewForm] = useState({ name: '', display_name: '', level: '', tier: 'user' });
  const [error, setError] = useState('');
  const [newError, setNewError] = useState('');

  async function saveEdit(id) {
    setError('');
    const res = await fetch(`/api/roles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      onRolesChange(roles.map(r => r.id === id ? updated : r).sort((a, b) => a.level - b.level));
      setEditingId(null);
    } else {
      const d = await res.json();
      setError(d.error || 'שגיאה');
    }
  }

  async function deleteRole(role) {
    if (!confirm(`למחוק את הסיווג "${role.display_name}"?`)) return;
    setError('');
    const res = await fetch(`/api/roles/${role.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      onRolesChange(roles.filter(r => r.id !== role.id));
    } else {
      const d = await res.json();
      setError(d.error || 'שגיאה');
    }
  }

  async function addRole() {
    setNewError('');
    if (!newForm.name.trim() || !newForm.display_name.trim() || !newForm.level) {
      setNewError('יש למלא את כל השדות');
      return;
    }
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ ...newForm, level: parseInt(newForm.level) }),
    });
    if (res.ok) {
      const created = await res.json();
      onRolesChange([...roles, created].sort((a, b) => a.level - b.level));
      setNewForm({ name: '', display_name: '', level: '', tier: 'user' });
    } else {
      const d = await res.json();
      setNewError(d.error || 'שגיאה');
    }
  }

  return (
    <div className={styles.root}>
      <p className={styles.desc}>
        רמות ההיררכיה קובעות מי יכול לערוך את מי. מספר רמה נמוך יותר = הרשאה גבוהה יותר. כל משתמש יכול לערוך רק משתמשים ברמה גבוהה ממנו.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th className={styles.th}>שם תצוגה</th>
            <th className={styles.th}>מזהה פנימי</th>
            <th className={styles.th}>רמה</th>
            <th className={styles.th}>יכולות</th>
            <th className={styles.th}>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {roles.map(role => (
            <tr key={role.id} className={styles.tr}>
              {editingId === role.id ? (
                <>
                  <td className={styles.td}>
                    <input
                      value={editForm.display_name}
                      onChange={e => setEditForm({ ...editForm, display_name: e.target.value })}
                      className={styles.input}
                    />
                  </td>
                  <td className={styles.td}><span className={styles.muted}>{role.name}</span></td>
                  <td className={styles.td}>
                    {role.is_protected
                      ? <span className={styles.muted}>{role.level}</span>
                      : <input
                          type="number"
                          value={editForm.level}
                          onChange={e => setEditForm({ ...editForm, level: e.target.value })}
                          className={styles.inputNarrow}
                        />
                    }
                  </td>
                  <td className={styles.td}>
                    {role.is_protected
                      ? <span className={styles.muted}>{TIER_LABELS[role.tier]}</span>
                      : <select
                          value={editForm.tier}
                          onChange={e => setEditForm({ ...editForm, tier: e.target.value })}
                          className={styles.input}
                        >
                          <option value="superadmin">מנהל ראשי</option>
                          <option value="admin">מנהל סניף</option>
                          <option value="user">משתמש</option>
                        </select>
                    }
                  </td>
                  <td className={styles.td}>
                    <button onClick={() => saveEdit(role.id)} className={styles.btnPrimary}>שמור</button>
                    <button onClick={() => setEditingId(null)} className={styles.btnSecondaryMargin}>ביטול</button>
                  </td>
                </>
              ) : (
                <>
                  <td className={styles.td}>
                    {role.display_name}
                    {role.is_protected && <span className={styles.lockBadge}>🔒</span>}
                  </td>
                  <td className={styles.tdMuted}>{role.name}</td>
                  <td className={styles.td}>{role.level}</td>
                  <td className={styles.td}>
                    <span
                      className={styles.tierBadge}
                      style={{ '--badge-bg': TIER_COLORS[role.tier]?.bg, '--badge-color': TIER_COLORS[role.tier]?.color }}
                    >
                      {TIER_LABELS[role.tier]}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <button
                      onClick={() => { setEditingId(role.id); setEditForm({ display_name: role.display_name, level: role.level, tier: role.tier }); setError(''); }}
                      className={styles.btnSecondary}
                    >✏️ ערוך</button>
                    {!role.is_protected && (
                      <button onClick={() => deleteRole(role)} className={styles.btnDelete}>🗑️</button>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.addSection}>
        <div className={styles.addTitle}>הוספת סיווג חדש</div>
        {newError && <p className={styles.error}>{newError}</p>}
        <div className={styles.addRow}>
          <label className={styles.label}>
            שם תצוגה
            <input value={newForm.display_name} onChange={e => setNewForm({ ...newForm, display_name: e.target.value })} className={styles.input} placeholder="לדוגמה: מנהל אזור" />
          </label>
          <label className={styles.label}>
            מזהה פנימי
            <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} className={styles.input} placeholder="e.g. area_manager" />
          </label>
          <label className={styles.label}>
            רמה (מספר)
            <input type="number" value={newForm.level} onChange={e => setNewForm({ ...newForm, level: e.target.value })} className={styles.inputNarrow} placeholder="150" />
          </label>
          <label className={styles.label}>
            יכולות
            <select value={newForm.tier} onChange={e => setNewForm({ ...newForm, tier: e.target.value })} className={styles.input}>
              <option value="superadmin">מנהל ראשי</option>
              <option value="admin">מנהל סניף</option>
              <option value="user">משתמש</option>
            </select>
          </label>
          <button onClick={addRole} className={`${styles.btnPrimary} ${styles.btnAddAlign}`}>+ הוסף</button>
        </div>
      </div>
    </div>
  );
}
