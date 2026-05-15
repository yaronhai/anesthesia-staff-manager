import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Messaging.module.scss';

const GENERAL_CHAT_ID = 'general';
const ADMIN_CHAT_ID = 'admin-chat';
const ALLOWED_EXTS = /\.(jpe?g|png|gif|webp|mp4|webm|mov|pdf|docx?|xlsx?|txt)$/i;

export default function Messaging({ authToken, currentUser, workers, branchId, initialUserId, onInitialUserConsumed }) {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const [draftLinkPreview, setDraftLinkPreview] = useState(null);
  const [draftLinkDismissed, setDraftLinkDismissed] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [filesList, setFilesList] = useState([]);
  const fileInputRef = useRef(null);
  const linkPreviewTimerRef = useRef(null);
  const checkMobile = () => window.innerWidth < 640;
  const checkLandscape = () => window.innerWidth < 900 && window.innerHeight < 500;
  const [isMobile, setIsMobile] = useState(checkMobile);
  const [isLandscape, setIsLandscape] = useState(checkLandscape);
  const [isAdminChatMember, setIsAdminChatMember] = useState(false);
  const [adminGroupMessages, setAdminGroupMessages] = useState([]);
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

  async function fetchAdminGroupMessages() {
    try {
      const res = await fetch('/api/admin-chat/group', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setAdminGroupMessages(await res.json());
    } catch {}
  }

  async function fetchIsAdminChatMember() {
    try {
      const res = await fetch('/api/admin-chat/is-member', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) { const d = await res.json(); setIsAdminChatMember(d.isMember); }
    } catch {}
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('הקובץ גדול מ-10MB');
      e.target.value = '';
      return;
    }
    if (!ALLOWED_EXTS.test(file.name)) {
      alert('סוג קובץ לא נתמך');
      e.target.value = '';
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setAttachUploading(true);
    try {
      const res = await fetch('/api/messages/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'שגיאה בהעלאת קובץ');
        return;
      }
      setPendingAttachment(await res.json());
    } catch {
      alert('שגיאת רשת בהעלאת קובץ');
    } finally {
      setAttachUploading(false);
      e.target.value = '';
    }
  }

  async function sendGroupMessage(e) {
    e.preventDefault();
    if ((!draft.trim() && !pendingAttachment) || loading) return;
    const content = draft.trim();
    const attachment = pendingAttachment;
    setDraft('');
    setPendingAttachment(null);
    setDraftLinkPreview(null);
    setDraftLinkDismissed(false);
    setLoading(true);
    const isAdminChat = selectedUserId === ADMIN_CHAT_ID;
    const url = isAdminChat ? '/api/admin-chat/group' : `/api/messages/group?branch_id=${branchId}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ content, ...(attachment || {}) }),
      });
      if (res.ok) {
        if (isAdminChat) await fetchAdminGroupMessages();
        else await fetchGroupMessages();
      } else {
        setDraft(content);
        setPendingAttachment(attachment);
        alert('שגיאה בשליחת ההודעה, נסה שוב');
      }
    } catch (err) {
      console.error('Error sending group message:', err);
      setDraft(content);
      setPendingAttachment(attachment);
      alert('שגיאת רשת, נסה שוב');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if ((!draft.trim() && !pendingAttachment) || !selectedUserId || loading) return;
    const content = draft.trim();
    const attachment = pendingAttachment;
    setDraft('');
    setPendingAttachment(null);
    setDraftLinkPreview(null);
    setDraftLinkDismissed(false);
    setLoading(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ recipient_id: selectedUserId, content, ...(attachment || {}) }),
      });
      if (res.ok) {
        await fetchMessages(selectedUserId);
        await fetchConversations();
      } else {
        setDraft(content);
        setPendingAttachment(attachment);
        alert('שגיאה בשליחת ההודעה, נסה שוב');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setDraft(content);
      setPendingAttachment(attachment);
      alert('שגיאת רשת, נסה שוב');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAttachments() {
    const isGroup = selectedUserId === GENERAL_CHAT_ID;
    const url = isGroup
      ? `/api/messages/attachments?type=group&branch_id=${branchId}`
      : `/api/messages/attachments?type=private&other_user_id=${selectedUserId}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) setFilesList(await res.json());
    } catch {}
  }

  async function deleteAttachment(id) {
    const isGroup = selectedUserId === GENERAL_CHAT_ID;
    if (!window.confirm('למחוק?')) return;
    try {
      const res = await fetch(`/api/messages/attachment/${id}?type=${isGroup ? 'group' : 'private'}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setFilesList(prev => prev.filter(f => f.id !== id));
        if (isGroup) fetchGroupMessages(); else fetchMessages(selectedUserId);
      } else {
        alert('שגיאה במחיקה');
      }
    } catch { alert('שגיאת רשת'); }
  }

  function renderLinkPreview(msg) {
    if (!msg.link_url) return null;
    let domain = '';
    try { domain = new URL(msg.link_url).hostname.replace(/^www\./, ''); } catch {}
    return (
      <a href={msg.link_url} target="_blank" rel="noopener noreferrer" className={styles.linkPreviewCard}>
        {msg.link_image && (
          <img src={msg.link_image} alt="" className={styles.linkPreviewImg} />
        )}
        <div className={styles.linkPreviewBody}>
          {msg.link_title && <span className={styles.linkPreviewTitle}>{msg.link_title}</span>}
          {msg.link_description && <span className={styles.linkPreviewDesc}>{msg.link_description}</span>}
          {domain && <span className={styles.linkPreviewDomain}>{domain}</span>}
        </div>
      </a>
    );
  }

  function renderAttachment(msg) {
    if (!msg.file_url) return null;
    if (msg.file_type === 'image') {
      return (
        <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
          <img src={msg.file_url} alt={msg.file_name} className={styles.msgAttachImg} />
        </a>
      );
    }
    if (msg.file_type === 'video') {
      return <video src={msg.file_url} controls className={styles.msgAttachVideo} />;
    }
    return (
      <a href={msg.file_url} download={msg.file_name} className={styles.msgAttachDoc}
        target="_blank" rel="noopener noreferrer">
        <span>📄</span>
        <span className={styles.msgAttachDocName}>{msg.file_name}</span>
      </a>
    );
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
    if (isAdminChatMember) {
      sorted.unshift({ id: ADMIN_CHAT_ID, display_name: 'צ\'ט מנהלים', isAdminChat: true });
    }
    return sorted;
  })();

  useEffect(() => {
    if (!isMobile && isWorker && mergedContacts.length > 0 && !selectedUserId) {
      setSelectedUserId(mergedContacts[0].id);
    }
  }, [mergedContacts.length, isWorker, selectedUserId, isMobile]);

  useEffect(() => {
    if (initialUserId) {
      setSelectedUserId(initialUserId);
      onInitialUserConsumed?.();
    }
  }, [initialUserId]);

  useEffect(() => {
    fetchConversations();
    fetchContacts();
    fetchGroupMessages();
    fetchIsAdminChatMember();
    const interval = setInterval(fetchConversations, 3000);
    const groupInterval = setInterval(fetchGroupMessages, 3000);
    const memberInterval = setInterval(fetchIsAdminChatMember, 15000);
    return () => { clearInterval(interval); clearInterval(groupInterval); clearInterval(memberInterval); };
  }, [authToken]);

  useEffect(() => {
    if (!isAdminChatMember && selectedUserId === ADMIN_CHAT_ID) {
      setSelectedUserId(null);
    }
  }, [isAdminChatMember]);

  useEffect(() => {
    if (!isAdminChatMember) return;
    fetchAdminGroupMessages();
    const interval = setInterval(fetchAdminGroupMessages, 3000);
    return () => clearInterval(interval);
  }, [isAdminChatMember, authToken]);

  useEffect(() => {
    if (selectedUserId && selectedUserId !== GENERAL_CHAT_ID && selectedUserId !== ADMIN_CHAT_ID) {
      fetchMessages(selectedUserId);
      const interval = setInterval(() => fetchMessages(selectedUserId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUserId, authToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, groupMessages]);

  useEffect(() => {
    const URL_RE = /https?:\/\/[^\s"'<>\]]+/i;
    const match = draft.match(URL_RE);
    const url = match ? match[0] : null;

    if (!url || draftLinkDismissed) {
      if (!url) { setDraftLinkPreview(null); setDraftLinkDismissed(false); }
      clearTimeout(linkPreviewTimerRef.current);
      return;
    }
    if (draftLinkPreview?.link_url === url) return;

    clearTimeout(linkPreviewTimerRef.current);
    linkPreviewTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDraftLinkPreview(data?.link_url ? data : null);
        }
      } catch {}
    }, 600);
    return () => clearTimeout(linkPreviewTimerRef.current);
  }, [draft, authToken]);

  const selectedConversation = conversations.find(c => c.partner_id === selectedUserId);

  const showContacts = !isMobile || !selectedUserId;
  const showChat = !isMobile || !!selectedUserId;

  const rootVars = {
    '--root-height': isLandscape ? 'calc(100dvh - var(--content-top, 68px))' : 'calc(100dvh - var(--content-top, 140px))',
    '--root-gap': isLandscape ? '0.25rem' : '0.5rem',
    '--root-padding': isLandscape ? '0.25rem 0.5rem' : '0.75rem',
  };

  const contactsVars = {
    '--contacts-width': isLandscape ? '135px' : '210px',
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
          const isAdminChatContact = contact.isAdminChat === true;
          const isSelected = selectedUserId === contact.id;
          return (
            <button
              key={contact.id}
              className={`${styles.contactBtn} ${(isMobile || isLandscape) ? styles.contactBtnMobile : ''}`}
              onClick={() => setSelectedUserId(contact.id)}
              style={{
                '--contact-bg': isSelected ? '#1e40af' : 'white',
                '--contact-color': isSelected ? 'white' : isAdminChatContact ? '#7c3aed' : isGeneralChat ? '#065f46' : isSidur ? '#7f1d1d' : '#1e40af',
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

  const isSendDisabled = loading || attachUploading || (!draft.trim() && !pendingAttachment);

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
                  : selectedUserId === ADMIN_CHAT_ID
                  ? 'צ\'ט מנהלים'
                  : selectedConversation?.partner_name || (() => {
                      const worker = workers.find(w => w.user_id === selectedUserId);
                      return worker ? `${worker.first_name} ${worker.family_name}` : selectedConversation?.partner_username || 'שיחה';
                    })()}
                <button
                  className={styles.filesBtn}
                  title="קבצים מצורפים"
                  onClick={() => { fetchAttachments(); setFilesOpen(true); }}
                >📂</button>
              </div>

              <div className={styles.messagesList}>
                {selectedUserId === ADMIN_CHAT_ID ? (
                  adminGroupMessages.length === 0 ? (
                    <p className={styles.messagesEmpty}>אין הודעות עדיין</p>
                  ) : (() => {
                    const items = [];
                    let lastDate = null;
                    adminGroupMessages.forEach(msg => {
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
                            style={{ '--bubble-bg': isOwn ? '#e0f2fe' : '#fef9c3', '--bubble-font': '0.7rem', '--bubble-weight': 'normal' }}
                          >
                            <span className={styles.msgSenderName}>{isOwn ? 'אני' : msg.sender_name}</span>
                            <span className={styles.msgTime}>{timeStr}</span>
                            {msg.content && <span className={styles.msgContent}>{msg.content}</span>}
                          </div>
                        </div>
                      );
                    });
                    return items;
                  })()
                ) : selectedUserId === GENERAL_CHAT_ID ? (
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
                      const hasAttachment = !!msg.file_url || !!msg.link_url;
                      items.push(
                        <div key={msg.id} className={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : styles.msgRowOther}`}>
                          <div
                            className={`${styles.msgBubble} ${hasAttachment ? styles.msgBubbleCol : ''}`}
                            style={{ '--bubble-bg': isOwn ? '#e0f2fe' : '#ede9fe', '--bubble-font': '0.7rem', '--bubble-weight': 'normal' }}
                          >
                            <span className={styles.msgSenderName}>{isOwn ? 'אני' : msg.sender_name}</span>
                            <span className={styles.msgTime}>{timeStr}</span>
                            {msg.content && <span className={styles.msgContent}>{msg.content}</span>}
                            {renderAttachment(msg)}
                            {renderLinkPreview(msg)}
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
                      const hasAttachment = !!msg.file_url || !!msg.link_url;
                      items.push(
                        <div key={msg.id} className={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : styles.msgRowOther}`}>
                          <div
                            className={`${styles.msgBubble} ${hasAttachment ? styles.msgBubbleCol : ''}`}
                            style={{
                              '--bubble-bg': isOwn ? '#e0f2fe' : '#ede9fe',
                              '--bubble-font': isSidur ? '1rem' : '0.7rem',
                              '--bubble-weight': isSidur ? 700 : 'normal',
                              fontFamily: isSidur ? 'Arial, sans-serif' : 'inherit',
                            }}
                          >
                            <span className={styles.msgTime}>{timeStr}</span>
                            {msg.content && <span className={styles.msgContent}>{msg.content}</span>}
                            {renderAttachment(msg)}
                            {renderLinkPreview(msg)}
                          </div>
                        </div>
                      );
                    });
                    return items;
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              {draftLinkPreview && !pendingAttachment && (
                <div className={styles.draftLinkPreview}>
                  <a href={draftLinkPreview.link_url} target="_blank" rel="noopener noreferrer"
                    className={styles.linkPreviewCard} onClick={e => e.preventDefault()}>
                    {draftLinkPreview.link_image && (
                      <img src={draftLinkPreview.link_image} alt="" className={styles.linkPreviewImg} />
                    )}
                    <div className={styles.linkPreviewBody}>
                      {draftLinkPreview.link_title && (
                        <span className={styles.linkPreviewTitle}>{draftLinkPreview.link_title}</span>
                      )}
                      {draftLinkPreview.link_description && (
                        <span className={styles.linkPreviewDesc}>{draftLinkPreview.link_description}</span>
                      )}
                    </div>
                  </a>
                  <button type="button" className={styles.attachRemoveBtn}
                    onClick={() => { setDraftLinkPreview(null); setDraftLinkDismissed(true); }}>✕</button>
                </div>
              )}

              {pendingAttachment && (
                <div className={styles.attachPreview}>
                  {pendingAttachment.file_type === 'image' && (
                    <img src={pendingAttachment.file_url} className={styles.attachPreviewImg} alt="preview" />
                  )}
                  {pendingAttachment.file_type === 'video' && (
                    <span className={styles.attachPreviewIcon}>🎬</span>
                  )}
                  {pendingAttachment.file_type === 'document' && (
                    <span className={styles.attachPreviewIcon}>📄</span>
                  )}
                  <span className={styles.attachPreviewName}>{pendingAttachment.file_name}</span>
                  <button
                    type="button"
                    className={styles.attachRemoveBtn}
                    onClick={() => setPendingAttachment(null)}
                  >✕</button>
                </div>
              )}

              <form className={styles.inputForm} onSubmit={selectedUserId === GENERAL_CHAT_ID || selectedUserId === ADMIN_CHAT_ID ? sendGroupMessage : sendMessage}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  className={styles.attachBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachUploading}
                  title="צרף קובץ"
                >
                  {attachUploading ? '…' : '📎'}
                </button>
                <input
                  type="text"
                  className={styles.inputField}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="הקלד הודעה..."
                />
                <button type="submit" className={styles.sendBtn} disabled={isSendDisabled}>
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

      {filesOpen && (
        <div className={styles.filesModalOverlay} onClick={() => setFilesOpen(false)}>
          <div className={styles.filesModal} onClick={e => e.stopPropagation()}>
            <div className={styles.filesModalHeader}>
              <span>קבצים מצורפים</span>
              <button className={styles.filesModalClose} onClick={() => setFilesOpen(false)}>✕</button>
            </div>
            {filesList.length === 0 ? (
              <p className={styles.filesEmpty}>אין קבצים או קישורים בשיחה זו</p>
            ) : (() => {
              const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
              const groups = {};
              filesList.forEach(f => {
                const d = new Date(f.created_at);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!groups[key]) groups[key] = { year: d.getFullYear(), month: d.getMonth(), items: [] };
                groups[key].items.push(f);
              });
              return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(key => {
                const g = groups[key];
                return (
                  <div key={key} className={styles.filesGroup}>
                    <div className={styles.filesGroupLabel}>{MONTHS_HE[g.month]} {g.year}</div>
                    {g.items.map(f => {
                      const isOwn = f.sender_id === currentUser.id;
                      const d = new Date(f.created_at);
                      const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                      const isLink = !f.file_url && f.link_url;
                      const icon = isLink ? '🔗' : f.file_type === 'image' ? '🖼️' : f.file_type === 'video' ? '🎬' : '📄';
                      let domain = '';
                      if (isLink) { try { domain = new URL(f.link_url).hostname.replace(/^www\./, ''); } catch {} }
                      return (
                        <div key={f.id} className={styles.filesItem}>
                          {isLink && f.link_image
                            ? <img src={f.link_image} alt="" className={styles.filesLinkThumb} />
                            : <span className={styles.filesItemIcon}>{icon}</span>
                          }
                          <div className={styles.filesItemBody}>
                            {isLink ? (
                              <a href={f.link_url} target="_blank" rel="noopener noreferrer"
                                className={styles.filesItemName}>
                                {f.link_title || domain || f.link_url}
                              </a>
                            ) : (
                              <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                                download={f.file_type !== 'image' && f.file_type !== 'video' ? f.file_name : undefined}
                                className={styles.filesItemName}>{f.file_name}</a>
                            )}
                            <span className={styles.filesItemMeta}>
                              {f.sender_name} · {dateStr}
                              {isLink && domain ? ` · ${domain}` : ''}
                            </span>
                          </div>
                          {(isOwn || isAdmin) && (
                            <button className={styles.filesItemDelete} title="מחק"
                              onClick={() => deleteAttachment(f.id)}>🗑️</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
