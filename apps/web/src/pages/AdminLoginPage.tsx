import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, LockKeyhole } from 'lucide-react';
import { PasswordInput } from '../components/PasswordInput';
import { Logo } from '../components/Logo';
import { api } from '../lib/api';

export function AdminLoginPage() {
  const navigate = useNavigate(); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api.adminMe().then(r => { localStorage.setItem('studyroom.csrf', r.csrfToken); navigate('/admin/rooms', { replace: true }); }).catch(() => {}); }, [navigate]);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const result = await api.adminLogin({ username, password }); localStorage.setItem('studyroom.csrf', result.csrfToken); navigate('/admin/rooms'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in'); } finally { setBusy(false); } }
  return <main className="auth-page"><section className="auth-brand"><Logo light/><div><div className="auth-mark"><LockKeyhole/></div><h1>Rooms with boundaries.<br/>Study without barriers.</h1><p>Private controls for the people who create and manage StudyRoom spaces.</p></div><small>Administrator access is provisioned privately. There is no public registration.</small></section><section className="auth-form-wrap"><a href="/" className="back-link"><ArrowLeft size={16}/> Back to StudyRoom</a><form className="auth-form" onSubmit={submit}><div className="eyebrow"><KeyRound size={15}/> Administrator access</div><h2>Welcome back</h2><p>Sign in to create and manage study rooms.</p><label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required/></label><label>Password<PasswordInput autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10}/></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary button-wide" disabled={busy}>{busy ? 'Signing in…' : 'Open dashboard'}</button><small className="privacy-note">Protected by an HTTP-only session, CSRF validation, and rate limiting.</small></form></section></main>;
}
