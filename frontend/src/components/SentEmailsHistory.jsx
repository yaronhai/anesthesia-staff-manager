import { useState, useEffect } from 'react';

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
    <div style={{ direction: 'rtl', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.9rem', color: '#6b7280' }}>הראה מ-</label>
          <select value={days} onChange={e => setDays(parseInt(e.target.value))} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', marginRight: '0.5rem' }}>
            <option value="7">7 ימים אחרונים</option>
            <option value="30">30 ימים אחרונים</option>
            <option value="90">90 ימים אחרונים</option>
            <option value="365">שנה אחרונה</option>
          </select>
        </div>
        <button onClick={fetchEmails} disabled={loading} style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
          {loading ? '...טוען' : '🔄 רענן'}
        </button>
        <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#6b7280' }}>
          סה"כ: <span style={{ fontWeight: 600, color: '#1a2e4a' }}>{emails.length}</span> •
          <span style={{ color: '#059669', fontWeight: 600, marginRight: '0.5rem' }}> נשלח: {sentCount}</span> •
          <span style={{ color: '#dc2626', fontWeight: 600, marginRight: '0.5rem' }}> כשל: {failedCount}</span>
        </div>
      </div>

      {emails.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
          <p>אין הודעות בתקופה זו</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>תאריך שליחה</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>תאריך תוכנית</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>שם עובד</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>אימייל</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>נושא</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>סטטוס</th>
                {emails.some(e => e.status === 'failed') && (
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>הערה</th>
                )}
              </tr>
            </thead>
            <tbody>
              {emails.map(email => (
                <tr key={email.id} style={{ borderBottom: '1px solid #f1f5f9', background: email.status === 'failed' ? '#fef2f2' : 'white' }}>
                  <td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.85rem' }}>{formatDate(email.created_at)}</td>
                  <td style={{ padding: '0.75rem', color: '#374151' }}>{email.schedule_date}</td>
                  <td style={{ padding: '0.75rem', color: '#374151' }}>{email.first_name} {email.family_name}</td>
                  <td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }}>{email.recipient_email}</td>
                  <td style={{ padding: '0.75rem', color: '#374151', fontSize: '0.85rem' }}>{email.subject}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: email.status === 'sent' ? '#dcfce7' : '#fef2f2',
                      color: email.status === 'sent' ? '#166534' : '#991b1b'
                    }}>
                      {email.status === 'sent' ? '✓ נשלח' : '✕ כשל'}
                    </span>
                  </td>
                  {emails.some(e => e.status === 'failed') && (
                    <td style={{ padding: '0.75rem', color: '#dc2626', fontSize: '0.8rem' }}>
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
