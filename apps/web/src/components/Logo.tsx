import { Link } from 'react-router-dom';

export function Logo({ light = false }: { light?: boolean }) {
  return <Link to="/" className={`logo ${light ? 'logo-light' : ''}`} aria-label="StudyRoom home">
    <span className="logo-mark"><i /><i /><i /></span><span>StudyRoom</span>
  </Link>;
}
