import React from 'react';
import { useStore } from '../store.jsx';
import { whatsappLink } from '../lib/reminder.js';

/** Opens WhatsApp with a payment reminder ready for the client. Shows nothing when nothing is due. */
export default function ReminderButton({ row, small }) {
  const { state, isOwner } = useStore();
  if (!isOwner || !row.counted || row.pending <= 0) return null;
  const link = whatsappLink(row, state.settings.gardenName, state.settings.reminderText);
  if (!link) return <span className="small muted">No phone number</span>;
  return (
    <a className={`btn${small ? ' small' : ''}`} href={link} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp reminder for ${row.client.name}`}>{small ? 'Remind' : 'WhatsApp reminder'}</a>
  );
}
