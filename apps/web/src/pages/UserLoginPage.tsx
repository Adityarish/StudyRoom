import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, LockKeyhole, Mail, Sparkles, User as UserIcon } from 'lucide-react';
import { PasswordInput } from '../components/PasswordInput';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

export function UserLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '';
  const isRoomInvite = Boolean(redirect && redirect.startsWith('/room/'));

  const { user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // If already logged in, redirect immediately
  useEffect(() => {
    if (user) {
      navigate(redirect || '/', { replace: true });
    }
  }, [user, redirect, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (mode === 'signup') {
        const result = await signUp(email, password, displayName);
        if (result.error) {
          setError(result.error);
        } else {
          navigate(redirect || '/', { replace: true });
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          navigate(redirect || '/', { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <Logo light />
        <div>
          <div className="auth-mark">
            <LockKeyhole />
          </div>
          <h1>{isRoomInvite ? 'You are invited to a study session.' : 'Find your flow. Learn together.'}</h1>
          <p>
            {isRoomInvite
              ? 'Sign in or create an account to enter your study room. Your account saves your profile and lets the room recognize you.'
              : 'Create an account or sign in with Supabase to keep your study presence consistent across all sessions.'}
          </p>
        </div>
        <small>Powered by Supabase Authentication. Your credentials and session are protected.</small>
      </section>

      <section className="auth-form-wrap">
        <a href="/" className="back-link">
          <ArrowLeft size={16} /> Back to StudyRoom
        </a>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="eyebrow">
            <Sparkles size={15} /> {isRoomInvite ? 'Study Room Invitation' : 'StudyRoom Account'}
          </div>

          <h2>{mode === 'signin' ? 'Sign in' : 'Create an account'}</h2>
          <p>
            {isRoomInvite
              ? mode === 'signin'
                ? 'Sign in to join your study room without entering your email again.'
                : 'Create an account to join your study room with a permanent profile.'
              : mode === 'signin'
              ? 'Enter your email and password to continue.'
              : 'Sign up to keep your presence and name consistent.'}
          </p>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => { setMode('signin'); setError(''); }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); }}
            >
              Create account
            </button>
          </div>

          {mode === 'signup' && (
            <label>
              Display Name
              <div className="input-with-icon">
                <UserIcon size={16} />
                <input
                  type="text"
                  maxLength={48}
                  placeholder="e.g. Alex Rivera"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </div>
            </label>
          )}

          <label>
            Email address
            <div className="input-with-icon">
              <Mail size={16} />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label>
            Password
            <PasswordInput
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}

          <button className="button button-primary button-wide" disabled={busy}>
            {busy ? (
              <><Loader2 className="spin" size={16} /> {mode === 'signin' ? 'Signing in…' : 'Creating account…'}</>
            ) : mode === 'signin' ? (
              <><Check size={16} /> Sign in & continue</>
            ) : (
              <><Check size={16} /> Create account & continue</>
            )}
          </button>

          <div className="auth-switch-prompt">
            {mode === 'signin' ? (
              <span>
                Don't have an account yet?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(''); }}>
                  Create one now
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(''); }}>
                  Sign in
                </button>
              </span>
            )}
          </div>

          <small className="privacy-note">
            Your verified email automatically connects you to your study room profile across repeat joins.
          </small>
        </form>
      </section>
    </main>
  );
}

