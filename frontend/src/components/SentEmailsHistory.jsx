import { useState, useEffect } from 'react';
import styles from '../styles/SentEmailsHistory.module.scss';

export default function SentEmailsHistory({ authToken, branchId }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchEmails();
  }, [days, branchId, authToken]);

  async function fetchEmails() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days });
      if (branchId) params.set('branch_id', branchId);
      const res = await fetch(`/api/sent-emails?${params}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setEmails(await res.json());
      }
    } catch (err) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const sentCount = emails.filter(e => e.status === 'sent').length;
  const failedCount = emails.filter(e => e.status === 'failed').length;

  return (
    <div className={styles.root}>
      <div className={styles.filterRow}>
        <div>
          <label className={styles.filterLabel}>הראה מ-</label>
          <select value={days} onChange={e => setDays(parseInt(e.target.value))} className={styles.filterSelect}>
            <option value="7">7 ימים אחרונים</option>
            <option value="30">30 ימים אחרונים</option>
            <option value="90">90 ימים אחרונים</option>
            <option value="365">שנה אחרונה</option>
          </select>
        </div>
        <button onClick={fetchEmails} disabled={loading} className={styles.refreshBtn}>
          {loading ? '...טוען' : '🔄 רענן'}
        </button>
        <div className={styles.summary}>
          סה"כ: <span className={styles.summaryTotal}>{emails.length}</span> •
          <span className={styles.summarySent}> נשלח: {sentCount}</span> •
          <span className={styles.summaryFailed}> כשל: {failedCount}</span>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className={styles.emptyState}>
          <p>אין הודעות בתקופה זו</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>תאריך שליחה</th>
                <th className={styles.th}>תאריך תוכנית</th>
                <th className={styles.th}>שם עובד</th>
                <th className={styles.th}>אימייל</th>
                <th className={styles.th}>נושא</th>
                <th className={styles.th}>סטטוס</th>
                {emails.some(e => e.status === 'failed') && (
                  <th className={styles.th}>הערה</th>
                )}
              </tr>
            </thead>
            <tbody>
              {emails.map(email => (
                <tr
                  key={email.id}
                  className={styles.tr}
                  style={{ '--row-bg': email.status === 'failed' ? '#fef2f2' : 'white' }}
                >
                  <td className={styles.tdDate}>{formatDate(email.created_at)}</td>
                  <td className={styles.tdText}>{email.schedule_date}</td>
                  <td className={styles.tdText}>{email.first_name} {email.family_name}</td>
                  <td className={styles.tdEmail}>{email.recipient_email}</td>
                  <td className={styles.tdSmall}>{email.subject}</td>
                  <td className={styles.tdStatus}>
                    <span
                      className={styles.statusBadge}
                      style={{
                        '--badge-bg': email.status === 'sent' ? '#dcfce7' : '#fef2f2',
                        '--badge-color': email.status === 'sent' ? '#166534' : '#991b1b',
                      }}
                    >
                      {email.status === 'sent' ? '✓ נשלח' : '✕ כשל'}
                    </span>
                  </td>
                  {emails.some(e => e.status === 'failed') && (
                    <td className={styles.tdError}>
                      {email.error_message && <span title={email.error_message}>{email.error_message.substring(0, 30)}...</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
