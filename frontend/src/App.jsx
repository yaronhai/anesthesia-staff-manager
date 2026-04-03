import { useState, useEffect } from 'react';
import WorkerList from './components/WorkerList';
import WorkerForm from './components/WorkerForm';
import AdminPanel from './components/AdminPanel';
import ShiftRequests from './components/ShiftRequests';
import MonthlyReport from './components/MonthlyReport';
import DailyRoomView from './components/DailyRoomView';
import LoginModal from './components/LoginModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import logoAssuta from './assets/logo-assuta.png';
import './App.css';

const API = '/api/workers';

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem('currentUser');
    return s ? JSON.parse(s) : null;
  });

  const [activeTab, setActiveTab] = useState('workers');
  const [workers, setWorkers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({ jobs: [], employment_types: [], honorifics: [], site_groups: [], sites: [] });
  const [filterJobId, setFilterJobId] = useState('');
  const [filterEmpTypeId, setFilterEmpTypeId] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!currentUser) return;
    fetchWorkers();
    fetchConfig();
    // Non-admins always land on the shifts tab
    if (!isAdmin) setActiveTab('shifts');
  }, [currentUser]);

  async function fetchConfig() {
    const res = await fetch('/api/config', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) setConfig(await res.json());
  }

  async function fetchWorkers() {
    const res = await fetch(API, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) setWorkers(await res.json());
  }

  async function handleSave(data) {
    let res;
    if (editing) {
      res = await fetch(`${API}/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(data),
      });
    } else {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(data),
      });
    }
    if (!res.ok) {
      const d = await res.json();
      return d.error; // return error string to form
    }
    setEditing(null);
    setShowForm(false);
    fetchWorkers();
  }

  async function handleDelete(id) {
    if (!window.confirm('למחוק עובד זה?')) return;
    await fetch(`${API}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    fetchWorkers();
  }

  async function handleResetPassword(id) {
    try {
      const res = await fetch(`/api/auth/reset-worker-password/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert('שגיאה: ' + (data.error || 'איפוס נכשל'));
      } else {
        alert('סיסמא אופסה בהצלחה לתעודת הזהות של העובד');
      }
    } catch {
      alert('שגיאת חיבור לשרת');
    }
  }

  function handleEdit(worker) { setEditing(worker); setShowForm(true); }
  function handleAdd()        { setEditing(null);   setShowForm(true); }
  function handleCancel()     { setEditing(null);   setShowForm(false); }

  function handleLogin(token, user) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setAuthToken(token);
    setCurrentUser(user);
  }

  function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    setAuthToken(null);
    setCurrentUser(null);
    setActiveTab('workers');
  }

  function handlePasswordChanged() {
    const updated = { ...currentUser, must_change_password: 0 };
    localStorage.setItem('currentUser', JSON.stringify(updated));
    setCurrentUser(updated);
  }

  const filteredWorkers = workers.filter(w =>
    (!filterJobId     || w.job_id             === Number(filterJobId)) &&
    (!filterEmpTypeId || w.employment_type_id === Number(filterEmpTypeId))
  );

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="app">
        <header>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <img src={logoAssuta} alt="Assuta" className="logo-assuta" style={{width: '120px', height: 'auto'}} />
            <div>
              <h1>מחלקת הרדמה</h1>
              <p className="subtitle">ניהול צוות</p>
            </div>
          </div>
        </header>
        <LoginModal onLogin={handleLogin} />
      </div>
    );
  }

  // ── Must change password ───────────────────────────────────────────────────
  if (currentUser.must_change_password) {
    return (
      <div className="app">
        <header>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <img src={logoAssuta} alt="Assuta" className="logo-assuta" style={{width: '120px', height: 'auto'}} />
            <div>
              <h1>מחלקת הרדמה</h1>
              <p className="subtitle">ניהול צוות</p>
            </div>
          </div>
        </header>
        <ChangePasswordModal token={authToken} onSuccess={handlePasswordChanged} />
      </div>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header>
        <img src={logoAssuta} alt="Assuta" className="logo-assuta" style={{width: '200px', height: 'auto'}} />
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1}}>
          <h1>מחלקת הרדמה</h1>
          <p className="subtitle">ניהול צוות</p>
        </div>
        <div className="header-right">
          {isAdmin && activeTab === 'workers' && (
            <button onClick={handleAdd} className="btn-primary">+ הוסף עובד</button>
          )}
          {isAdmin && (
            <button onClick={() => setShowSettings(true)} className="btn-settings">⚙️</button>
          )}
          <div className="header-user">
            <span className="header-username">{currentUser.displayName || currentUser.username}</span>
            <button onClick={handleLogout} className="btn-logout">יציאה</button>
          </div>
        </div>
      </header>

      <div className="tabs">
        {isAdmin && (
          <button
            className={`tab-btn${activeTab === 'workers' ? ' active' : ''}`}
            onClick={() => setActiveTab('workers')}
          >
            ניהול עובדים
          </button>
        )}
        <button
          className={`tab-btn${activeTab === 'shifts' ? ' active' : ''}`}
          onClick={() => setActiveTab('shifts')}
        >
          בקשות משמרות
        </button>
        {isAdmin && (
          <button
            className={`tab-btn${activeTab === 'report' ? ' active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            דו"ח חודשי
          </button>
        )}
        {isAdmin && (
          <button
            className={`tab-btn${activeTab === 'rooms' ? ' active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            שיבוצים לחדרים
          </button>
        )}
      </div>

      {showSettings && isAdmin && (
        <AdminPanel config={config} authToken={authToken} onConfigChange={setConfig} onClose={() => setShowSettings(false)} />
      )}

      {activeTab === 'workers' && isAdmin && (
        <>
          <div className="filters">
            <select value={filterJobId} onChange={e => setFilterJobId(e.target.value)}>
              <option value="">כל התפקידים</option>
              {config.jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
            <select value={filterEmpTypeId} onChange={e => setFilterEmpTypeId(e.target.value)}>
              <option value="">כל סוגי ההעסקה</option>
              {config.employment_types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {(filterJobId || filterEmpTypeId) && (
              <button className="btn-secondary"
                onClick={() => { setFilterJobId(''); setFilterEmpTypeId(''); }}>
                נקה סינון
              </button>
            )}
          </div>

          {showForm && (
            <WorkerForm
              initial={editing}
              config={config}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
          <WorkerList workers={filteredWorkers} onEdit={handleEdit} onDelete={handleDelete} onResetPassword={handleResetPassword} />
        </>
      )}

      {activeTab === 'shifts' && (
        <ShiftRequests currentUser={currentUser} token={authToken} />
      )}

      {activeTab === 'report' && isAdmin && (
        <MonthlyReport token={authToken} />
      )}

      {activeTab === 'rooms' && isAdmin && (
        <DailyRoomView config={config} authToken={authToken} />
      )}
    </div>
  );
}
