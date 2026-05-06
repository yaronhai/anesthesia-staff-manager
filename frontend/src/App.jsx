import { useState, useEffect, useRef, useCallback } from 'react';
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
import SpecialDaysCalendar from './components/SpecialDaysCalendar';
import Messaging from './components/Messaging';
import EventsManagement from './components/EventsManagement';
import MonthlyReport from './components/MonthlyReport';
import UserProfile from './components/UserProfile';
import ProfileChangeRequests from './components/ProfileChangeRequests';
import logoAssuta from './assets/logo-assuta.png';
import './styles/App.scss';
import appStyles from './styles/App.module.scss';

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
  const [filterBranchType, setFilterBranchType] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [roles, setRoles] = useState([]);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingProfileCount, setPendingProfileCount] = useState(0);

  const isSuperAdmin = (currentUser?.role_tier ?? currentUser?.role) === 'superadmin';
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role_tier ?? currentUser?.role);

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
    fetchRoles();
    if (isSuperAdmin) {
      fetchBranches();
      setActiveTab('overview');
    } else if (isAdmin) {
      setSelectedBranchId(currentUser.branch_id ?? null);
      fetchBranches();
      fetchWorkers();
      fetchConfig();
    } else {
      setSelectedBranchId(currentUser.branch_id ?? null);
      setActiveTab('shifts');
      fetchConfig();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [currentUser, authToken]);

  useEffect(() => {
    if (!currentUser || !isAdmin) return;
    fetchPendingProfileCount();
    const interval = setInterval(fetchPendingProfileCount, 30000);
    return () => clearInterval(interval);
  }, [currentUser, authToken, isAdmin]);

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

  async function fetchUnreadCount() {
    if (!authToken) return;
    try {
      const res = await fetch('/api/messages/conversations', { headers: authHeaders() });
      if (res.ok) {
        const convs = await res.json();
        setUnreadMessages(convs.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0));
      }
    } catch {}
  }

  async function fetchPendingProfileCount() {
    if (!authToken) return;
    try {
      const res = await fetch('/api/profile/change-requests/pending-count', { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setPendingProfileCount(d.count || 0);
      }
    } catch {}
  }

  async function fetchBranches() {
    const res = await fetch('/api/branches', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setBranches(data);
    }
  }

  async function fetchRoles() {
    const res = await fetch('/api/roles', { headers: authHeaders() });
    if (res.ok) setRoles(await res.json());
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

  const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
  const inactivityTimer = useRef(null);

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => handleLogout(), INACTIVITY_TIMEOUT);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      clearTimeout(inactivityTimer.current);
    };
  }, [authToken, resetInactivityTimer]);

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

  const filteredWorkers = workers.filter(w => {
    const q = filterSearch.trim().toLowerCase();
    const searchOk = !q || (
      (w.first_name  || '').toLowerCase().includes(q) ||
      (w.family_name || '').toLowerCase().includes(q) ||
      (w.id_number   || '').toLowerCase().includes(q) ||
      (w.email       || '').toLowerCase().includes(q) ||
      (w.phone       || '').toLowerCase().includes(q)
    );
    return searchOk &&
      (!filterJobId     || w.job_id             === Number(filterJobId)) &&
      (!filterEmpTypeId || w.employment_type_id === Number(filterEmpTypeId)) &&
      (filterActive === 'all' || (filterActive === 'active' ? w.is_active !== false : w.is_active === false)) &&
      (filterBranchType === 'all' || (filterBranchType === 'primary' ? w.is_primary_branch !== false : w.is_primary_branch === false));
  });

  const selectedBranchName = branches.find(b => b.id === selectedBranchId)?.name;
  const currentUserBranchName = branches.find(b => b.id === currentUser?.branch_id)?.name;

  function handlePrintReport() {
    const branchName = selectedBranchName || '';
    const now = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
    const activeCount = filteredWorkers.filter(w => w.is_active !== false).length;
    const inactiveCount = filteredWorkers.length - activeCount;
    const jobGroups = {};
    filteredWorkers.forEach(w => {
      const j = w.job || 'לא מוגדר';
      jobGroups[j] = (jobGroups[j] || 0) + 1;
    });
    const summaryBadges = Object.entries(jobGroups)
      .map(([job, count]) => `<span class="badge badge-job">${job} <b>${count}</b></span>`).join('');

    const activeFilterLabels = [
      filterSearch ? `חיפוש: "${filterSearch}"` : null,
      filterJobId ? `תפקיד: ${config.jobs.find(j => j.id === Number(filterJobId))?.name || ''}` : null,
      filterEmpTypeId ? `סוג העסקה: ${config.employment_types.find(t => t.id === Number(filterEmpTypeId))?.name || ''}` : null,
      filterActive === 'active' ? 'פעילים בלבד' : filterActive === 'inactive' ? 'לא פעילים בלבד' : null,
      filterBranchType === 'primary' ? 'ראשיים בסניף' : filterBranchType === 'secondary' ? 'מושאלים בלבד' : null,
    ].filter(Boolean);
    const filtersHtml = activeFilterLabels.length
      ? `<div class="filters-row"><span class="filters-label">פילטרים פעילים:</span>${activeFilterLabels.map(f => `<span class="filter-tag">${f}</span>`).join('')}</div>`
      : `<div class="filters-row"><span class="filters-label">ללא סינון — כל העובדים</span></div>`;

    const rows = filteredWorkers.map((w, i) => {
      const isActive = w.is_active !== false;
      const isPrimary = w.is_primary_branch !== false;
      return `<tr>
        <td class="num">${i + 1}</td>
        <td class="name">${w.title || ''} ${w.first_name || ''} ${w.family_name || ''}</td>
        <td>${w.id_number || ''}</td>
        <td><span class="pill pill-job">${w.job || '—'}</span></td>
        <td>${w.employment_type || '—'}</td>
        <td dir="ltr">${w.phone || '—'}</td>
        <td>${w.email || '—'}</td>
        <td><span class="pill ${isActive ? 'pill-active' : 'pill-inactive'}">${isActive ? 'פעיל' : 'לא פעיל'}</span></td>
        <td><span class="pill ${isPrimary ? 'pill-primary' : 'pill-secondary'}">${isPrimary ? 'ראשי' : 'מושאל'}</span></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>דו"ח עובדים – ${branchName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5px; background: #f0f4f8; color: #1a2e4a; }
  .page { background: #fff; max-width: 100%; padding: 14px 18px 10px; }

  /* ── Header ── */
  .header { display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(135deg, #1a2e4a 0%, #2563eb 100%);
    color: #fff; border-radius: 8px; padding: 10px 16px; margin-bottom: 10px; }
  .header-title { font-size: 15px; font-weight: 700; letter-spacing: 0.3px; }
  .header-sub { font-size: 9px; opacity: 0.82; margin-top: 2px; }
  .header-meta { text-align: left; font-size: 9px; opacity: 0.88; line-height: 1.6; }

  /* ── Summary strip ── */
  .summary { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; flex-wrap: wrap; }
  .stat-box { background: #f0f4f8; border-right: 3px solid #2563eb; border-radius: 5px;
    padding: 4px 10px; font-size: 9px; }
  .stat-box b { font-size: 13px; color: #2563eb; display: block; line-height: 1.2; }
  .badge { display: inline-block; background: #e8f0fe; color: #2563eb; border-radius: 20px;
    padding: 2px 8px; font-size: 8.5px; margin: 2px; }
  .badge b { color: #1a2e4a; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1a2e4a; }
  th { color: #fff; padding: 4px 6px; font-size: 8.5px; font-weight: 600;
    text-align: right; white-space: nowrap; }
  th:first-child { border-radius: 0 5px 5px 0; width: 22px; }
  th:last-child  { border-radius: 5px 0 0 5px; }
  td { padding: 3px 6px; border-bottom: 1px solid #e8edf3; vertical-align: middle; }
  td.num { color: #94a3b8; font-size: 8px; text-align: center; }
  td.name { font-weight: 600; color: #1a2e4a; }
  tr:nth-child(even) td { background: #f7f9fc; }
  tr:hover td { background: #eef3ff; }

  /* ── Pills ── */
  .pill { display: inline-block; border-radius: 20px; padding: 1px 7px;
    font-size: 8px; font-weight: 600; white-space: nowrap; }
  .pill-job      { background: #dbeafe; color: #1d4ed8; }
  .pill-active   { background: #dcfce7; color: #166534; }
  .pill-inactive { background: #fee2e2; color: #991b1b; }
  .pill-primary  { background: #ede9fe; color: #5b21b6; }
  .pill-secondary{ background: #fef3c7; color: #92400e; }

  /* ── Filters row ── */
  .filters-row { display: flex; align-items: center; flex-wrap: wrap; gap: 5px;
    background: #f8faff; border: 1px solid #dbeafe; border-radius: 6px;
    padding: 4px 10px; margin-bottom: 8px; font-size: 8.5px; }
  .filters-label { color: #64748b; font-weight: 600; margin-left: 4px; }
  .filter-tag { background: #2563eb; color: #fff; border-radius: 20px;
    padding: 1px 8px; font-size: 8px; font-weight: 500; }

  /* ── Footer ── */
  .footer { margin-top: 8px; font-size: 8px; color: #94a3b8; text-align: left;
    border-top: 1px solid #e2e8f0; padding-top: 4px; }

  @media print {
    body { background: #fff; }
    .page { padding: 6px 10px; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pill, .badge, .stat-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="header-title">דו"ח עובדים — ${branchName}</div>
      <div class="header-sub">מחלקת הרדמה · ניהול צוות</div>
    </div>
    <div class="header-meta">
      תאריך: ${now}<br>
      סה"כ עובדים: <b>${filteredWorkers.length}</b>
    </div>
  </div>

  ${filtersHtml}
  <div class="summary">
    <div class="stat-box"><b>${filteredWorkers.length}</b>סה"כ</div>
    <div class="stat-box"><b style="color:#166534">${activeCount}</b>פעילים</div>
    ${inactiveCount ? `<div class="stat-box"><b style="color:#991b1b">${inactiveCount}</b>לא פעילים</div>` : ''}
    <div style="flex:1"></div>
    ${summaryBadges}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>שם</th><th>ת.ז.</th><th>תפקיד</th><th>סוג העסקה</th>
        <th>טלפון</th><th>אימייל</th><th>סטטוס</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">הופק: ${now} · ${filteredWorkers.length} רשומות</div>
</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:-9999px;';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="app">
        <header>
          <div className={appStyles.loginHeaderRow}>
            <img src={logoAssuta} alt="Assuta" className={`logo-assuta ${appStyles.logoSmall}`} />
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

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header>
        <img src={logoAssuta} alt="Assuta" className={`logo-assuta ${appStyles.logoMain}`} />
        <div className={appStyles.headerTitleCol}>
          <h1>מחלקת הרדמה</h1>
          <p className="subtitle">ניהול צוות</p>
          {isAdmin && !isSuperAdmin && currentUserBranchName && (
            <span className={appStyles.headerBranchName}>
              {currentUserBranchName}
            </span>
          )}
        </div>
        <div className="header-right">
          {isSuperAdmin && (
            <div className={`header-branch-select ${appStyles.headerBranchSelectWrap}`}>
              <span className={appStyles.headerBranchLabel}>סניף:</span>
              <select
                value={selectedBranchId ?? ''}
                onChange={e => handleBranchSelect(e.target.value || null)}
                className={appStyles.branchDropdown}
              >
                <option value="">— כל הסניפים —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {isAdmin && (
            <button onClick={() => setShowSettings(true)} className="btn-settings">⚙️</button>
          )}
          <div className="header-user">
            <div className={appStyles.headerUserInfo}>
              <span className="header-username">{currentUser.displayName || currentUser.username}</span>
              <span className="header-role">
                {isSuperAdmin ? 'מנהל ראשי' : isAdmin ? 'מנהל סניף' : 'משתמש'}
              </span>
              {!isSuperAdmin && currentUser.branch_name && (
                <span className={appStyles.headerUserBranch}>
                  {currentUser.branch_name}
                </span>
              )}
            </div>
            <button onClick={() => setShowChangePassword(true)} className={`btn-link ${appStyles.changePwBtn}`}>שינוי סיסמא</button>
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
        {currentUser?.worker_id && (!isSuperAdmin || selectedBranchId) && (
          <button
            className={`tab-btn${activeTab === 'profile' ? ' active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            הפרופיל שלי
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
        {isAdmin && selectedBranchId && (
          <button
            className={`tab-btn${activeTab === 'events' ? ' active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            אירועים
          </button>
        )}
        {isAdmin && selectedBranchId && (
          <button
            className={`tab-btn${activeTab === 'special-days' ? ' active' : ''}`}
            onClick={() => setActiveTab('special-days')}
          >
            ימים מיוחדים
          </button>
        )}
        {isAdmin && selectedBranchId && (
          <button
            className={`tab-btn${activeTab === 'report' ? ' active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            דוח חודשי
          </button>
        )}
        {isAdmin && selectedBranchId && (
          <button
            className={`tab-btn${activeTab === 'profile-requests' ? ' active' : ''} ${appStyles.messagesTabBtn}`}
            onClick={() => setActiveTab('profile-requests')}
          >
            עדכון פרופיל
            {pendingProfileCount > 0 && activeTab !== 'profile-requests' && (
              <span className={appStyles.unreadBadge}>{pendingProfileCount}</span>
            )}
          </button>
        )}
        {selectedBranchId && (
          <button
            className={`tab-btn${activeTab === 'messages' ? ' active' : ''} ${appStyles.messagesTabBtn}`}
            onClick={() => setActiveTab('messages')}
          >
            💬 הודעות
            {unreadMessages > 0 && activeTab !== 'messages' && (
              <span className={appStyles.unreadBadge}>{unreadMessages}</span>
            )}
          </button>
        )}
      </div>

      {showChangePassword && (
        <div className="modal-overlay">
          <ChangePasswordModal
            token={authToken}
            onSuccess={() => setShowChangePassword(false)}
            onClose={() => setShowChangePassword(false)}
          />
        </div>
      )}

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
          roles={roles}
          onRolesChange={setRoles}
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
            <button onClick={handleAdd} className={`btn-primary ${appStyles.addWorkerBtn}`} title="הוסף עובד">＋</button>
            <input
              type="text"
              placeholder="חיפוש לפי שם / ת.ז. / אימייל / טלפון"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className={appStyles.searchInput}
            />
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
            {(filterSearch || filterJobId || filterEmpTypeId || filterActive !== 'active' || filterBranchType !== 'all') && (
              <button className="btn-secondary"
                onClick={() => { setFilterSearch(''); setFilterJobId(''); setFilterEmpTypeId(''); setFilterActive('active'); setFilterBranchType('all'); }}>
                נקה סינון
              </button>
            )}
            <button className={`btn-secondary ${appStyles.reportBtn}`} onClick={handlePrintReport}>🖨 דו"ח עובדים</button>
          </div>

          {showForm && (
            <WorkerForm
              initial={editing}
              config={config}
              onSave={handleSave}
              onCancel={handleCancel}
              isSuperAdmin={isSuperAdmin}
              authToken={authToken}
              branches={branches}
              roles={roles}
              currentUser={currentUser}
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
            roles={roles}
          />
        </>
      )}

      {activeTab === 'shifts' && (
        <ShiftRequests currentUser={currentUser} token={authToken} config={config} selectedBranchId={selectedBranchId} />
      )}

      {activeTab === 'vacations' && (
        <VacationRequests currentUser={currentUser} token={authToken} selectedBranchId={selectedBranchId} workers={workers} />
      )}

      {isAdmin && selectedBranchId && (
        <div className={appStyles.roomsTab} style={{ '--rooms-display': activeTab === 'rooms' ? 'block' : 'none' }}>
          <DailyRoomView config={config} authToken={authToken} branchId={selectedBranchId} />
        </div>
      )}

      {activeTab === 'special-days' && isAdmin && selectedBranchId && (
        <div className="special-days-wrap">
          <h2 className="special-days-title">ניהול ימים מיוחדים</h2>
          <SpecialDaysCalendar
            config={config}
            authToken={authToken}
            branchId={selectedBranchId}
            onConfigChange={setConfig}
          />
        </div>
      )}

      {activeTab === 'events' && isAdmin && selectedBranchId && (
        <EventsManagement
          workers={workers}
          config={config}
          authToken={authToken}
          currentUser={currentUser}
          selectedBranchId={selectedBranchId}
        />
      )}

      {activeTab === 'messages' && selectedBranchId && (
        <Messaging authToken={authToken} currentUser={currentUser} workers={workers} branchId={selectedBranchId} />
      )}

      {activeTab === 'report' && isAdmin && selectedBranchId && (
        <MonthlyReport token={authToken} config={config} isAdmin={isAdmin} branchId={selectedBranchId} />
      )}

      {activeTab === 'profile' && currentUser?.worker_id && (
        <UserProfile
          authToken={authToken}
          currentUser={currentUser}
          config={config}
          inline
        />
      )}

      {activeTab === 'profile-requests' && isAdmin && selectedBranchId && (
        <ProfileChangeRequests
          authToken={authToken}
          onDecision={fetchPendingProfileCount}
        />
      )}
    </div>
  );
}
