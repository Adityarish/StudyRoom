import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
export function NotFoundPage() { return <main className="center-page"><Logo/><div className="empty-state"><span className="error-code">404</span><h1>This room is off the map.</h1><p>The link may be incomplete or the page no longer exists.</p><Link className="button button-primary" to="/">Back to StudyRoom</Link></div></main>; }
