import { useState, useEffect } from 'react';
import WorkerList from './components/WorkerList';
import WorkerForm from './components/WorkerForm';
import AdminPanel from './components/AdminPanel';
import ShiftRequests from './components/ShiftRequests';
import DailyRoomView from './components/DailyRoomView';
import BranchOverview from './components/BranchOverview';
import Dashboard from './components/Dashboard';
import LoginModal from './components/LoginModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import VacationRequests from './components/VacationRequests';
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
  const [config, setConfig] = useState({ jobs: [], employment_types: [], honorifics: [], site_groups: [], sites: [], activity_types: [], shift_types: [], preference_types: [] });
  const [filterJobId, setFilterJobId] = useState('');
  const [filterEmpTypeId, setFilterEmpTypeId] = useState('');
  const [filterActive, setFilterActive] = useState('active');
  const [filterBranchType, setFilterBranchType] = useState('primary');
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;

  // Build query string for branch-scoped API calls
  function branchParam() {
    if (isSuperAdmin && selectedBranchId) return `?branch_id=${selectedBranchId}`;
    return '';
  }

  function authHeaders() {
    return { Authorization: `Bearer ${authToken}` };
  }

  useEffect(() => {
    if (!currentUser) return;
    if (isSuperAdmin) {
      fetchBranches();
      setActiveTab('overview');
    } else if (isAdmin) {
      setSelectedBranchId(currentUser.branch_id ?? null);
      fetchBranches();
      fetchWorkers();
      fetchConfig();
    } else {
      setActiveTab('shifts');
      fetchConfig();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !isSuperAdmin) return;
    if (selectedBranchId) {
      fetchWorkers();
      fetchConfig();
      setActiveTab('workers');
    } else {
      setActiveTab('overview');
      setWorkers([]);
    }
  }, [selectedBranchId]);

  async function fetchBranches() {
    const res = await fetch('/api/branches', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setBranches(data);
    }
  }

  async function fetchConfig() {
    const res = await fetch(`/api/config${branchParam()}`, { headers: authHeaders() });
    if (res.ok) setConfig(await res.json());
  }

  async function fetchWorkers() {
    const res = await fetch(`${API}${branchParam()}`, { headers: authHeaders() });
    if (res.ok) {
      setWorkers(await res.json());
    }
  }

  async function handleSave(data) {
    let res;
    if (editing) {
      res = await fetch(`${API}/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
      });
    } else {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data),
      });
    }
    if (!res.ok) {
      const d = await res.json();
      return d.error;
    }
    setEditing(null);
    setShowForm(false);
    fetchWorkers();
  }

  async function handleDelete(id) {
    if (!window.confirm('למחוק עובד זה?')) return;
    await fetch(`${API}/${id}`, { method: 'DELETE', headers: authHeaders() });
    fetchWorkers();
  }

  async function handleResetPassword(id) {
    try {
      const res = await fetch(`/api/auth/reset-worker-password/${id}`, {
        method: 'POST',
        headers: authHeaders(),
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
    setBranches([]);
    setSelectedBranchId(null);
  }

  function handlePasswordChanged() {
    const updated = { ...currentUser, must_change_password: 0 };
    localStorage.setItem('currentUser', JSON.stringify(updated));
    setCurrentUser(updated);
  }

  function handleBranchSelect(id) {
    setSelectedBranchId(id ? parseInt(id) : null);
    setWorkers([]);
    setConfig({ jobs: [], employment_types: [], honorifics: [], site_groups: [], sites: [], activity_types: [], shift_types: [], preference_types: [] });
  }

  function handleBranchesChange(newBranches) {
    setBranches(newBranches);
  }

  const filteredWorkers = workers.filter(w =>
    (!filterJobId     || w.job_id             === Number(filterJobId)) &&
    (!filterEmpTypeId || w.employment_type_id === Number(filterEmpTypeId)) &&
    (filterActive === 'all' || (filterActive === 'active' ? w.is_active !== false : w.is_active === false)) &&
    (filterBranchType === 'all' || (filterBranchType === 'primary' ? w.is_primary_branch !== false : w.is_primary_branch === false))
  );

  const selectedBranchName = branches.find(b => b.id === selectedBranchId)?.name;
  const currentUserBranchName = branches.find(b => b.id === currentUser?.branch_id)?.name;

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="app">
        <header>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <img src={logoAssuta} alt="Assuta" className="logo-assuta" style={{width: '60px', height: 'auto'}} />
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
            <img src={logoAssuta} alt="Assuta" className="logo-assuta" style={{width: '60px', height: 'auto'}} />
            <div>
              <h1>מחלקת הרדמה</h1>
              <p className="subtitle">ניהול צוות</p>
            </div>
          </div>
        </header>
        <ChangePasswordModal token={authToken} onSuccess={handlePasswordChanged} onSkip={handlePasswordChanged} />
      </div>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header>
        <img src={logoAssuta} alt="Assuta" className="logo-assuta" style={{width: '100px', height: 'auto'}} />
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1}}>
          <h1>מחלקת הרדמה</h1>
          <p className="subtitle">ניהול צוות</p>
          {isAdmin && !isSuperAdmin && currentUserBranchName && (
            <span style={{fontSize: '0.78rem', fontWeight: 600, opacity: 0.85, marginTop: '2px'}}>
              {currentUserBranchName}
            </span>
          )}
        </div>
        <div className="header-right">
          {isSuperAdmin && (
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <span style={{fontSize: '0.78rem', opacity: 0.7}}>סניף:</span>
              <select
                value={selectedBranchId ?? ''}
                onChange={e => handleBranchSelect(e.target.value || null)}
                style={{fontSize: '0.82rem', padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#fff', color: '#1a2e4a', cursor: 'pointer', fontWeight: 500}}
              >
                <option value="">— כל הסניפים —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          {isAdmin && activeTab === 'workers' && selectedBranchId && (
            <button onClick={handleAdd} className="btn-primary">+ הוסף עובד</button>
          )}
          {isAdmin && (
            <button onClick={() => setShowSettings(true)} className="btn-settings">⚙️</button>
          )}
          <div className="header-user">
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
              <span className="header-username">{currentUser.displayName || currentUser.username}</span>
              <span className="header-role">
                {isSuperAdmin ? 'מנהל ראשי' : isAdmin ? 'מנהל סניף' : 'משתמש'}
              </span>
            </div>
            <button onClick={handleLogout} className="btn-logout">יציאה</button>
          </div>
        </div>
      </header>

      <div className="tabs">
        {isSuperAdmin && (
          <button
            className={`tab-btn${activeTab === 'overview' ? ' active' : ''}`}
            onClick={() => { setActiveTab('overview'); handleBranchSelect(null); }}
          >
            Dashboard
          </button>
        )}
        {isAdmin && selectedBranchId && (
          <button
            className={`tab-btn${activeTab === 'workers' ? ' active' : ''}`}
            onClick={() => setActiveTab('workers')}
          >
            ניהול עובדים
          </button>
        )}
        {(!isSuperAdmin || selectedBranchId) && (
          <button
            className={`tab-btn${activeTab === 'shifts' ? ' active' : ''}`}
            onClick={() => setActiveTab('shifts')}
          >
            בקשות משמרות
          </button>
        )}
        {(!isSuperAdmin || selectedBranchId) && (
          <button
            className={`tab-btn${activeTab === 'vacations' ? ' active' : ''}`}
            onClick={() => setActiveTab('vacations')}
          >
            בקשות חופשה
          </button>
        )}
        {isAdmin && selectedBranchId && (
          <button
            className={`tab-btn${activeTab === 'rooms' ? ' active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            שיבוצים לחדרים
          </button>
        )}
      </div>

      {showSettings && isAdmin && (
        <AdminPanel
          config={config}
          authToken={authToken}
          branchId={selectedBranchId}
          isSuperAdmin={isSuperAdmin}
          branches={branches}
          onConfigChange={setConfig}
          onBranchesChange={handleBranchesChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {activeTab === 'overview' && isSuperAdmin && (
        <Dashboard
          authToken={authToken}
          onSelectBranch={id => handleBranchSelect(id)}
        />
      )}

      {activeTab === 'workers' && isAdmin && selectedBranchId && (
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
            <select value={filterActive} onChange={e => setFilterActive(e.target.value)}>
              <option value="active">פעילים</option>
              <option value="inactive">לא פעילים</option>
              <option value="all">כולם</option>
            </select>
            <select value={filterBranchType} onChange={e => setFilterBranchType(e.target.value)}>
              <option value="primary">ראשי בסניף</option>
              <option value="secondary">מושאלים</option>
              <option value="all">כולם</option>
            </select>
            {(filterJobId || filterEmpTypeId || filterActive !== 'active' || filterBranchType !== 'primary') && (
              <button className="btn-secondary"
                onClick={() => { setFilterJobId(''); setFilterEmpTypeId(''); setFilterActive('active'); setFilterBranchType('primary'); }}>
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
              isSuperAdmin={isSuperAdmin}
              authToken={authToken}
            />
          )}
          <WorkerList
            workers={filteredWorkers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onResetPassword={handleResetPassword}
            authToken={authToken}
            config={config}
            isSuperAdmin={isSuperAdmin}
            currentBranchId={selectedBranchId}
          />
        </>
      )}

      {activeTab === 'shifts' && (
        <ShiftRequests currentUser={currentUser} token={authToken} config={config} selectedBranchId={selectedBranchId} />
      )}

      {activeTab === 'vacations' && (
        <VacationRequests currentUser={currentUser} token={authToken} selectedBranchId={selectedBranchId} workers={workers} />
      )}

      {activeTab === 'rooms' && isAdmin && selectedBranchId && (
        <DailyRoomView config={config} authToken={authToken} branchId={selectedBranchId} />
      )}
    </div>
  );
}
