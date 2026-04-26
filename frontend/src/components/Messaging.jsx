import { useState, useEffect, useRef } from 'react';

export default function Messaging({ authToken, currentUser, workers, branchId }) {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isWorker = currentUser?.role === 'user';

  async function fetchContacts() {
    try {
      const res = await fetch('/api/messages/contacts', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setContacts(await res.json());
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }

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

  // Merge contacts + active conversations (e.g. system_sidur) into one list, sidur first
  const mergedContacts = isAdmin ? [] : (() => {
    const list = [...contacts];
    conversations.forEach(conv => {
      if (!list.find(c => c.id === conv.partner_id)) {
        list.push({ id: conv.partner_id, display_name: conv.partner_name || conv.partner_username });
      }
    });
    return list.sort((a, b) => {
      if (a.display_name === 'סידור עבודה') return -1;
      if (b.display_name === 'סידור עבודה') return 1;
      return 0;
    });
  })();

  // Auto-select first contact for workers
  useEffect(() => {
    if (isWorker && mergedContacts.length > 0 && !selectedUserId) {
      setSelectedUserId(mergedContacts[0].id);
    }
  }, [mergedContacts.length, isWorker, selectedUserId]);

  // Polling for messages
  useEffect(() => {
    fetchConversations();
    fetchContacts();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [authToken]);

  // Fetch messages when selectedUserId changes
  useEffect(() => {
    if (selectedUserId) {
      fetchMessages(selectedUserId);
      const interval = setInterval(() => fetchMessages(selectedUserId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUserId, authToken]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedConversation = conversations.find(c => c.partner_id === selectedUserId);

  return (
    <div style={{ direction: 'rtl', display: 'flex', height: 'calc(100vh - 200px)', gap: '1rem', padding: '1rem', maxWidth: '60%', margin: '0 auto' }}>
      {/* Contacts/Conversations list */}
      <div style={{ width: '140px', display: 'flex', flexDirection: 'column', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#991b1b', fontSize: '0.8rem', textAlign: 'center' }}>
          {isAdmin ? 'עובדים' : 'אנשי קשר'}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.25rem' }}>
          {isAdmin ? (
            workers.length === 0 ? (
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', padding: '0.5rem', textAlign: 'center' }}>אין עובדים</p>
            ) : (
              workers.map(worker => {
                const conversation = conversations.find(c => c.partner_name?.includes(worker.first_name));
                const contactId = conversation?.partner_id || worker.user_id;
                return (
                  <button
                    key={worker.id}
                    onClick={() => {
                      if (contactId) setSelectedUserId(contactId);
                      else alert('לא ניתן להודיע לעובד זה - אין קשר למשתמש');
                    }}
                    style={{
                      padding: '0.3rem 0.4rem', borderRadius: '3px', border: 'none', textAlign: 'right',
                      cursor: 'pointer',
                      background: selectedUserId === contactId ? '#1e40af' : 'white',
                      color: selectedUserId === contactId ? 'white' : '#1e40af',
                      fontSize: '0.7rem', position: 'relative', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700,
                    }}
                  >
                    {worker.first_name} {worker.family_name}
                    {conversation?.unread_count > 0 && (
                      <span style={{ position: 'absolute', left: '0.3rem', top: '-5px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
                        {conversation.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )
          ) : (
            mergedContacts.length === 0 ? (
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', padding: '0.5rem', textAlign: 'center' }}>אין אנשי קשר</p>
            ) : (
              mergedContacts.map(contact => {
                const conversation = conversations.find(c => c.partner_id === contact.id);
                return (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedUserId(contact.id)}
                    style={{
                      padding: '0.3rem 0.4rem', borderRadius: '3px', border: 'none', textAlign: 'right',
                      cursor: 'pointer',
                      background: selectedUserId === contact.id ? '#1e40af' : 'white',
                      color: selectedUserId === contact.id ? 'white' : contact.display_name === 'סידור עבודה' ? '#7f1d1d' : '#1e40af',
                      fontWeight: contact.display_name === 'סידור עבודה' ? 800 : 700,
                      fontSize: '0.7rem', position: 'relative', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700,
                    }}
                  >
                    {contact.display_name}
                    {conversation?.unread_count > 0 && (
                      <span style={{ position: 'absolute', left: '0.3rem', top: '-5px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
                        {conversation.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {selectedUserId ? (
          <>
            {/* Chat header */}
            <div style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#1f2937', fontSize: '0.95rem' }}>
              {selectedConversation?.partner_name || (() => {
                const worker = workers.find(w => w.user_id === selectedUserId);
                return worker ? `${worker.first_name} ${worker.family_name}` : selectedConversation?.partner_username || 'שיחה';
              })()}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              {messages.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem' }}>אין הודעות עדיין</p>
              ) : (() => {
                const items = [];
                let lastDate = null;
                messages.forEach(msg => {
                  const date = new Date(msg.created_at);
                  const dateKey = date.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
                  if (dateKey !== lastDate) {
                    lastDate = dateKey;
                    items.push(
                      <div key={`date-${dateKey}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.4rem 0' }}>
                        <div style={{ flex: 1, height: '1px', background: '#d1d5db' }} />
                        <span style={{ fontSize: '0.65rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{dateKey}</span>
                        <div style={{ flex: 1, height: '1px', background: '#d1d5db' }} />
                      </div>
                    );
                  }
                  const isOwn = msg.sender_id === currentUser.id;
                  const timeStr = msg.time_display || date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                  items.push(
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '0.2rem 0.4rem', borderRadius: '2px',
                        background: isOwn ? '#e0f2fe' : '#ede9fe',
                        color: isOwn ? '#1f2937' : '#1f2937',
                        fontSize: '0.7rem', wordBreak: 'break-word', lineHeight: '1.1',
                        display: 'flex', alignItems: 'flex-end', gap: '0.3rem',
                      }}>
                        <span style={{ fontSize: '0.6rem', opacity: 0.6, whiteSpace: 'nowrap' }}>{timeStr}</span>
                        <span>{msg.content}</span>
                      </div>
                    </div>
                  );
                });
                return items;
              })()}
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
