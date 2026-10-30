import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BatteryCharging, BookOpen, Check, Clock3, Headphones, LockKeyhole, MessageCircle, MonitorUp, ShieldCheck, Sparkles, UsersRound, Video, Wifi, Zap } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const join = () => {
    const raw = code.trim();
    if (!raw) return;
    const match = raw.match(/\/room\/([^/?#]+)/);
    navigate(`/room/${encodeURIComponent(match?.[1] ?? raw)}`);
  };
  return <div className="landing">
    <nav className="landing-nav"><Logo /><div className="nav-links"><a href="#features">Features</a><a href="#how">How it works</a><a href="#privacy">Privacy</a>{user ? <div className="nav-user-pill"><span className="nav-user-email">{user.email}</span><button type="button" className="nav-signout" onClick={() => void signOut()}>Sign out</button></div> : <a href="/login" className="nav-login-link">Sign in</a>}<a className="button button-ghost nav-admin" href="/admin/login"><span>Host a room</span><ArrowRight size={16}/></a></div></nav>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-pulse"/><Sparkles size={15}/> Built for study groups, not boardrooms</div>
          <h1>Find your flow.<br/><span>Learn together.</span></h1>
          <p>Step into a calm, high-quality study room in seconds. No account or installation—just your group, your goals, and space to focus.</p>
          <div className="join-box"><div><label htmlFor="room-code">Invitation link or room code</label><input id="room-code" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()} placeholder="Paste your invite or enter a code" /></div><button type="button" className="button button-primary" onClick={join}>Join room <ArrowRight size={18}/></button></div>
          <div className="trust-row"><span><Check/>No sign-up</span><span><Check/>Private by design</span><span><Check/>Works in your browser</span></div>
          <div className="hero-proof"><div className="proof-avatars"><i>T</i><i>A</i><i>P</i><i>+8</i></div><div><b>Made for real study sessions</b><span>Video, focus chat and screen sharing in one place</span></div></div>
        </div>
        <div className="hero-visual" aria-label="StudyRoom meeting preview">
          <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
          <div className="visual-glow visual-glow-one"/><div className="visual-glow visual-glow-two"/>
          <div className="mock-window"><div className="mock-top"><span/><span/><span/><b>Physics Study · Deep work</b><em><i/> Live</em></div><div className="mock-grid">
            <MockPerson color="#8f7af5" name="Tushita" initial="T" active/><MockPerson color="#ef8f74" name="Aditya" initial="A"/><MockPerson color="#3ca987" name="Poorva" initial="P"/><MockPerson color="#4b8ce8" name="Abhishek" initial="A"/>
          </div><div className="mock-controls"><i><Video/></i><i><Headphones/></i><i className="mock-call"/><i><MonitorUp/></i></div></div>
          <div className="float-card float-chat"><MessageCircle size={19}/><div><b>New idea shared</b><small>Notes stay with the room</small></div></div>
          <div className="float-card float-quality"><Wifi size={19}/><div><b>Excellent quality</b><small>Adaptive HD · up to 1080p</small></div></div>
          <div className="float-card float-focus"><Clock3 size={19}/><div><b>42 min focus</b><small>Your group is in flow</small></div></div>
        </div>
      </section>
      <section className="feature-strip" aria-label="StudyRoom benefits"><span><Video/> Adaptive HD</span><span>•</span><span><Zap/> Instant entry</span><span>•</span><span><UsersRound/> Built for groups</span><span>•</span><span><ShieldCheck/> Guest-first privacy</span></section>
      <section className="section features" id="features"><div className="section-heading"><span className="kicker">Made for focused work</span><h2>Everything your group needs.<br/>Nothing it doesn't.</h2></div><div className="feature-grid">
        <Feature icon={<Video/>} title="Crisp, adaptive video" text="High, balanced, and low-resource modes adapt to your camera, network, and screen layout." tone="violet" />
        <Feature icon={<LockKeyhole/>} title="Walk in as a guest" text="A name and avatar are all you need. Email reminders are optional and room passwords are set only by hosts." tone="green" />
        <Feature icon={<MonitorUp/>} title="Share what matters" text="Present code, notes, or a lecture with readable, high-detail screen sharing." tone="orange" />
        <Feature icon={<BatteryCharging/>} title="Kind to your battery" text="Audio-only mode, adaptive subscriptions, and efficient layouts reduce unnecessary work." tone="blue" />
        <Feature icon={<MessageCircle/>} title="Conversation in context" text="Validated, room-scoped real-time chat keeps questions alongside the session." tone="pink" />
        <Feature icon={<ShieldCheck/>} title="Host controls that work" text="Room capacity, waiting rooms, expiry, participant removal, and room deletion are enforced by the server." tone="gold" />
      </div></section>
      <section className="section steps" id="how"><div className="steps-card"><div><span className="kicker light">A calmer way to connect</span><h2>From link to learning<br/>in three small steps.</h2><p>StudyRoom keeps setup out of your way, while giving room owners the controls they need.</p></div><ol><li><b>01</b><span><strong>Open an invite</strong><small>Paste a room code or follow a shared link.</small></span></li><li><b>02</b><span><strong>Make it yours</strong><small>Pick a name, avatar, and device settings.</small></span></li><li><b>03</b><span><strong>Start studying</strong><small>Join with no account and focus together.</small></span></li></ol></div></section>
      <section className="section privacy" id="privacy"><div><BookOpen/><span className="kicker">Respect is the default</span><h2>Your study session isn't our data source.</h2><p>Camera and microphone access always require browser permission. Meetings are never recorded by default, guest identities are temporary, and sensitive infrastructure credentials stay on the server.</p></div><div className="privacy-points"><p><Check/>No participant accounts</p><p><Check/>No recording by default</p><p><Check/>Short-lived meeting access</p><p><Check/>Minimal guest data</p></div></section>
      <section className="cta"><div><span className="kicker light">Your next session starts here</span><h2>Bring the group.<br/>Leave the login behind.</h2></div><button className="button button-light" onClick={() => document.getElementById('room-code')?.focus()}>Join a room <ArrowRight size={18}/></button></section>
    </main>
    <footer><Logo light/><p>Built for focused minds and shared progress.</p><span>© {new Date().getFullYear()} StudyRoom</span></footer>
  </div>;
}

function Feature({ icon, title, text, tone }: { icon: React.ReactNode; title: string; text: string; tone: string }) { return <article className="feature-card"><div className={`feature-icon ${tone}`}>{icon}</div><h3>{title}</h3><p>{text}</p><a href="#how">Learn more <ArrowRight size={15}/></a></article>; }
function MockPerson({ color, name, initial, active }: { color: string; name: string; initial: string; active?: boolean }) { return <div className={`mock-person ${active ? 'mock-active' : ''}`} style={{ background: `${color}22` }}><span style={{ background: color }}>{initial}</span><b>{name}</b><i/></div>; }
