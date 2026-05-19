import { useState, useEffect, useMemo } from 'react';
import styles from '../styles/SurgeonsManagement.module.scss';

const API = import.meta.env.DEV ? 'http://localhost:5001' : '';

export default function SurgeonsManagement({ authToken, branchId, config }) {
  const [surgeons, setSurgeons] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedSurgeon, setSelectedSurgeon] = useState(null);
  const [clusterWorkers, setClusterWorkers] = useState([]);

  const [newName, setNewName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [addError, setAddError] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editGroupId, setEditGroupId] = useState('');

  const [addWorkerId, setAddWorkerId] = useState('');
  const [clusterError, setClusterError] = useState('');
  const [workerSearch, setWorkerSearch] = useState('');
  const defaultJobId = useMemo(() => {
    const j = (config?.jobs || []).find(j => j.name === 'רופא מרדים');
    return j ? String(j.id) : '';
  }, [config?.jobs]);
  const [jobFilter, setJobFilter] = useState(defaultJobId);

  const activityGroups = config?.activity_type_groups || [];
  const authHeader = { Authorization: `Bearer ${authToken}` };
  const jsonHeaders = { ...authHeader, 'Content-Type': 'application/json' };
  const bq = `branch_id=${branchId}`;

  async function fetchSurgeons() {
    const r = await fetch(`${API}/api/surgeons?${bq}`, { headers: authHeader });
    if (r.ok) setSurgeons(await r.json());
  }

  async function fetchWorkers() {
    const r = await fetch(`${API}/api/workers?${bq}`, { headers: authHeader });
    if (r.ok) setWorkers(await r.json());
  }

  async function fetchCluster(surgeonId) {
    const r = await fetch(`${API}/api/surgeons/${surgeonId}/cluster?${bq}`, { headers: authHeader });
    if (r.ok) setClusterWorkers(await r.json());
  }

  useEffect(() => {
    Promise.all([fetchSurgeons(), fetchWorkers()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    if (selectedSurgeon) {
      fetchCluster(selectedSurgeon.id);
      setAddWorkerId('');
      setClusterError('');
      setWorkerSearch('');
    } else {
      setClusterWorkers([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurgeon]);

  async function handleAddSurgeon(e) {
    e.preventDefault();
    setAddError('');
    if (!newName.trim()) { setAddError('נדרש שם'); return; }
    const r = await fetch(`${API}/api/surgeons?${bq}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: newName.trim(), activity_type_group_id: newGroupId || null }),
    });
    if (r.ok) {
      setNewName('');
      setNewGroupId('');
      fetchSurgeons();
    } else {
      const d = await r.json();
      setAddError(d.error || 'שגיאה');
    }
  }

  async function handleDeleteSurgeon(id) {
    if (!window.confirm('למחוק רופא זה?')) return;
    await fetch(`${API}/api/surgeons/${id}?${bq}`, { method: 'DELETE', headers: authHeader });
    if (selectedSurgeon?.id === id) setSelectedSurgeon(null);
    fetchSurgeons();
  }

  function startEdit(surgeon) {
    setEditingId(surgeon.id);
    setEditName(surgeon.name);
    setEditGroupId(surgeon.activity_type_group_id || '');
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return;
    const r = await fetch(`${API}/api/surgeons/${id}?${bq}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ name: editName.trim(), activity_type_group_id: editGroupId || null }),
    });
    if (r.ok) { setEditingId(null); fetchSurgeons(); }
  }

  async function handleAddToClusterById(workerId) {
    setClusterError('');
    const r = await fetch(`${API}/api/surgeons/${selectedSurgeon.id}/cluster?${bq}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ worker_id: Number(workerId) }),
    });
    if (r.ok) {
      setAddWorkerId('');
      fetchCluster(selectedSurgeon.id);
    } else {
      const d = await r.json();
      setClusterError(d.error || 'שגיאה');
    }
  }

  async function handleRemoveFromCluster(workerId) {
    await fetch(`${API}/api/surgeons/${selectedSurgeon.id}/cluster/${workerId}?${bq}`, { method: 'DELETE', headers: authHeader });
    fetchCluster(selectedSurgeon.id);
  }

  const jobs = config?.jobs || [];
  const filteredSurgeons = groupFilter ? surgeons.filter(s => String(s.activity_type_group_id) === groupFilter) : surgeons;
  const clusterWorkerIds = new Set(clusterWorkers.map(w => w.worker_id));
  const filteredByJob = jobFilter ? workers.filter(w => String(w.job_id) === jobFilter) : workers;
  const searchTerm = workerSearch.trim().toLowerCase();
  const availableWorkers = filteredByJob.filter(w =>
    !clusterWorkerIds.has(w.id) &&
    (!searchTerm || `${w.family_name} ${w.first_name}`.toLowerCase().includes(searchTerm))
  );

  return (
    <div className={styles.root}>
      <div className={styles.sections}>
        {/* Surgeons list */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><h2>רופאים מנתחים</h2></div>
          <div className={styles.cardBody}>
            <select className={styles.groupFilter} value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
              <option value="">— כל הקבוצות —</option>
              {activityGroups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
            </select>
            {addError && <div className={styles.error}>{addError}</div>}
            <form className={styles.addForm} onSubmit={handleAddSurgeon}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="שם הרופא" />
              <select value={newGroupId} onChange={e => setNewGroupId(e.target.value)}>
                <option value="">— קבוצת פעילות —</option>
                {activityGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button type="submit" className={styles.btnPrimary}>הוסף</button>
            </form>
            {filteredSurgeons.length === 0
              ? <div className={styles.empty}>{surgeons.length === 0 ? 'אין רופאים מוגדרים' : 'אין רופאים בקבוצה זו'}</div>
              : (
                <div className={styles.list}>
                  {filteredSurgeons.map(s => (
                    <div
                      key={s.id}
                      className={`${styles.listItem}${selectedSurgeon?.id === s.id ? ` ${styles.selected}` : ''}`}
                      onClick={() => setSelectedSurgeon(selectedSurgeon?.id === s.id ? null : s)}
                    >
                      {editingId === s.id ? (
                        <div className={styles.editForm} onClick={e => e.stopPropagation()}>
                          <input value={editName} onChange={e => setEditName(e.target.value)} />
                          <select value={editGroupId} onChange={e => setEditGroupId(e.target.value)}>
                            <option value="">— קבוצה —</option>
                            {activityGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                          <button className={styles.btnPrimary} onClick={() => handleSaveEdit(s.id)}>שמור</button>
                          <button className={styles.btnSecondary} onClick={() => setEditingId(null)}>ביטול</button>
                        </div>
                      ) : (
                        <>
                          <span className={styles.listItemName}>{s.name}</span>
                          {s.group_name && <span className={styles.listItemGroup}>{s.group_name}</span>}
                          <div className={styles.listItemActions} onClick={e => e.stopPropagation()}>
                            <button className={styles.btnSecondary} onClick={() => startEdit(s)}>✏️</button>
                            <button className={styles.btnDelete} onClick={() => handleDeleteSurgeon(s.id)}>🗑</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>

        {/* Cluster management */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><h2>אשכול עובדים</h2></div>
          <div className={styles.cardBody}>
            {!selectedSurgeon
              ? <div className={styles.selectPrompt}>בחר רופא מהרשימה לניהול האשכול שלו</div>
              : (
                <>
                  <div className={styles.clusterHeader}>
                    <span>אשכול של:</span>
                    <span className={styles.surgeonName}>{selectedSurgeon.name}</span>
                  </div>
                  {clusterError && <div className={styles.error}>{clusterError}</div>}
                  <div className={styles.workerTagsLabel}>עובדים באשכול</div>
                  <div className={styles.workerTags}>
                    {clusterWorkers.length === 0
                      ? <span className={styles.noCluster}>אין עובדים באשכול</span>
                      : clusterWorkers.map(w => (
                        <div key={w.worker_id} className={styles.workerTag}>
                          <span>{w.family_name} {w.first_name}</span>
                          <button className={styles.workerTagRemove} onClick={() => handleRemoveFromCluster(w.worker_id)}>✕</button>
                        </div>
                      ))
                    }
                  </div>
                  <div className={styles.addWorkerSection}>
                    <div className={styles.addWorkerLabel}>הוסף עובד לאשכול</div>
                  <div className={styles.addWorkerForm}>
                    <div className={styles.filterRow}>
                      <select value={jobFilter} onChange={e => { setJobFilter(e.target.value); setAddWorkerId(''); setWorkerSearch(''); }} className={styles.jobFilter}>
                        <option value="">— כל התפקידים —</option>
                        {jobs.map(j => <option key={j.id} value={String(j.id)}>{j.name}</option>)}
                      </select>
                    <div className={styles.searchWrapper}>
                      <span className={styles.searchIcon}>🔍</span>
                      <input
                        value={workerSearch}
                        onChange={e => { setWorkerSearch(e.target.value); setAddWorkerId(''); }}
                        placeholder="חיפוש שם..."
                      />
                    </div>
                    </div>
                    <div className={styles.workerPickList}>
                      {availableWorkers.length === 0
                        ? <span className={styles.noCluster}>אין עובדים להצגה</span>
                        : availableWorkers.map(w => (
                          <div
                            key={w.id}
                            className={styles.workerPickItem}
                            onClick={() => { setAddWorkerId(String(w.id)); handleAddToClusterById(w.id); }}
                          >
                            {w.family_name} {w.first_name}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                  </div>
                </>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
}
