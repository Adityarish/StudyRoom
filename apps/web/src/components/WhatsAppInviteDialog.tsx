import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, MessageCircle, Users, X } from 'lucide-react';
import type { PreparedWhatsAppInvitation, WhatsAppContact } from '@studyroom/shared';
import { copyText } from '../lib/clipboard';

interface Props {
  open: boolean;
  roomName: string;
  contacts: WhatsAppContact[];
  loading?: boolean;
  onClose: () => void;
  onPrepare: (targetSessionIds: string[]) => Promise<PreparedWhatsAppInvitation[]>;
  onOpened: (invitationId: string) => Promise<unknown>;
}

export function WhatsAppInviteDialog({ open, roomName, contacts, loading = false, onClose, onPrepare, onOpened }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [invitations, setInvitations] = useState<PreparedWhatsAppInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  useEffect(() => { if (open) { setSelected([]); setInvitations([]); setError(''); setCopied(''); } }, [open, roomName]);
  if (!open) return null;
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const prepare = async () => {
    if (!selected.length) { setError('Select at least one participant.'); return; }
    setBusy(true); setError('');
    try { setInvitations(await onPrepare(selected)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to prepare WhatsApp invitations.'); }
    finally { setBusy(false); }
  };
  const copyMessage = async (invitation: PreparedWhatsAppInvitation) => {
    try { await copyText(invitation.message); setCopied(invitation.id); window.setTimeout(() => setCopied(''), 1600); }
    catch { setError('The browser blocked copying.'); }
  };
  return <div className="whatsapp-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="whatsapp-modal" role="dialog" aria-modal="true" aria-labelledby="whatsapp-invite-title">
      <header><div className="whatsapp-mark"><MessageCircle/></div><div><span>Free · manual send</span><h2 id="whatsapp-invite-title">Notify on WhatsApp</h2><p>{roomName}</p></div><button aria-label="Close WhatsApp invitations" onClick={onClose}><X/></button></header>
      {invitations.length === 0 ? <>
        <div className="whatsapp-explainer"><b>Select participants</b><p>StudyRoom prepares a private Click-to-Chat link. WhatsApp opens with the message filled in, and you press <b>Send</b> yourself.</p></div>
        <div className="whatsapp-selection-head"><span><Users/> {selected.length} selected</span>{contacts.length > 0 && <button onClick={() => setSelected(selected.length === contacts.length ? [] : contacts.map(contact => contact.id))}>{selected.length === contacts.length ? 'Clear all' : 'Select all'}</button>}</div>
        <div className="whatsapp-contact-list">{loading ? <div className="whatsapp-empty"><Loader2 className="spin"/> Loading opted-in contacts…</div> : contacts.length === 0 ? <div className="whatsapp-empty"><MessageCircle/><b>No WhatsApp contacts yet</b><p>Participants appear here after they enter an Indian WhatsApp number and opt in on the join screen.</p></div> : contacts.map(contact => <label key={contact.id} className={selected.includes(contact.id) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(contact.id)} onChange={() => toggle(contact.id)}/><span>{contact.displayName.slice(0, 1).toUpperCase()}</span><div><b>{contact.displayName}</b><small>{contact.maskedNumber}</small></div><i><Check/></i></label>)}</div>
        {error && <div className="whatsapp-error" role="alert">{error}</div>}
        <footer><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="whatsapp-primary" disabled={busy || !selected.length} onClick={prepare}>{busy ? <Loader2 className="spin"/> : <MessageCircle/>} Prepare {selected.length || ''} invitation{selected.length === 1 ? '' : 's'}</button></footer>
      </> : <>
        <div className="whatsapp-ready"><Check/><div><b>{invitations.length} invitation{invitations.length === 1 ? '' : 's'} prepared</b><p>Open each contact below. Nothing has been marked sent or delivered.</p></div></div>
        <div className="whatsapp-send-list">{invitations.map(invitation => <article key={invitation.id}><div><b>{invitation.recipientName}</b><small>Prepared · you still need to press Send</small></div><div><button onClick={() => void copyMessage(invitation)} title="Copy invitation message">{copied === invitation.id ? <Check/> : <Copy/>}</button><a href={invitation.whatsappUrl} target="_blank" rel="noreferrer" onClick={() => void onOpened(invitation.id).catch(() => {})}><MessageCircle/> Open WhatsApp <ExternalLink/></a></div></article>)}</div>
        <footer><button className="button button-ghost" onClick={() => { setInvitations([]); setSelected([]); }}>Invite more</button><button className="button button-primary" onClick={onClose}>Done</button></footer>
      </>}
    </section>
  </div>;
}
