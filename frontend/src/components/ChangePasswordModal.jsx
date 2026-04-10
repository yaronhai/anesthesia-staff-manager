import { useState } from 'react';

export default function ChangePasswordModal({ token, onSuccess, onSkip }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) { setError('הסיסמאות אינן תואמות'); return; }
    if (newPassword.length < 6) { setError('הסיסמא חייבת להכיל לפחות 6 תווים'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSuccess();
    } catch {
      setError('שגיאת חיבור לשרת');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-box">
      <h2>שינוי סיסמא</h2>
      <p className="change-pw-notice">כניסה ראשונה — יש לבחור סיסמא חדשה</p>
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label>סיסמא חדשה</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="form-group">
          <label>אימות סיסמא</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'שומר...' : 'שמור סיסמא'}
        </button>
        {onSkip && (
          <button type="button" className="btn-link" onClick={onSkip} disabled={loading}>
            דלג
          </button>
        )}
      </form>
    </div>
  );
}
