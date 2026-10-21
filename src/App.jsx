import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './store.jsx';
import { Empty, Icon } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Calendar from './pages/Calendar.jsx';
import Events from './pages/Events.jsx';
import EventDetail from './pages/EventDetail.jsx';
import Invoices from './pages/Invoices.jsx';
import Money from './pages/Money.jsx';
import RevenueGraphs from './pages/RevenueGraphs.jsx';
import ExpenseGraphs from './pages/ExpenseGraphs.jsx';
import Staff from './pages/Staff.jsx';
import Attendance from './pages/Attendance.jsx';
import Import from './pages/Import.jsx';
import Settings from './pages/Settings.jsx';
import People from './pages/People.jsx';
import Expenses from './pages/Expenses.jsx';
import BalanceSheet from './pages/BalanceSheet.jsx';
import Logo from './components/Logo.jsx';
import Bin from './pages/Bin.jsx';
import Receipt from './pages/Receipt.jsx';

const OWNER_NAV = [
  { group: 'Run the garden', items: [['/', 'Dashboard', 'home'], ['/calendar', 'Calendar', 'calendar'], ['/events', 'Events and search', 'search'], ['/invoices', 'Invoices', 'file']] },
  { group: 'Money', items: [['/money', 'Revenue and profit', 'rupee'], ['/costs', 'Expenses', 'receipt'], ['/balance-sheet', 'Balance sheet', 'scale'], ['/revenue', 'Revenue graphs', 'bars'], ['/expenses', 'Expense graphs', 'pie']] },
  { group: 'Team', items: [['/attendance', 'Attendance', 'check'], ['/staff', 'Staff', 'users']] },
  { group: 'Set up', items: [['/import', 'Import old records', 'upload'], ['/bin', 'Bin', 'trash'], ['/settings', 'Settings', 'gear']] },
];
// The manager runs the day: no prices, payments, revenue, profit or invoices.
const MANAGER_NAV = [
  { group: '', items: [['/attendance', 'Attendance', 'check'], ['/calendar', 'Calendar', 'calendar'], ['/events', 'Events', 'search'], ['/staff', 'Staff', 'users']] },
];
const OWNER_TABS = [['/', 'Home', 'home'], ['/calendar', 'Calendar', 'calendar'], ['/events', 'Events', 'search'], ['/invoices', 'Invoices', 'file']];
const MANAGER_TABS = [['/attendance', 'Attendance', 'check'], ['/calendar', 'Calendar', 'calendar'], ['/events', 'Events', 'search'], ['/staff', 'Staff', 'users']];

const GROUP_KEY = { 'Run the garden': 'run', Money: 'money', Team: 'team', 'Set up': 'setup' };

function NavList({ groups, onNavigate }) {
  return (
    <nav className="nav" aria-label="Main">
      {groups.map((g) => (
        <React.Fragment key={g.group || 'main'}>
          {g.group && <div className="nav-group">{g.group}</div>}
          {g.items.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} data-group={GROUP_KEY[g.group] || 'run'}>
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </React.Fragment>
      ))}
    </nav>
  );
}

function OwnerOnly({ children }) {
  const { isOwner } = useStore();
  return isOwner ? children : <Navigate to="/attendance" replace />;
}

/** Tells the person whether their changes are safely stored. */
function SyncStatus() {
  const { sync, retrySync, backendName } = useStore();
  if (sync.status === 'error') {
    return (
      <div className="sync error" role="alert">
        Not saved yet. Trying again.
        <button className="btn small" onClick={retrySync}>Retry now</button>
      </div>
    );
  }
  return (
    <div className="sync" role="status" aria-live="polite">
      <i className={`sync-dot${sync.status === 'saving' ? ' busy' : ''}`} aria-hidden="true" />
      {sync.status === 'saving' ? 'Saving…' : backendName === 'browser' ? 'Saved in this browser' : 'All changes saved'}
    </div>
  );
}

function Toasts() {
  const { toasts, dismiss } = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span>{t.message}</span>
          {t.undo && <button onClick={() => { t.undo(); dismiss(t.id); }}>Undo</button>}
          <button className="q" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { state, dispatch, isOwner, canSwitchRole, backendName, account, signOut, people } = useStore();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const groups = isOwner
    ? OWNER_NAV.map((g) => (g.group === 'Set up' && people ? { ...g, items: [...g.items, ['/people', 'People and sign-in', 'key']] } : g))
    : MANAGER_NAV;
  const tabs = isOwner ? OWNER_TABS : MANAGER_TABS;

  const nav = useNavigate();
  // Which way the page slides in: along the order of the bottom tabs, otherwise just a soft rise.
  const prevPath = useRef(pathname);
  const [slide, setSlide] = useState(0);
  const tabPaths = tabs.map((t) => t[0]);
  useEffect(() => {
    const a = tabPaths.indexOf(prevPath.current);
    const b = tabPaths.indexOf(pathname);
    setSlide(a >= 0 && b >= 0 && a !== b ? Math.sign(b - a) : 0);
    prevPath.current = pathname;
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [pathname]);

  // Phone: swipe sideways to move between the bottom tabs (and swipe right to leave an event).
  const touch = useRef(null);
  const swipeStart = (e) => {
    if (menu || e.touches.length !== 1 || window.innerWidth > 860) { touch.current = null; return; }
    let el = e.target;
    while (el && el !== e.currentTarget) {
      if (/^(INPUT|TEXTAREA|SELECT|CANVAS)$/.test(el.tagName) || el.dataset?.noswipe !== undefined || el.classList?.contains('cal') || el.classList?.contains('ev-filters')) { touch.current = null; return; }
      if (el.scrollWidth > el.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) { touch.current = null; return; }
      el = el.parentElement;
    }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const swipeEnd = (e) => {
    const t = touch.current; touch.current = null;
    if (!t || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const i = tabPaths.indexOf(pathname);
    if (i >= 0) {
      const next = tabPaths[i + (dx < 0 ? 1 : -1)];
      if (next) nav(next);
    } else if (pathname.startsWith('/events/') && dx > 0) nav(-1);
  };
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  const brand = (
    <div className="brand">
      <Logo size={44} />
      <div className="brand-text"><span>{state.settings.gardenName}</span><small>Garden Manager</small></div>
    </div>
  );
  const foot = (
    <div className="side-foot">
      {backendName === 'browser'
        ? 'Records are saved in this browser. Download a backup from Settings now and then.'
        : <>Signed in as {account} ({isOwner ? 'owner' : 'manager'}).{signOut && <> <button className="linklike" onClick={signOut}>Sign out</button></>}</>}
    </div>
  );

  return (
    <div className="app">
      <aside className="side">
        {brand}
        <NavList groups={groups} />
        {foot}
      </aside>

      <div className="main" onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
        <header className="topbar">
          <button className="btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>
            <Icon name="menu" />
          </button>
          <div className="grow" />
          <SyncStatus />
          {canSwitchRole && (
            <label className="role-switch">
              Using the app as
              <select value={state.role} onChange={(e) => dispatch({ type: 'setRole', role: e.target.value })} aria-label="Who is using the app">
                <option value="owner">Owner (family)</option>
                <option value="manager">Manager</option>
              </select>
            </label>
          )}
          {!canSwitchRole && signOut && <button className="btn small" onClick={signOut}>Sign out</button>}
        </header>

        <main className="page page-enter" id="content" key={pathname} style={{ '--slide': `${slide * 28}px` }}>
          <Routes>
            <Route path="/" element={<OwnerOnly><Dashboard /></OwnerOnly>} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/invoices" element={<OwnerOnly><Invoices /></OwnerOnly>} />
            <Route path="/money" element={<OwnerOnly><Money /></OwnerOnly>} />
            <Route path="/costs" element={<OwnerOnly><Expenses /></OwnerOnly>} />
            <Route path="/balance-sheet" element={<OwnerOnly><BalanceSheet /></OwnerOnly>} />
            <Route path="/revenue" element={<OwnerOnly><RevenueGraphs /></OwnerOnly>} />
            <Route path="/expenses" element={<OwnerOnly><ExpenseGraphs /></OwnerOnly>} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/receipt/:paymentId" element={<OwnerOnly><Receipt /></OwnerOnly>} />
            <Route path="/bin" element={<OwnerOnly><Bin /></OwnerOnly>} />
            <Route path="/import" element={<OwnerOnly><Import /></OwnerOnly>} />
            <Route path="/settings" element={<OwnerOnly><Settings /></OwnerOnly>} />
            {people && <Route path="/people" element={<OwnerOnly><People /></OwnerOnly>} />}
            <Route
              path="*"
              element={
                <div className="card">
                  <Empty title="That page does not exist" action={<NavLink className="btn primary" to={isOwner ? '/' : '/attendance'}>Go to the start</NavLink>}>
                    The address may be old. Use the menu to find what you need.
                  </Empty>
                </div>
              }
            />
          </Routes>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Quick links">
        {tabs.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon name={icon} />
            {label}
          </NavLink>
        ))}
        <button onClick={() => setMenu(true)} aria-label="Open menu">
          <Icon name="menu" />
          Menu
        </button>
      </nav>

      {menu && (
        <>
          <div className="drawer-bg" onClick={() => setMenu(false)} />
          <aside className="drawer" aria-label="Menu">
            {brand}
            <NavList groups={groups} onNavigate={() => setMenu(false)} />
            {foot}
          </aside>
        </>
      )}

      <Toasts />
    </div>
  );
}
