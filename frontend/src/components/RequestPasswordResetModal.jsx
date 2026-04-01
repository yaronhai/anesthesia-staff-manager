import { useState } from 'react';

export default function RequestPasswordResetModal({ currentUser, onClose }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSent(true);
    } catch {
      setError('שגיאת חיבור לשרת');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-box" onClick={e => e.stopPropagation()}>
        <h2>איפוס סיסמא</h2>
        {sent ? (
          <div className="forgot-sent">
            <p>קישור לאיפוס הסיסמא נשלח אל {currentUser.email}</p>
            <p className="forgot-sent-note">בדוק את תיבת הדואר שלך (כולל ספאם).</p>
            <button className="btn-secondary" onClick={onClose}>סגור</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <p>קישור לאיפוס הסיסמא ישלח אל:</p>
            <p className="reset-email"><strong>{currentUser.email}</strong></p>
            {error && <p className="error-msg">{error}</p>}
            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'שולח...' : 'שלח קישור'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
