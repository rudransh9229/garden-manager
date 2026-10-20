import React from 'react';
import { Link } from 'react-router-dom';
import ReminderButton from './ReminderButton.jsx';
import { diffDays } from '../lib/dates.js';
import { fmtDate, inr, plural } from '../lib/format.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** The first thing on the dashboard: what is happening today, or the next event and what is still due on it. */
export default function NextUp({ upcoming, today, onNewBooking }) {
  const todays = upcoming.filter((r) => r.booking.date === today);
  const lead = todays[0] || upcoming[0];
  const days = lead ? diffDays(lead.booking.date, today) : null;
  const headline = !lead ? 'No events in the next 30 days'
    : todays.length ? (todays.length > 1 ? `${plural(todays.length, 'event')} today` : 'An event today')
      : days === 1 ? 'Next event is tomorrow' : `Next event in ${days} days`;

  return (
    <section className="nextup" aria-label="Today and the next event">
      <div className="garland" aria-hidden="true" />
      <div className="nextup-body">
        <div className="nextup-hello">{greeting()}</div>
        <h1 className="nextup-title">{headline}</h1>
        {lead ? (
          <div className="nextup-event">
            <div className="nextup-date" aria-hidden="true"><b>{lead.day}</b><span>{fmtDate(lead.booking.date).split(' ')[1]}</span></div>
            <div className="grow">
              <div className="nextup-name"><Link to={`/events/${lead.id}`}>{lead.client.name}</Link></div>
              <div className="nextup-meta">{lead.eventType}{lead.booking.guests > 0 ? `, ${plural(lead.booking.guests, 'guest')}` : ''}, {lead.booking.status.toLowerCase()}</div>
              {lead.counted && lead.pending > 0
                ? <div className="nextup-due">{inr(lead.pending)} still to collect <ReminderButton row={lead} small /></div>
                : lead.counted ? <div className="nextup-ok">Fully paid</div> : null}
            </div>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={onNewBooking}>Add a booking</button><Link className="btn" to="/calendar">Open calendar</Link></div>
        )}
        {todays.length > 1 && <p className="nextup-more">Also today: {todays.slice(1).map((r) => r.client.name).join(', ')}</p>}
      </div>
    </section>
  );
}
