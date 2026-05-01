import { useState } from 'react';

const TIER_LABELS = { superadmin: 'מנהל ראשי', admin: 'מנהל סניף', user: 'משתמש' };

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
    <div style={{ direction: 'rtl' }}>
      <p style={{ color: '#4b5563', fontSize: '0.85rem', marginBottom: '1rem' }}>
        רמות ההיררכיה קובעות מי יכול לערוך את מי. מספר רמה נמוך יותר = הרשאה גבוהה יותר. כל משתמש יכול לערוך רק משתמשים ברמה גבוהה ממנו.
      </p>

      {error && <p style={{ color: '#dc2626', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', textAlign: 'right' }}>
            <th style={thStyle}>שם תצוגה</th>
            <th style={thStyle}>מזהה פנימי</th>
            <th style={thStyle}>רמה</th>
            <th style={thStyle}>יכולות</th>
            <th style={thStyle}>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {roles.map(role => (
            <tr key={role.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              {editingId === role.id ? (
                <>
                  <td style={tdStyle}>
                    <input
                      value={editForm.display_name}
                      onChange={e => setEditForm({ ...editForm, display_name: e.target.value })}
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}><span style={{ color: '#9ca3af' }}>{role.name}</span></td>
                  <td style={tdStyle}>
                    {role.is_protected
                      ? <span style={{ color: '#9ca3af' }}>{role.level}</span>
                      : <input
                          type="number"
                          value={editForm.level}
                          onChange={e => setEditForm({ ...editForm, level: e.target.value })}
                          style={{ ...inputStyle, width: '70px' }}
                        />
                    }
                  </td>
                  <td style={tdStyle}>
                    {role.is_protected
                      ? <span style={{ color: '#9ca3af' }}>{TIER_LABELS[role.tier]}</span>
                      : <select
                          value={editForm.tier}
                          onChange={e => setEditForm({ ...editForm, tier: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="superadmin">מנהל ראשי</option>
                          <option value="admin">מנהל סניף</option>
                          <option value="user">משתמש</option>
                        </select>
                    }
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => saveEdit(role.id)} style={btnPrimary}>שמור</button>
                    <button onClick={() => setEditingId(null)} style={{ ...btnSecondary, marginRight: '0.3rem' }}>ביטול</button>
                  </td>
                </>
              ) : (
                <>
                  <td style={tdStyle}>
                    {role.display_name}
                    {role.is_protected && <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginRight: '0.4rem' }}>🔒</span>}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280' }}>{role.name}</td>
                  <td style={tdStyle}>{role.level}</td>
                  <td style={tdStyle}><span style={tierBadge(role.tier)}>{TIER_LABELS[role.tier]}</span></td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => { setEditingId(role.id); setEditForm({ display_name: role.display_name, level: role.level, tier: role.tier }); setError(''); }}
                      style={btnSecondary}
                    >✏️ ערוך</button>
                    {!role.is_protected && (
                      <button onClick={() => deleteRole(role)} style={{ ...btnDelete, marginRight: '0.3rem' }}>🗑️</button>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>הוספת סיווג חדש</div>
        {newError && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{newError}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={labelStyle}>
            שם תצוגה
            <input value={newForm.display_name} onChange={e => setNewForm({ ...newForm, display_name: e.target.value })} style={inputStyle} placeholder="לדוגמה: מנהל אזור" />
          </label>
          <label style={labelStyle}>
            מזהה פנימי
            <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} style={inputStyle} placeholder="e.g. area_manager" />
          </label>
          <label style={labelStyle}>
            רמה (מספר)
            <input type="number" value={newForm.level} onChange={e => setNewForm({ ...newForm, level: e.target.value })} style={{ ...inputStyle, width: '80px' }} placeholder="150" />
          </label>
          <label style={labelStyle}>
            יכולות
            <select value={newForm.tier} onChange={e => setNewForm({ ...newForm, tier: e.target.value })} style={inputStyle}>
              <option value="superadmin">מנהל ראשי</option>
              <option value="admin">מנהל סניף</option>
              <option value="user">משתמש</option>
            </select>
          </label>
          <button onClick={addRole} style={{ ...btnPrimary, alignSelf: 'flex-end' }}>+ הוסף</button>
        </div>
      </div>
    </div>
  );
}

function tierBadge(tier) {
  const colors = {
    superadmin: { background: '#fee2e2', color: '#991b1b' },
    admin:      { background: '#dbeafe', color: '#1e40af' },
    user:       { background: '#f0fdf4', color: '#166534' },
  };
  return { ...colors[tier], padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 };
}

const thStyle = { padding: '0.4rem 0.6rem', fontWeight: 600, fontSize: '0.8rem', color: '#374151' };
const tdStyle = { padding: '0.45rem 0.6rem', verticalAlign: 'middle' };
const inputStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' };
const btnPrimary = { padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '0.82rem' };
const btnSecondary = { padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.82rem' };
const btnDelete = { padding: '4px 8px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontSize: '0.82rem' };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.82rem', fontWeight: 500, color: '#374151' };
