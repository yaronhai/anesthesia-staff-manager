import { useState, useEffect, useRef } from 'react';
import styles from '../styles/ManagersChat.module.scss';

const ALLOWED_EXTS = /\.(jpe?g|png|gif|webp|mp4|webm|mov|pdf|docx?|xlsx?|txt)$/i;

export default function ManagersChat({ authToken, currentUser, canManageMembers = false }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('group');
  const [members, setMembers] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [privateUserId, setPrivateUserId] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const [draftLinkPreview, setDraftLinkPreview] = useState(null);
  const [draftLinkDismissed, setDraftLinkDismissed] = useState(false);
  const lastSeenKey = `mgr-chat-last-seen-${currentUser?.id}`;
  const [groupLastSeen, setGroupLastSeenState] = useState(
    () => localStorage.getItem(`mgr-chat-last-seen-${currentUser?.id}`) || null
  );
  function setGroupLastSeen(ts) {
    setGroupLastSeenState(ts);
    if (ts) localStorage.setItem(lastSeenKey, ts);
  }
  const [groupUnread, setGroupUnread] = useState(0);
  const [showMembersStrip, setShowMembersStrip] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [privateConversations, setPrivateConversations] = useState([]);
  const [privateSearch, setPrivateSearch] = useState('');
  const [privateSearchResults, setPrivateSearchResults] = useState([]);
  const [showPrivateSearch, setShowPrivateSearch] = useState(false);
  const hiddenKey = `mgr-chat-hidden-${currentUser?.id}`;
  const getHidden = () => new Set(JSON.parse(localStorage.getItem(hiddenKey) || '[]'));
  const saveHidden = (set) => localStorage.setItem(hiddenKey, JSON.stringify([...set]));

  const messagesEndRef = useRef(null);
  const panelRef = useRef(null);
  const floatBtnRef = useRef(null);
  const dragState = useRef(null);
  const fileInputRef = useRef(null);
  const linkPreviewTimerRef = useRef(null);
  const openRef = useRef(false);
  const tabRef = useRef('group');
  const [panelPos, setPanelPos] = useState(null);
  const [panelSize, setPanelSize] = useState({ width: 420, height: 580 });
  const resizeDragState = useRef(null);
  const [btnPos, setBtnPos] = useState(null);
  const btnDragState = useRef(null);
  const btnDidDrag = useRef(false);

  // sync refs immediately on every render — not via useEffect
  openRef.current = open;
  tabRef.current = tab;

  const authHeaders = () => ({ Authorization: `Bearer ${authToken}` });

  async function fetchMembers() {
    try {
      const res = await fetch('/api/admin-chat/members', { headers: authHeaders() });
      if (res.ok) setMembers(await res.json());
    } catch {}
  }

  async function fetchGroupMessages() {
    try {
      const res = await fetch('/api/admin-chat/group', { headers: authHeaders() });
      if (res.ok) {
        const msgs = await res.json();
        setGroupMessages(msgs);
        if (openRef.current && msgs.length > 0) {
          setGroupLastSeen(msgs[msgs.length - 1].created_at);
          setGroupUnread(0);
        }
      }
    } catch {}
  }

  async function fetchPrivateMessages(userId) {
    if (!userId) return;
    try {
      const res = await fetch(`/api/messages/with/${userId}`, { headers: authHeaders() });
      if (res.ok) {
        setPrivateMessages(await res.json());
        await fetch(`/api/messages/read/${userId}`, { method: 'POST', headers: authHeaders() });
      }
    } catch {}
  }

  async function fetchGroupUnread() {
    if (!groupLastSeen || openRef.current) return;
    try {
      const res = await fetch(
        `/api/admin-chat/unread?last_seen=${encodeURIComponent(groupLastSeen)}`,
        { headers: authHeaders() }
      );
      if (res.ok) {
        const { count } = await res.json();
        setGroupUnread(count);
      }
    } catch {}
  }

  async function fetchPrivateConversations() {
    try {
      const res = await fetch('/api/messages/conversations', { headers: authHeaders() });
      if (res.ok) {
        const all = await res.json();
        const hidden = getHidden();
        const filtered = all.filter(c =>
          !hidden.has(String(c.partner_id)) || Number(c.unread_count) > 0
        );
        setPrivateConversations(openRef.current
          ? filtered.map(c => ({ ...c, unread_count: 0 }))
          : filtered
        );
      }
    } catch {}
  }

  function hideConversation(userId) {
    const h = getHidden();
    h.add(String(userId));
    saveHidden(h);
    setPrivateUserId(null);
    fetchPrivateConversations();
  }

  function getConvName(userId) {
    const conv = privateConversations.find(c => c.partner_id === userId);
    if (conv) return conv.partner_name || conv.partner_username;
    const mem = members.find(m => m.user_id === userId);
    if (mem) return getMemberName(mem);
    const r = privateSearchResults.find(w => w.user_id === userId);
    return r ? (r.family_name && r.first_name ? `${r.family_name} ${r.first_name}` : r.username) : '...';
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
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) { alert((await res.json()).error || 'שגיאה בהעלאת קובץ'); return; }
      setPendingAttachment(await res.json());
    } catch {
      alert('שגיאת רשת בהעלאת קובץ');
    } finally {
      setAttachUploading(false);
      e.target.value = '';
    }
  }

  async function searchPrivateUsers(q) {
    if (!q.trim()) { setPrivateSearchResults([]); return; }
    try {
      const res = await fetch(`/api/admin-chat/search-users?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      if (res.ok) setPrivateSearchResults(await res.json());
    } catch {}
  }

  async function searchUsers(q) {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const res = await fetch('/api/workers?all_branches=true', { headers: authHeaders() });
      if (res.ok) {
        const all = await res.json();
        const lower = q.toLowerCase();
        const filtered = all.filter(w =>
          w.user_id &&
          !members.find(m => m.user_id === w.user_id) &&
          (`${w.family_name} ${w.first_name}`).toLowerCase().includes(lower)
        );
        setSearchResults(filtered.slice(0, 8));
      }
    } catch {}
  }

  async function addMember(userId) {
    try {
      await fetch('/api/admin-chat/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ user_id: userId }),
      });
      await fetchMembers();
      setAddSearch('');
      setSearchResults([]);
      setShowAddSearch(false);
    } catch {}
  }

  async function removeMember(userId) {
    try {
      await fetch(`/api/admin-chat/members/${userId}`, { method: 'DELETE', headers: authHeaders() });
      await fetchMembers();
    } catch {}
  }

  function clearDraftExtras() {
    setPendingAttachment(null);
    setDraftLinkPreview(null);
    setDraftLinkDismissed(false);
  }

  async function deleteGroupMessage(msgId) {
    if (!window.confirm('למחוק הודעה זו?')) return;
    try {
      const res = await fetch(`/api/admin-chat/group/${msgId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) await fetchGroupMessages();
    } catch {}
  }

  async function sendGroupMessage(e) {
    e.preventDefault();
    const content = draft.trim();
    const attachment = pendingAttachment;
    const linkData = draftLinkPreview;
    if (!content && !attachment) return;
    if (loading) return;
    setDraft('');
    clearDraftExtras();
    setLoading(true);
    try {
      const body = { content };
      if (attachment) Object.assign(body, attachment);
      else if (linkData) Object.assign(body, linkData);
      const res = await fetch('/api/admin-chat/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) await fetchGroupMessages();
      else { setDraft(content); setPendingAttachment(attachment); }
    } catch { setDraft(content); setPendingAttachment(attachment); }
    finally { setLoading(false); }
  }

  async function sendPrivateMessage(e) {
    e.preventDefault();
    const content = draft.trim();
    const attachment = pendingAttachment;
    const linkData = draftLinkPreview;
    if (!content && !attachment) return;
    if (!privateUserId || loading) return;
    setDraft('');
    clearDraftExtras();
    setLoading(true);
    try {
      const body = { recipient_id: privateUserId, content };
      if (attachment) Object.assign(body, attachment);
      else if (linkData) Object.assign(body, linkData);
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) { await fetchPrivateMessages(privateUserId); fetchPrivateConversations(); }
      else { setDraft(content); setPendingAttachment(attachment); }
    } catch { setDraft(content); setPendingAttachment(attachment); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!authToken) return;
    fetchMembers();
    fetchGroupMessages();
    fetchPrivateConversations();
    const groupInterval = setInterval(fetchGroupMessages, 3000);
    const privateInterval = setInterval(fetchPrivateConversations, 5000);
    return () => { clearInterval(groupInterval); clearInterval(privateInterval); };
  }, [authToken]);

  useEffect(() => {
    if (tab === 'private' && authToken) fetchPrivateConversations();
  }, [tab]);

  useEffect(() => {
    if (!privateUserId) return;
    fetchPrivateMessages(privateUserId);
    const interval = setInterval(() => fetchPrivateMessages(privateUserId), 3000);
    return () => clearInterval(interval);
  }, [privateUserId, authToken]);

  useEffect(() => {
    if (!authToken) return;
    const interval = setInterval(fetchGroupUnread, 5000);
    return () => clearInterval(interval);
  }, [authToken, groupLastSeen]);

  useEffect(() => {
    if (!open) return;
    // openRef.current is already true (set synchronously in render)
    fetchGroupMessages(); // sets groupLastSeen + resets groupUnread
    setPrivateConversations(prev => {
      prev.filter(c => Number(c.unread_count) > 0).forEach(c => {
        fetch(`/api/messages/read/${c.partner_id}`, { method: 'POST', headers: authHeaders() }).catch(() => {});
      });
      return prev.map(c => ({ ...c, unread_count: 0 }));
    });
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages, privateMessages]);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e) {
      if (panelRef.current?.contains(e.target)) return;
      if (floatBtnRef.current?.contains(e.target)) return;
      handleToggle();
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

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
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setDraftLinkPreview(data?.link_url ? data : null);
        }
      } catch {}
    }, 600);
    return () => clearTimeout(linkPreviewTimerRef.current);
  }, [draft, authToken]);

  function handleResizeMouseDown(e, direction) {
    e.preventDefault();
    e.stopPropagation();
    const bottomAnchored = !panelPos;
    resizeDragState.current = {
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startW: panelSize.width,
      startH: panelSize.height,
      bottomAnchored,
    };
    function onMove(ev) {
      const { direction, startX, startY, startW, startH, bottomAnchored } = resizeDragState.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dyH = bottomAnchored ? -dy : dy;
      setPanelSize(prev => ({
        width:  direction.includes('e') ? Math.max(300, startW + dx) : prev.width,
        height: direction.includes('s') ? Math.max(300, startH + dyH) : prev.height,
      }));
    }
    function onUp() {
      resizeDragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handlePanelMouseDown(e) {
    if (!e.target.closest(`.${styles.panelHeader}`)) return;
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: panelPos ? panelPos.left : rect.left,
      origTop: panelPos ? panelPos.top : rect.top,
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPanelPos({
      left: dragState.current.origLeft + dx,
      top: dragState.current.origTop + dy,
    });
  }

  function handleMouseUp() {
    dragState.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function handleBtnMouseDown(e) {
    e.preventDefault();
    btnDidDrag.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const origLeft = btnPos ? btnPos.left : null;
    const origBottom = btnPos ? btnPos.bottom : null;
    btnDragState.current = { startX, startY, origLeft, origBottom };

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!btnDidDrag.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      btnDidDrag.current = true;
      const base = btnPos || { left: 24, bottom: 24 };
      setBtnPos({
        left: (origLeft ?? base.left) + dx,
        bottom: (origBottom ?? base.bottom) - dy,
      });
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleToggle() {
    if (open) {
      setPanelPos(null);
      setPrivateUserId(null);
      setTab('group');
      clearDraftExtras();
      setDraft('');
    }
    setOpen(o => !o);
  }

  function getMemberName(m) {
    if (m.family_name) return `${m.family_name} ${m.first_name}`;
    return m.username;
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

  function renderLinkPreview(msg) {
    if (!msg.link_url) return null;
    let domain = '';
    try { domain = new URL(msg.link_url).hostname.replace(/^www\./, ''); } catch {}
    return (
      <a href={msg.link_url} target="_blank" rel="noopener noreferrer" className={styles.linkPreviewCard}>
        {msg.link_image && <img src={msg.link_image} alt="" className={styles.linkPreviewImg} />}
        <div className={styles.linkPreviewBody}>
          {msg.link_title && <span className={styles.linkPreviewTitle}>{msg.link_title}</span>}
          {msg.link_description && <span className={styles.linkPreviewDesc}>{msg.link_description}</span>}
          {domain && <span className={styles.linkPreviewDomain}>{domain}</span>}
        </div>
      </a>
    );
  }

  function renderMessages(msgs, isGroup) {
    const items = [];
    let lastDate = null;
    msgs.forEach(msg => {
      const date = new Date(msg.created_at);
      const dateKey = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      if (dateKey !== lastDate) {
        lastDate = dateKey;
        items.push(
          <div key={`d-${dateKey}`} className={styles.dateDivider}>
            <span>{dateKey}</span>
          </div>
        );
      }
      const isOwn = msg.sender_id === currentUser.id;
      const canDelete = isGroup && (isOwn || canManageMembers);
      const timeStr = msg.time_display || date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const hasExtra = !!msg.file_url || !!msg.link_url;
      items.push(
        <div key={msg.id} className={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : styles.msgRowOther}`}>
          <div className={styles.msgWrap}>
            <div className={`${styles.msgBubble} ${hasExtra ? styles.msgBubbleCol : ''}`}>
              {isGroup && !isOwn && <span className={styles.msgSender}>{msg.sender_name}</span>}
              {msg.content && <span className={styles.msgContent}>{msg.content}</span>}
              {renderAttachment(msg)}
              {renderLinkPreview(msg)}
              <span className={styles.msgTime}>{timeStr}</span>
            </div>
            {canDelete && (
              <button
                className={styles.msgDeleteBtn}
                title="מחק הודעה"
                onClick={() => deleteGroupMessage(msg.id)}
              >🗑</button>
            )}
          </div>
        </div>
      );
    });
    return items;
  }

  const isSendDisabled = loading || attachUploading || (!draft.trim() && !pendingAttachment);

  function renderInputArea(onSubmit, placeholder) {
    return (
      <>
        {draftLinkPreview && !pendingAttachment && (
          <div className={styles.attachPreview}>
            {draftLinkPreview.link_image && (
              <img src={draftLinkPreview.link_image} alt="" className={styles.attachPreviewImg} />
            )}
            <span className={styles.attachPreviewName}>
              {draftLinkPreview.link_title || draftLinkPreview.link_url}
            </span>
            <button type="button" className={styles.attachRemoveBtn}
              onClick={() => { setDraftLinkPreview(null); setDraftLinkDismissed(true); }}>✕</button>
          </div>
        )}
        {pendingAttachment && (
          <div className={styles.attachPreview}>
            {pendingAttachment.file_type === 'image' && (
              <img src={pendingAttachment.file_url} alt="preview" className={styles.attachPreviewImg} />
            )}
            {pendingAttachment.file_type === 'video' && <span className={styles.attachPreviewIcon}>🎬</span>}
            {pendingAttachment.file_type === 'document' && <span className={styles.attachPreviewIcon}>📄</span>}
            <span className={styles.attachPreviewName}>{pendingAttachment.file_name}</span>
            <button type="button" className={styles.attachRemoveBtn}
              onClick={() => setPendingAttachment(null)}>✕</button>
          </div>
        )}
        <form className={styles.inputRow} onSubmit={onSubmit}>
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
          >{attachUploading ? '…' : '📎'}</button>
          <input
            className={styles.input}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
          />
          <button type="submit" className={styles.sendBtn} disabled={isSendDisabled}>שלח</button>
        </form>
      </>
    );
  }

  const panelStyle = {
    width: panelSize.width,
    height: panelSize.height,
    ...(panelPos
      ? { position: 'fixed', left: panelPos.left, top: panelPos.top, bottom: 'unset', right: 'unset' }
      : {}),
  };

  const wrapperStyle = btnPos
    ? { left: btnPos.left, bottom: btnPos.bottom, top: 'unset', right: 'unset' }
    : {};

  return (
    <div className={styles.wrapper} style={wrapperStyle}>
      {open && (
        <div
          className={styles.panel}
          ref={panelRef}
          style={panelStyle}
          onMouseDown={handlePanelMouseDown}
        >
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>צ'ט מנהלים</span>
            <button className={styles.closeBtn} onClick={handleToggle}>×</button>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${tab === 'group' ? styles.tabBtnActive : ''}`}
              onClick={() => { setTab('group'); setPrivateUserId(null); }}
            >
              קבוצה
              {groupUnread > 0 && <span className={styles.tabBadge}>{groupUnread}</span>}
            </button>
            <button
              className={`${styles.tabBtn} ${tab === 'private' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('private')}
            >
              שיחות אישיות
              {(() => {
                const n = privateConversations.reduce((sum, c) => sum + (Number(c.unread_count) || 0), 0);
                return n > 0 ? <span className={styles.tabBadge}>{n}</span> : null;
              })()}
            </button>
          </div>

          {tab === 'group' && (
            <>
              <button
                className={styles.membersStrip}
                onClick={() => setShowMembersStrip(s => !s)}
              >
                <span>👥 {members.length} משתתפים</span>
                <span className={styles.stripArrow}>{showMembersStrip ? '▲' : '▼'}</span>
              </button>
              {showMembersStrip && (
                <div className={styles.membersStripList}>
                  {members.map(m => (
                    <span key={m.user_id} className={styles.memberChip}>
                      {getMemberName(m)}
                      {canManageMembers && (
                        <button
                          className={styles.chipRemoveBtn}
                          title="הסר מהקבוצה"
                          onClick={e => { e.stopPropagation(); removeMember(m.user_id); }}
                        >×</button>
                      )}
                    </span>
                  ))}
                  {canManageMembers && (
                    <button
                      className={styles.addChipBtn}
                      onClick={e => { e.stopPropagation(); setShowAddSearch(s => !s); }}
                    >+ הוסף</button>
                  )}
                </div>
              )}
              {canManageMembers && showMembersStrip && showAddSearch && (
                <div className={styles.addSearchInline}>
                  <input
                    className={styles.input}
                    value={addSearch}
                    onChange={e => { setAddSearch(e.target.value); searchUsers(e.target.value); }}
                    placeholder="חפש עובד להוספה..."
                    autoFocus
                  />
                  <button className={styles.cancelBtn} onClick={() => { setShowAddSearch(false); setAddSearch(''); setSearchResults([]); }}>ביטול</button>
                  {searchResults.length > 0 && (
                    <div className={styles.searchDropdown}>
                      {searchResults.map(w => (
                        <button key={w.user_id} className={styles.searchResult}
                          onClick={() => addMember(w.user_id)}>
                          {w.family_name} {w.first_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className={styles.messagesList}>
                {groupMessages.length === 0
                  ? <p className={styles.empty}>אין הודעות עדיין</p>
                  : renderMessages(groupMessages, true)}
                <div ref={messagesEndRef} />
              </div>
              {renderInputArea(sendGroupMessage, 'הודעה לכל המנהלים...')}
            </>
          )}

          {tab === 'private' && !privateUserId && (
            <div className={styles.membersList}>
              {privateConversations.length === 0 && !showPrivateSearch && (
                <p className={styles.empty}>אין שיחות</p>
              )}
              {privateConversations.map(c => (
                <div key={c.partner_id} className={styles.memberRow}>
                  <button
                    className={styles.memberBtn}
                    onClick={() => { setPrivateUserId(c.partner_id); setPrivateMessages([]); setShowPrivateSearch(false); }}
                  >
                    {c.partner_name || c.partner_username}
                  </button>
                  <button
                    className={styles.removeBtn}
                    title="הסר מהרשימה"
                    onClick={() => hideConversation(c.partner_id)}
                  >🗑</button>
                </div>
              ))}
              <div className={styles.addSection}>
                {!showPrivateSearch ? (
                  <button className={styles.addBtn} onClick={() => setShowPrivateSearch(true)}>
                    + שיחה חדשה
                  </button>
                ) : (
                  <div className={styles.addSearch}>
                    <input
                      className={styles.input}
                      value={privateSearch}
                      onChange={e => { setPrivateSearch(e.target.value); searchPrivateUsers(e.target.value); }}
                      placeholder="חפש משתמש..."
                      autoFocus
                    />
                    <button className={styles.cancelBtn} onClick={() => { setShowPrivateSearch(false); setPrivateSearch(''); setPrivateSearchResults([]); }}>ביטול</button>
                    {privateSearchResults.length > 0 && (
                      <div className={styles.searchDropdown}>
                        {privateSearchResults.map(w => (
                          <button key={w.user_id} className={styles.searchResult}
                            onClick={() => {
                              const h = getHidden(); h.delete(String(w.user_id)); saveHidden(h);
                              setPrivateUserId(w.user_id); setPrivateMessages([]);
                              setShowPrivateSearch(false); setPrivateSearch(''); setPrivateSearchResults([]);
                              fetchPrivateConversations();
                            }}>
                            {w.family_name && w.first_name ? `${w.family_name} ${w.first_name}` : w.username}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'private' && privateUserId && (
            <>
              <div className={styles.privateHeader}>
                <button className={styles.backBtn} onClick={() => { setPrivateUserId(null); fetchPrivateConversations(); }}>←</button>
                <span className={styles.privateHeaderName}>{getConvName(privateUserId)}</span>
                <button
                  className={styles.deleteConvBtn}
                  title="הסר שיחה מהרשימה"
                  onClick={() => hideConversation(privateUserId)}
                >🗑</button>
              </div>
              <div className={styles.messagesList}>
                {privateMessages.length === 0
                  ? <p className={styles.empty}>אין הודעות עדיין</p>
                  : renderMessages(privateMessages, false)}
                <div ref={messagesEndRef} />
              </div>
              {renderInputArea(sendPrivateMessage, 'הודעה...')}
            </>
          )}

          <div className={styles.resizeE}  onMouseDown={e => handleResizeMouseDown(e, 'e')} />
          <div className={styles.resizeS}  onMouseDown={e => handleResizeMouseDown(e, 's')} />
          <div className={styles.resizeSE} onMouseDown={e => handleResizeMouseDown(e, 'se')} />
        </div>
      )}

      <button
        ref={floatBtnRef}
        className={styles.floatBtn}
        onMouseDown={handleBtnMouseDown}
        onClick={() => { if (!btnDidDrag.current) handleToggle(); }}
        title="צ'ט מנהלים"
      >
        👔
        {!open && (() => {
          const privateUnread = privateConversations.reduce((sum, c) => sum + (Number(c.unread_count) || 0), 0);
          const total = groupUnread + privateUnread;
          return total > 0 ? <span className={styles.floatBadge}>{total}</span> : null;
        })()}
      </button>
    </div>
  );
}
