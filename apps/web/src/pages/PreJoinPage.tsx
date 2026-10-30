import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Camera, CameraOff, CheckCircle2, ChevronDown, Loader2, LockKeyhole, MessageCircle, Mic, MicOff, Settings2, ShieldCheck } from 'lucide-react';
import { guestJoinSchema, type AvatarId, type PublicRoom, type QualityMode } from '@studyroom/shared';
import { AvatarSelector } from '../components/AvatarSelector';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { PasswordInput } from '../components/PasswordInput';
import { api } from '../lib/api';
import { getGuestClientId, guestSession, loadPreferences, savePreferences } from '../lib/guest';
import { useAuth } from '../context/AuthContext';

interface DeviceInfo { cameras: MediaDeviceInfo[]; microphones: MediaDeviceInfo[] }

export function PreJoinPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const stored = loadPreferences();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?redirect=${encodeURIComponent(`/room/${roomId}`)}`, { replace: true });
    }
  }, [authLoading, user, roomId, navigate]);

  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [pageError, setPageError] = useState('');
  const [loading, setLoading] = useState(true);
  const initialName: string = stored.displayName || (typeof user?.user_metadata?.displayName === 'string' ? user.user_metadata.displayName : '') || (user?.email ? (user.email.split('@')[0] ?? '') : '');
  const [name, setName] = useState<string>(initialName);
  const nameInitializedRef = useRef(Boolean(initialName.trim()));
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [avatar, setAvatar] = useState<AvatarId>((stored.avatarId || 'nova') as AvatarId);
  const [presentation, setPresentation] = useState(stored.presentation ?? 'neutral');
  const [quality, setQuality] = useState<QualityMode>(stored.quality ?? 'balanced');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo>({ cameras: [], microphones: [] });
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [password, setPassword] = useState('');
  const [joining, setJoining] = useState(false);
  const [waiting, setWaiting] = useState<{ requestId: string; requestToken: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const initialPreviewStartedRef = useRef(false);

  useEffect(() => {
    if (nameInitializedRef.current) return;
    if (user) {
      const metaName = (user.user_metadata?.displayName as string) || (user.user_metadata?.full_name as string);
      const fallback = metaName || (user.email ? user.email.split('@')[0] : '');
      const determined = stored.displayName || fallback;
      if (determined) {
        setName(determined);
        nameInitializedRef.current = true;
      }
    }
  }, [user, stored.displayName]);

  useEffect(() => {
    api.getRoom(roomId).then(r => setRoom(r.room)).catch(e => setPageError(e instanceof Error ? e.message : 'Room not found')).finally(() => setLoading(false));
  }, [roomId]);

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices({ cameras: all.filter(d => d.kind === 'videoinput'), microphones: all.filter(d => d.kind === 'audioinput') });
  }, []);

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopPreview, [stopPreview]);

  const startPreview = useCallback(async (nextCamera = cameraOn, nextMic = micOn) => {
    stopPreview(); setMediaError(''); if (!nextCamera && !nextMic) return;
    const presets: Record<QualityMode, MediaTrackConstraints> = { high: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }, balanced: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, low: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 } } };
    try {
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: nextCamera ? { ...presets[quality], ...(cameraId ? { deviceId: { exact: cameraId } } : {}) } : false, audio: nextMic ? (micId ? { deviceId: { exact: micId } } : true) : false }); }
      catch (first) { if (!nextCamera) throw first; stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 }, ...(cameraId ? { deviceId: { ideal: cameraId } } : {}) }, audio: nextMic }); }
      streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); } await refreshDevices();
    } catch (error) { setMediaError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Camera or microphone permission was denied. You can still join with both turned off.' : 'The selected device is unavailable. Choose another device or join without media.'); setCameraOn(false); setMicOn(false); }
  }, [cameraId, micId, quality, cameraOn, micOn, refreshDevices, stopPreview]);

  useEffect(() => {
    if (!room || initialPreviewStartedRef.current) return;
    initialPreviewStartedRef.current = true;
    void startPreview(true, false);
  }, [room, startPreview]);

  async function toggleCamera() { const next = !cameraOn; setCameraOn(next); await startPreview(next, micOn); }
  async function toggleMic() { const next = !micOn; setMicOn(next); await startPreview(cameraOn, next); }

  async function join() {
    if (!name.trim()) { setPageError('Enter a display name to join.'); return; }
    const joinEmail = user?.email || undefined;
    const input = guestJoinSchema.safeParse({ displayName: name, email: joinEmail, whatsappNumber: whatsappNumber.trim() || undefined, whatsappConsent: whatsappNumber.trim() && whatsappConsent ? true : undefined, avatarId: avatar, presentation, clientId: getGuestClientId(), roomPassword: password || undefined });
    if (!input.success) { setPageError(input.error.issues[0]?.message ?? 'Check the submitted information.'); return; }
    setJoining(true); setPageError('');
    try {
      const result = await api.joinRoom(roomId, input.data);
      if (result.status === 'waiting') { setWaiting(result); return; }
      stopPreview(); savePreferences({ displayName: name.trim(), email: joinEmail, avatarId: avatar, presentation, quality }); guestSession.save(roomId, result); sessionStorage.setItem(`studyroom.media.${roomId}`, JSON.stringify({ cameraOn, micOn, quality, cameraId, micId })); navigate(`/room/${roomId}/live`);
    } catch (e) { setPageError(e instanceof Error ? e.message : 'Unable to join this room'); } finally { setJoining(false); }
  }

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(async () => {
      try {
        const result = await api.waitingStatus(roomId, waiting.requestId, waiting.requestToken);
        if (result.status === 'joined') {
          clearInterval(timer);
          stopPreview();
          const joinEmail = user?.email || undefined;
          savePreferences({ displayName: name.trim(), email: joinEmail, avatarId: avatar, presentation, quality });
          guestSession.save(roomId, result);
          sessionStorage.setItem(`studyroom.media.${roomId}`, JSON.stringify({ cameraOn, micOn, quality, cameraId, micId }));
          navigate(`/room/${roomId}/live`);
        }
      } catch (e) {
        if ((e as { status?: number }).status === 403) {
          setWaiting(null);
          setPageError('The room administrator declined your request.');
        }
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [waiting, roomId, navigate, name, user, avatar, presentation, quality, cameraOn, micOn, cameraId, micId, stopPreview]);

  if (loading || authLoading) return <main className="loading-page"><Loader2 className="spin"/><p>Finding your study room…</p></main>;
  if (!user) return <main className="loading-page"><Loader2 className="spin"/><p>Redirecting to sign in…</p></main>;
  if (!room) return <main className="center-page"><Logo/><div className="empty-state"><AlertTriangle/><h1>Room unavailable</h1><p>{pageError || 'This invitation may be invalid, expired, or closed.'}</p><a className="button button-primary" href="/">Try another room</a></div></main>;
  if (waiting) return <main className="waiting-page"><Logo/><div className="waiting-card"><div className="pulse-lock"><LockKeyhole/></div><span className="kicker">Waiting room</span><h1>Your host has been notified.</h1><p>Keep this page open. You'll enter <b>{room.name}</b> as soon as an administrator approves you.</p><div className="waiting-line"><i/><i/><i/></div><button className="button button-ghost" onClick={() => setWaiting(null)}>Cancel request</button></div></main>;

  return <main className="prejoin-page"><header><Logo/><a href="/" className="back-link"><ArrowLeft size={16}/> Leave preview</a></header><div className="prejoin-shell"><section className="preview-pane"><div className="room-context"><span className="room-subject">{room.subject}</span><h1>{room.name}</h1><p>{room.description || 'A focused room for learning together.'}</p><div><span>{room.activeParticipants} in room</span><span>Up to {room.maxParticipants}</span>{room.waitingRoomEnabled && <span><ShieldCheck size={14}/> Approval required</span>}</div></div><div className={`camera-preview ${cameraOn ? 'is-live' : ''}`}><video ref={videoRef} muted playsInline/><div className="preview-avatar"><div className="avatar-preview-large"><AvatarSelectorPreview id={avatar}/></div><p>Camera is off</p></div><span className="preview-name">{name.trim() || 'Your preview'}</span><div className="preview-controls"><button type="button" className={micOn ? 'on' : 'off'} onClick={toggleMic} aria-label={micOn ? 'Mute microphone' : 'Turn on microphone'}>{micOn ? <Mic/> : <MicOff/>}</button><button type="button" className={cameraOn ? 'on' : 'off'} onClick={toggleCamera} aria-label={cameraOn ? 'Turn off camera' : 'Turn on camera'}>{cameraOn ? <Camera/> : <CameraOff/>}</button></div></div>{mediaError && <div className="inline-warning"><AlertTriangle size={18}/>{mediaError}</div>}<div className="device-row"><label><Mic size={16}/><select value={micId} onChange={async e => { setMicId(e.target.value); if (micOn) setTimeout(() => startPreview(cameraOn, true)); }}><option value="">Default microphone</option>{devices.microphones.map(d => <option value={d.deviceId} key={d.deviceId}>{d.label || `Microphone ${devices.microphones.indexOf(d) + 1}`}</option>)}</select><ChevronDown/></label><label><Camera size={16}/><select value={cameraId} onChange={async e => { setCameraId(e.target.value); if (cameraOn) setTimeout(() => startPreview(true, micOn)); }}><option value="">Default camera</option>{devices.cameras.map(d => <option value={d.deviceId} key={d.deviceId}>{d.label || `Camera ${devices.cameras.indexOf(d) + 1}`}</option>)}</select><ChevronDown/></label></div><p className="permission-note"><LockKeyhole size={14}/> Devices activate only when you choose. Nothing is recorded by StudyRoom.</p></section>
    <section className="identity-pane"><div className="identity-form"><div className="identity-heading"><span className="step-label">One last step</span><h2>How should the group see you?</h2><p>Your Supabase profile saves your presence across study sessions.</p></div><label className="field-label"><span className="field-title">Display name</span><input maxLength={48} value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name"/><small className="field-counter">{name.length}/48</small></label><div className="auth-account-badge"><div className="auth-badge-info"><div className="auth-badge-top"><span className="auth-badge-title"><ShieldCheck size={14}/> Verified Supabase account</span><button type="button" className="auth-switch-link" onClick={async () => { await signOut(); navigate(`/login?redirect=${encodeURIComponent(`/room/${roomId}`)}`); }}>Switch account</button></div><span className="auth-badge-email">{user.email}</span></div><small className="field-hint">Your email connects your profile and lets hosts recognize you on repeat visits.</small></div><div className="whatsapp-field"><label className="field-label"><span className="field-title"><MessageCircle size={15}/> Indian WhatsApp number <em>optional</em></span><input type="tel" inputMode="tel" autoComplete="tel" maxLength={32} value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="+91 98765 43210"/><small className="field-hint">Lets the host prepare a free Click-to-Chat invitation. StudyRoom never sends it automatically.</small></label>{whatsappNumber.trim() && <label className="whatsapp-consent"><input type="checkbox" checked={whatsappConsent} onChange={e => setWhatsappConsent(e.target.checked)}/><span>Save this number as an opted-in StudyRoom contact for manual WhatsApp invitations.</span></label>}</div><AvatarSelector value={avatar} onChange={setAvatar}/><label className="field-label"><span className="field-title">Avatar presentation <em>optional</em></span><select value={presentation} onChange={e => setPresentation(e.target.value)}><option value="neutral">No preference</option><option value="feminine">Feminine</option><option value="masculine">Masculine</option></select></label><fieldset className="quality-picker"><legend><Settings2 size={16}/> Video quality preference</legend>{(['high','balanced','low'] as QualityMode[]).map(mode => <label key={mode} className={quality === mode ? 'selected' : ''}><input type="radio" name="quality" checked={quality === mode} onChange={() => setQuality(mode)}/><span><b>{mode === 'low' ? 'Low-resource' : mode[0]!.toUpperCase() + mode.slice(1)}</b><small>{mode === 'high' ? 'Up to 1080p · best detail' : mode === 'balanced' ? '720p · recommended' : '360–480p · saves battery'}</small></span>{quality === mode && <CheckCircle2/>}</label>)}</fieldset>{room.passwordRequired && <label className="field-label"><span className="field-title"><LockKeyhole size={15}/> Room password</span><PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter room password" autoComplete="current-password"/></label>}{pageError && <div className="form-error" role="alert">{pageError}</div>}<button className="button button-primary button-wide join-button" disabled={joining} onClick={join}>{joining ? <><Loader2 className="spin"/> Joining…</> : 'Join study room'}</button><p className="join-summary">You'll join with camera {cameraOn ? 'on' : 'off'} and microphone {micOn ? 'on' : 'muted'}.</p></div></section></div></main>;
}

function AvatarSelectorPreview({ id }: { id: string }) { return <Avatar id={id} size={128}/>; }
