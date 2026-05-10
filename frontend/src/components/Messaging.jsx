import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Messaging.module.scss';

const GENERAL_CHAT_ID = 'general';

export default function Messaging({ authToken, currentUser, workers, branchId }) {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const checkMobile = () => window.innerWidth < 640;
  const checkLandscape = () => window.innerWidth < 900 && window.innerHeight < 500;
  const [isMobile, setIsMobile] = useState(checkMobile);
  const [isLandscape, setIsLandscape] = useState(checkLandscape);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleResize = () => { setIsMobile(checkMobile()); setIsLandscape(checkLandscape()); };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  async function fetchMessages(userId) {
    if (!userId) return;
    try {
      const res = await fetch(`/api/messages/with/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs);
        await fetch(`/api/messages/read/${userId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }

  async function fetchGroupMessages() {
    try {
      const res = await fetch(`/api/messages/group?branch_id=${branchId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setGroupMessages(await res.json());
    } catch (err) {
      console.error('Error fetching group messages:', err);
    }
  }

  async function sendGroupMessage(e) {
    e.preventDefault();
    if (!draft.trim() || loading) return;
    const content = draft.trim();
    setDraft('');
    setLoading(true);
    try {
      const res = await fetch(`/api/messages/group?branch_id=${branchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        await fetchGroupMessages();
      } else {
        setDraft(content);
        alert('שגיאה בשליחת ההודעה, נסה שוב');
      }
    } catch (err) {
      console.error('Error sending group message:', err);
      setDraft(content);
      alert('שגיאת רשת, נסה שוב');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !selectedUserId || loading) return;
    const content = draft.trim();
    setDraft('');
    setLoading(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ recipient_id: selectedUserId, content }),
      });
      if (res.ok) {
        await fetchMessages(selectedUserId);
        await fetchConversations();
      } else {
        setDraft(content);
        alert('שגיאה בשליחת ההודעה, נסה שוב');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setDraft(content);
      alert('שגיאת רשת, נסה שוב');
    } finally {
      setLoading(false);
    }
  }

  const mergedContacts = (() => {
    const list = isAdmin
      ? workers.filter(w => w.user_id).map(w => ({
          id: w.user_id,
          display_name: `${w.first_name} ${w.family_name}`,
          is_borrowed: branchId && w.primary_branch_id && w.primary_branch_id !== branchId,
        }))
      : [...contacts];
    conversations.forEach(conv => {
      if (!list.find(c => c.id === conv.partner_id)) {
        list.push({ id: conv.partner_id, display_name: conv.partner_name || conv.partner_username });
      }
    });
    const sorted = list.sort((a, b) => {
      if (a.display_name === 'סידור עבודה') return -1;
      if (b.display_name === 'סידור עבודה') return 1;
      return 0;
    });
    const generalEntry = { id: GENERAL_CHAT_ID, display_name: 'צ\'ט כללי', isGeneralChat: true };
    const sidurIdx = sorted.findIndex(c => c.display_name === 'סידור עבודה');
    if (sidurIdx >= 0) sorted.splice(sidurIdx + 1, 0, generalEntry);
    else sorted.unshift(generalEntry);
    return sorted;
  })();

  useEffect(() => {
    if (!isMobile && isWorker && mergedContacts.length > 0 && !selectedUserId) {
      setSelectedUserId(mergedContacts[0].id);
    }
  }, [mergedContacts.length, isWorker, selectedUserId, isMobile]);

  useEffect(() => {
    fetchConversations();
    fetchContacts();
    fetchGroupMessages();
    const interval = setInterval(fetchConversations, 3000);
    const groupInterval = setInterval(fetchGroupMessages, 3000);
    return () => { clearInterval(interval); clearInterval(groupInterval); };
  }, [authToken]);

  useEffect(() => {
    if (selectedUserId && selectedUserId !== GENERAL_CHAT_ID) {
      fetchMessages(selectedUserId);
      const interval = setInterval(() => fetchMessages(selectedUserId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUserId, authToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, groupMessages]);

  const selectedConversation = conversations.find(c => c.partner_id === selectedUserId);

  const showContacts = !isMobile || !selectedUserId;
  const showChat = !isMobile || !!selectedUserId;

  const rootVars = {
    '--root-height': isLandscape ? 'calc(100vh - 72px)' : 'calc(100vh - 200px)',
    '--root-gap': isLandscape ? '0.25rem' : '0.5rem',
    '--root-padding': isLandscape ? '0.25rem 0.5rem' : '0.75rem',
  };

  const contactsVars = {
    '--contacts-width': isLandscape ? '110px' : '180px',
    '--contacts-min-width': '80px',
    '--contacts-header-padding': isLandscape ? '0.25rem' : '0.5rem',
    '--contacts-header-font': isLandscape ? '0.7rem' : '0.8rem',
    '--contact-btn-padding': isMobile ? '0.6rem 0.75rem' : isLandscape ? '0.2rem 0.3rem' : '0.3rem 0.4rem',
    '--contact-font': isMobile ? '0.9rem' : isLandscape ? '0.65rem' : '0.7rem',
  };

  const contactsList = (
    <div
      className={`${styles.contacts} ${isMobile ? styles.contactsMobile : ''}`}
      style={isMobile ? undefined : contactsVars}
    >
      <div className={styles.contactsHeader}>
        {isAdmin ? 'עובדים' : 'אנשי קשר'}
      </div>
      <div className={styles.contactsList}>
        {mergedContacts.length === 0 ? (
          <p className={styles.contactsEmpty}>אין אנשי קשר</p>
        ) : mergedContacts.map(contact => {
          const conversation = conversations.find(c => c.partner_id === contact.id);
          const isSidur = contact.display_name === 'סידור עבודה';
          const isGeneralChat = contact.isGeneralChat === true;
          const isSelected = selectedUserId === contact.id;
          return (
            <button
              key={contact.id}
              className={`${styles.contactBtn} ${(isMobile || isLandscape) ? styles.contactBtnMobile : ''}`}
              onClick={() => setSelectedUserId(contact.id)}
              style={{
                '--contact-bg': isSelected ? '#1e40af' : 'white',
                '--contact-color': isSelected ? 'white' : isGeneralChat ? '#065f46' : isSidur ? '#7f1d1d' : '#1e40af',
                '--contact-btn-padding': isMobile ? '0.6rem 0.75rem' : isLandscape ? '0.2rem 0.3rem' : '0.3rem 0.4rem',
                '--contact-font': isMobile ? '0.9rem' : isLandscape ? '0.65rem' : '0.7rem',
              }}
            >
              {contact.display_name}
              {contact.is_borrowed && <span className={styles.borrowedTag}>מושאל</span>}
              {conversation?.unread_count > 0 && (
                <span
                  className={styles.unreadBadge}
                  style={{ '--badge-top': isMobile ? '0.3rem' : '-5px' }}
                >
                  {conversation.unread_count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={styles.root} style={rootVars}>
      {showContacts && contactsList}

      {showChat && (
        <div className={styles.chatArea}>
          {selectedUserId ? (
            <>
              <div
                className={styles.chatHeader}
                style={{
                  '--chat-header-padding': isLandscape ? '0.25rem 0.5rem' : '0.75rem',
                  '--chat-header-font': isLandscape ? '0.8rem' : '0.95rem',
                }}
              >
                {isMobile && (
                  <button className={styles.backBtn} onClick={() => setSelectedUserId(null)}>←</button>
                )}
                {selectedUserId === GENERAL_CHAT_ID
                  ? 'צ\'ט כללי'
                  : selectedConversation?.partner_name || (() => {
                      const worker = workers.find(w => w.user_id === selectedUserId);
                      return worker ? `${worker.first_name} ${worker.family_name}` : selectedConversation?.partner_username || 'שיחה';
                    })()}
              </div>

              <div className={styles.messagesList}>
                {selectedUserId === GENERAL_CHAT_ID ? (
                  groupMessages.length === 0 ? (
                    <p className={styles.messagesEmpty}>אין הודעות עדיין</p>
                  ) : (() => {
                    const items = [];
                    let lastDate = null;
                    groupMessages.forEach(msg => {
                      const date = new Date(msg.created_at);
                      const dateKey = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                      if (dateKey !== lastDate) {
                        lastDate = dateKey;
                        items.push(
                          <div key={`date-${dateKey}`} className={styles.dateDivider}>
                            <div className={styles.dateLine} />
                            <span className={styles.dateLabel}>{dateKey}</span>
                            <div className={styles.dateLine} />
                          </div>
                        );
                      }
                      const isOwn = msg.sender_id === currentUser.id;
                      const timeStr = msg.time_display || date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                      items.push(
                        <div key={msg.id} className={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : styles.msgRowOther}`}>
                          <div
                            className={styles.msgBubble}
                            style={{ '--bubble-bg': isOwn ? '#e0f2fe' : '#ede9fe', '--bubble-font': '0.7rem', '--bubble-weight': 'normal' }}
                          >
                            <span className={styles.msgSenderName}>{isOwn ? 'אני' : msg.sender_name}</span>
                            <span className={styles.msgTime}>{timeStr}</span>
                            <span className={styles.msgContent}>{msg.content}</span>
                          </div>
                        </div>
                      );
                    });
                    return items;
                  })()
                ) : (
                  messages.length === 0 ? (
                    <p className={styles.messagesEmpty}>אין הודעות עדיין</p>
                  ) : (() => {
                    const items = [];
                    let lastDate = null;
                    messages.forEach(msg => {
                      const date = new Date(msg.created_at);
                      const dateKey = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                      if (dateKey !== lastDate) {
                        lastDate = dateKey;
                        items.push(
                          <div key={`date-${dateKey}`} className={styles.dateDivider}>
                            <div className={styles.dateLine} />
                            <span className={styles.dateLabel}>{dateKey}</span>
                            <div className={styles.dateLine} />
                          </div>
                        );
                      }
                      const isOwn = msg.sender_id === currentUser.id;
                      const isSidur = msg.sender_username === 'system_sidur';
                      const timeStr = msg.time_display || date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                      items.push(
                        <div key={msg.id} className={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : styles.msgRowOther}`}>
                          <div
                            className={styles.msgBubble}
                            style={{
                              '--bubble-bg': isOwn ? '#e0f2fe' : '#ede9fe',
                              '--bubble-font': isSidur ? '1rem' : '0.7rem',
                              '--bubble-weight': isSidur ? 700 : 'normal',
                              fontFamily: isSidur ? 'Arial, sans-serif' : 'inherit',
                            }}
                          >
                            <span className={styles.msgTime}>{timeStr}</span>
                            <span className={styles.msgContent}>{msg.content}</span>
                          </div>
                        </div>
                      );
                    });
                    return items;
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className={styles.inputForm} onSubmit={selectedUserId === GENERAL_CHAT_ID ? sendGroupMessage : sendMessage}>
                <input
                  type="text"
                  className={styles.inputField}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="הקלד הודעה..."
                />
                <button type="submit" className={styles.sendBtn} disabled={loading || !draft.trim()}>
                  {loading ? '...' : 'שלח'}
                </button>
              </form>
            </>
          ) : (
            <div className={styles.noConversation}>
              {isAdmin ? 'בחר שיחה להתחלה' : 'לא הוקמה שיחה עדיין'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
