import { useState } from 'react';
import ForgotPasswordModal from './ForgotPasswordModal';

export default function LoginModal({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onLogin(data.token, data.user);
    } catch {
      setError('שגיאת חיבור לשרת');
    } finally {
      setLoading(false);
    }
  }

  if (showForgotPassword) {
    return <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />;
  }

  return (
    <div className="login-box">
      <h2>כניסה למערכת</h2>
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label>שם משתמש</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="form-group">
          <label>סיסמא</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'מתחבר...' : 'כניסה'}
        </button>
        <button type="button" className="btn-link" onClick={() => setShowForgotPassword(true)}>
          שכחתי סיסמא
        </button>
      </form>
    </div>
  );
}
