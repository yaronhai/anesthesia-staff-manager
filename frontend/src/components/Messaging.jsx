import { useState, useEffect, useRef } from 'react';

export default function Messaging({ authToken, currentUser, workers, branchId }) {
  const [conversations, setConversations] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isWorker = currentUser?.role === 'user';

  // Fetch conversations list
  async function fetchConversations() {
    try {
      const res = await fetch('/api/messages/conversations', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setConversations(await res.json());
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }

  // Fetch messages with specific user
  async function fetchMessages(userId) {
    if (!userId) return;
    try {
      const res = await fetch(`/api/messages/with/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs);
        // Mark as read
        await fetch(`/api/messages/read/${userId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }

  // Send message
  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !selectedUserId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ recipient_id: selectedUserId, content: draft }),
      });
      if (res.ok) {
        setDraft('');
        await fetchMessages(selectedUserId);
        await fetchConversations();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  }

  // Auto-select admin for workers
  useEffect(() => {
    if (isWorker && conversations.length > 0 && !selectedUserId) {
      // For workers, auto-select the first (and likely only) admin conversation
      setSelectedUserId(conversations[0].partner_id);
    }
  }, [conversations, isWorker, selectedUserId]);

  // Polling for messages
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedUserId) fetchMessages(selectedUserId);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages when selected user changes
  useEffect(() => {
    if (selectedUserId) fetchMessages(selectedUserId);
  }, [selectedUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedConversation = conversations.find(c => c.partner_id === selectedUserId);

  return (
    <div style={{ direction: 'rtl', display: 'flex', height: 'calc(100vh - 200px)', gap: '1rem', padding: '1rem' }}>
      {/* Conversations list (only for admin) */}
      {isAdmin && (
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#1f2937' }}>שיחות</div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem' }}>
            {conversations.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', padding: '1rem', textAlign: 'center' }}>אין שיחות עדיין</p>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.partner_id}
                  onClick={() => setSelectedUserId(conv.partner_id)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    textAlign: 'right',
                    cursor: 'pointer',
                    background: selectedUserId === conv.partner_id ? '#3b82f6' : 'white',
                    color: selectedUserId === conv.partner_id ? 'white' : '#1f2937',
                    fontSize: '0.9rem',
                    position: 'relative',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{conv.partner_name || conv.partner_username}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8, maxHeight: '2.4em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.last_message}
                  </div>
                  {conv.unread_count > 0 && (
                    <span style={{ position: 'absolute', left: '0.5rem', top: '0.5rem', background: '#ef4444', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                      {conv.unread_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#1f2937' }}>
              {selectedConversation.partner_name || selectedConversation.partner_username}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {messages.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: '2rem' }}>אין הודעות עדיין</p>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.sender_id === currentUser.id;
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                      <div
                        style={{
                          maxWidth: '60%',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          background: isOwn ? '#3b82f6' : '#e5e7eb',
                          color: isOwn ? 'white' : '#1f2937',
                          fontSize: '0.9rem',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.content}
                        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.25rem' }}>
                          {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="הקלד הודעה..."
                style={{ flex: 1, padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', fontFamily: 'inherit' }}
              />
              <button type="submit" disabled={loading || !draft.trim()} style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', minWidth: '80px' }}>
                {loading ? '...' : 'שלח'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
            {isAdmin ? 'בחר שיחה להתחלה' : 'לא הוקמה שיחה עדיין'}
          </div>
        )}
      </div>
    </div>
  );
}
