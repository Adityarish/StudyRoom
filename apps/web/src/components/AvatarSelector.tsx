import { AVATAR_IDS, type AvatarId } from '@studyroom/shared';
import { Check } from 'lucide-react';
import { Avatar } from './Avatar';

const labels: Record<AvatarId, string> = {
  nova: 'Nova', sage: 'Sage', orbit: 'Orbit', lumen: 'Lumen', pixel: 'Pixel', moss: 'Moss',
  ember: 'Ember', wave: 'Wave', comet: 'Comet', bloom: 'Bloom', atlas: 'Atlas', echo: 'Echo',
};

export function AvatarSelector({ value, onChange }: { value: string; onChange: (id: AvatarId) => void }) {
  return <fieldset className="avatar-fieldset"><legend>Choose your study avatar <span>12 unique styles</span></legend><div className="avatar-grid">
    {AVATAR_IDS.map(id => <button type="button" key={id} className={value === id ? 'selected' : ''} aria-label={`Choose ${labels[id]} avatar`} aria-pressed={value === id} onClick={() => onChange(id)}><span className="avatar-option-art"><Avatar id={id} size={64} selected={value === id}/>{value === id && <i aria-hidden="true"><Check/></i>}</span><span>{labels[id]}</span></button>)}
  </div></fieldset>;
}
