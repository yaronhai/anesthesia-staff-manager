import { useState, useRef } from 'react';
import { useDraggableModal } from '../hooks/useDraggableModal';
import { LANGUAGES, T } from './helpTranslations';
import s from '../styles/HelpModal.module.scss';

export default function HelpModal({ isAdmin, onClose }) {
  const [lang, setLang] = useState('he');
  const { modalRef, dragHandleProps, modalStyle, overlayClass } = useDraggableModal();
  const contentRef = useRef(null);

  const t = T[lang];
  const dir = LANGUAGES.find(l => l.code === lang)?.dir ?? 'rtl';

  function scrollTo(id) {
    const el = contentRef.current?.querySelector(`#help-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className={overlayClass} onClick={onClose}>
      <div
        className={s.modal}
        ref={modalRef}
        style={modalStyle}
        dir={dir}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={s.header} {...dragHandleProps}>
          <span className={s.title}>{t.title}</span>
          <div className={s.headerRight}>
            <select
              className={s.langSelect}
              value={lang}
              onChange={e => setLang(e.target.value)}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <button className={s.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={s.body}>
          {/* Sidebar nav */}
          <nav className={s.nav}>
            <div className={s.navGroup}>
              <div className={s.navGroupLabel}>{t.navUser}</div>
              {[
                { id: 'profile',   label: t.profile.nav },
                { id: 'shifts',    label: t.shifts.nav },
                { id: 'vacations', label: t.vacations.nav },
                { id: 'messages',  label: t.messages.nav },
              ].map(sec => (
                <button key={sec.id} className={s.navLink} onClick={() => scrollTo(sec.id)}>
                  {sec.label}
                </button>
              ))}
            </div>
            {isAdmin && (
              <div className={s.navGroup}>
                <div className={s.navGroupLabel}>{t.navAdmin}</div>
                {[
                  { id: 'workers',          label: t.workers.nav },
                  { id: 'rooms',            label: t.rooms.nav },
                  { id: 'rooms-manual',     label: t.rooms.nav_manual, indent: true },
                  { id: 'rooms-auto',       label: t.rooms.nav_auto,   indent: true },
                  { id: 'special-days',     label: t.specialDays.nav },
                  { id: 'report',           label: t.report.nav },
                  { id: 'profile-requests', label: t.profileRequests.nav },
                  { id: 'events',           label: t.events.nav },
                  { id: 'settings',         label: t.settings.nav },
                ].map(sec => (
                  <button
                    key={sec.id}
                    className={`${s.navLink}${sec.indent ? ` ${s.navLinkIndent}` : ''}`}
                    onClick={() => scrollTo(sec.id)}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>
            )}
          </nav>

          {/* Content */}
          <div className={s.content} ref={contentRef}>

            {/* ── My Profile ── */}
            <section id="help-profile">
              <h2>{t.profile.h2}</h2>
              <p>{t.profile.desc}</p>
              <h3>{t.profile.h3Edit}</h3>
              <ul>{t.profile.editItems.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <h3>{t.profile.h3Photo}</h3>
              <ol>{t.profile.photoSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
            </section>

            {/* ── Shift Requests ── */}
            <section id="help-shifts">
              <h2>{t.shifts.h2}</h2>
              <p>{t.shifts.desc}</p>
              <h3>{t.shifts.h3Types}</h3>
              <table>
                <thead><tr><th>{t.colSymbol}</th><th>{t.colName}</th><th>{t.colDesc}</th></tr></thead>
                <tbody>{t.shifts.shiftRows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
              </table>
              <h3>{t.shifts.h3Pref}</h3>
              <table>
                <thead><tr><th>{t.colSymbol}</th><th>{t.colName}</th><th>{t.colMeaning}</th></tr></thead>
                <tbody>{t.shifts.prefRows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
              </table>
              <h3>{t.shifts.h3How}</h3>
              <ol>{t.shifts.howSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
              <h3>{t.shifts.h3Default}</h3>
              <p>{t.shifts.defaultDesc}</p>
              <h3>{t.shifts.h3Lock}</h3>
              <p>{t.shifts.lockDesc}</p>
              <h3>{t.shifts.h3Approval}</h3>
              <ul>{t.shifts.approvalWorkerItems.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <ul>{t.shifts.approvalAdminItems.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </section>

            {/* ── Vacation Requests ── */}
            <section id="help-vacations">
              <h2>{t.vacations.h2}</h2>
              <h3>{t.vacations.h3Submit}</h3>
              <ol>{t.vacations.submitSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
              <h3>{t.vacations.h3Status}</h3>
              <table>
                <thead><tr><th>{t.colStatus}</th><th>{t.colMeaning}</th></tr></thead>
                <tbody>{t.vacations.statusRows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td></tr>)}</tbody>
              </table>
              <h3>{t.vacations.h3Cancel}</h3>
              <p>{t.vacations.cancelDesc}</p>
            </section>

            {/* ── Messages ── */}
            <section id="help-messages">
              <h2>{t.messages.h2}</h2>
              <h3>{t.messages.h3Direct}</h3>
              <p>{t.messages.directDesc}</p>
              <h3>{t.messages.h3Content}</h3>
              <ul>{t.messages.contentItems.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <h3>{t.messages.h3Badge}</h3>
              <p>{t.messages.badgeDesc}</p>
              <h3>{t.messages.h3ShiftApproval}</h3>
              <ul>{t.messages.shiftApprovalItems.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </section>

            {/* ══ ADMIN SECTIONS ══ */}
            {isAdmin && (
              <>
                <div className={s.divider}><span>{t.adminDivider}</span></div>

                {/* ── Workers ── */}
                <section id="help-workers">
                  <h2>{t.workers.h2}</h2>
                  <h3>{t.workers.h3List}</h3>
                  <ul>{t.workers.listItems.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  <h3>{t.workers.h3Add}</h3>
                  <table>
                    <thead><tr><th>{t.workers.addColTab}</th><th>{t.workers.addColFields}</th></tr></thead>
                    <tbody>{t.workers.addRows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td></tr>)}</tbody>
                  </table>
                  <h3>{t.workers.h3Auth}</h3>
                  <ol>{t.workers.authSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
                  <div className={s.tip}>{t.workers.tip}</div>
                </section>

                {/* ── Rooms ── */}
                <section id="help-rooms">
                  <h2>{t.rooms.h2}</h2>
                  <p>{t.rooms.desc}</p>
                  <h3>{t.rooms.h3Colors}</h3>
                  <table>
                    <thead><tr><th>{t.colColor}</th><th>{t.colMeaning}</th></tr></thead>
                    <tbody>{t.rooms.colorRows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td></tr>)}</tbody>
                  </table>
                </section>

                {/* ── Manual ── */}
                <section id="help-rooms-manual">
                  <h2>{t.rooms.h2Manual}</h2>
                  <ol>{t.rooms.manualSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
                  <p>{t.rooms.manualEdit}</p>
                </section>

                {/* ── Auto ── */}
                <section id="help-rooms-auto">
                  <h2>{t.rooms.h2Auto}</h2>
                  <p>{t.rooms.autoDesc}</p>
                  <h3>{t.rooms.h3AutoSteps}</h3>
                  <ol>{t.rooms.autoSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
                  <h3>{t.rooms.h3Score}</h3>
                  <div className={s.formula}>
                    <div>{t.rooms.formula}</div>
                    <div className={s.formulaDetail}>
                      {t.rooms.formulaLines.map((x, i) => <span key={i}>{x}</span>)}
                    </div>
                  </div>
                  <h3>{t.rooms.h3Unfilled}</h3>
                  <ul>{t.rooms.unfilledItems.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </section>

                {/* ── Special Days ── */}
                <section id="help-special-days">
                  <h2>{t.specialDays.h2}</h2>
                  <p>{t.specialDays.desc}</p>
                  <ol>{t.specialDays.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
                  <p>{t.specialDays.note}</p>
                </section>

                {/* ── Report ── */}
                <section id="help-report">
                  <h2>{t.report.h2}</h2>
                  <p>{t.report.desc}</p>
                  <ul>{t.report.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </section>

                {/* ── Profile Requests ── */}
                <section id="help-profile-requests">
                  <h2>{t.profileRequests.h2}</h2>
                  <p>{t.profileRequests.desc1}</p>
                  <p>{t.profileRequests.desc2}</p>
                  <ul>{t.profileRequests.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </section>

                {/* ── Events ── */}
                <section id="help-events">
                  <h2>{t.events.h2}</h2>
                  <h3>{t.events.h3Create}</h3>
                  <ol>{t.events.createSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
                  <h3>{t.events.h3Predict}</h3>
                  <p>{t.events.predictDesc}</p>
                  <h3>{t.events.h3Optimize}</h3>
                  <p>{t.events.optimizeDesc}</p>
                  {t.events.h3OptimizeAlgo && <>
                    <h4>{t.events.h3OptimizeAlgo}</h4>
                    <ol>{(t.events.optimizeAlgoSteps || []).map((x, i) => <li key={i}>{x}</li>)}</ol>
                    <h4>{t.events.h3OptimizeLimits}</h4>
                    <ul>{(t.events.optimizeLimitItems || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </>}
                </section>

                {/* ── Settings ── */}
                <section id="help-settings">
                  <h2>{t.settings.h2}</h2>
                  <p>{t.settings.desc}</p>
                  <table>
                    <thead><tr><th>{t.settings.colTab}</th><th>{t.settings.colDesc}</th></tr></thead>
                    <tbody>{t.settings.settingsRows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td></tr>)}</tbody>
                  </table>
                  <h3>{t.settings.h3JobRestrict}</h3>
                  <p>{t.settings.jobRestrictDesc}</p>
                  <h3>{t.settings.h3LockModes}</h3>
                  <table>
                    <thead><tr><th>{t.settings.lockColMode}</th><th>{t.settings.lockColDesc}</th></tr></thead>
                    <tbody>{t.settings.lockRows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td></tr>)}</tbody>
                  </table>
                </section>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
