import { useState } from 'react';

export default function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
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
        body: JSON.stringify({ email }),
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
    <div className="login-box">
      <h2>שכחתי סיסמא</h2>
      {sent ? (
        <div className="forgot-sent">
          <p>אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס הסיסמא.</p>
          <p className="forgot-sent-note">בדוק את תיבת הדואר שלך (כולל ספאם).</p>
          <button className="btn-secondary" onClick={onClose}>חזרה לכניסה</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>אימייל</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
              placeholder="name@hospital.com"
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
          </button>
          <button type="button" className="btn-link" onClick={onClose}>חזרה לכניסה</button>
        </form>
      )}
    </div>
  );
}
