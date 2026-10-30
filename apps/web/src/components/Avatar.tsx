import { useId, type ReactNode } from 'react';
import { AVATAR_IDS, type AvatarId } from '@studyroom/shared';

type HairStyle = 'afro' | 'bob' | 'bun' | 'cap' | 'curls' | 'hijab' | 'long' | 'mohawk' | 'side' | 'short' | 'spikes' | 'waves';
type Accessory = 'earrings' | 'glasses' | 'headphones' | 'none' | 'round-glasses' | 'stars';

interface AvatarStyle {
  background: [string, string];
  skin: string;
  hair: string;
  shirt: string;
  accent: string;
  hairStyle: HairStyle;
  accessory: Accessory;
  expression: 'calm' | 'cheerful' | 'focused';
}

const styles: Record<AvatarId, AvatarStyle> = {
  nova:  { background: ['#7667F5', '#B9AEFF'], skin: '#8C553A', hair: '#251B35', shirt: '#FFF1A8', accent: '#5A49D8', hairStyle: 'curls', accessory: 'round-glasses', expression: 'cheerful' },
  sage:  { background: ['#1D9A72', '#9AE7CA'], skin: '#F0B58F', hair: '#4A2D22', shirt: '#E9FFF5', accent: '#087257', hairStyle: 'bun', accessory: 'earrings', expression: 'calm' },
  orbit: { background: ['#2384F6', '#9CD9FF'], skin: '#D8966E', hair: '#162539', shirt: '#EAF6FF', accent: '#0B5CC4', hairStyle: 'side', accessory: 'headphones', expression: 'focused' },
  lumen: { background: ['#F06449', '#FFD09F'], skin: '#6B3D2D', hair: '#201C25', shirt: '#FFF2E8', accent: '#C43C2B', hairStyle: 'afro', accessory: 'none', expression: 'cheerful' },
  pixel: { background: ['#E84D89', '#FFBFD8'], skin: '#F3C6A5', hair: '#583147', shirt: '#FFF0F7', accent: '#B62464', hairStyle: 'bob', accessory: 'stars', expression: 'cheerful' },
  moss:  { background: ['#527A47', '#B9DFA8'], skin: '#A96848', hair: '#2E241D', shirt: '#F3FFE8', accent: '#365B2E', hairStyle: 'short', accessory: 'glasses', expression: 'calm' },
  ember: { background: ['#E66A48', '#FFD26F'], skin: '#7D4936', hair: '#2D1715', shirt: '#FFF4D7', accent: '#B83C2B', hairStyle: 'spikes', accessory: 'none', expression: 'focused' },
  wave:  { background: ['#078DAA', '#8FE7F3'], skin: '#D28C67', hair: '#29223B', shirt: '#E5FBFF', accent: '#057087', hairStyle: 'long', accessory: 'earrings', expression: 'calm' },
  comet: { background: ['#6158E8', '#B4AEFF'], skin: '#F1B990', hair: '#3A2546', shirt: '#F1EFFF', accent: '#463AC3', hairStyle: 'mohawk', accessory: 'headphones', expression: 'cheerful' },
  bloom: { background: ['#C94E90', '#F8BDD8'], skin: '#8B563E', hair: '#2B1D24', shirt: '#FFF0F7', accent: '#9F316C', hairStyle: 'hijab', accessory: 'none', expression: 'calm' },
  atlas: { background: ['#2A7773', '#A8DDD7'], skin: '#BC7854', hair: '#33251E', shirt: '#E6FFFA', accent: '#175E5A', hairStyle: 'cap', accessory: 'none', expression: 'focused' },
  echo:  { background: ['#8057EA', '#D6C3FF'], skin: '#E2A47B', hair: '#33223F', shirt: '#F7F0FF', accent: '#6236C9', hairStyle: 'waves', accessory: 'glasses', expression: 'cheerful' },
};

function Hair({ style, color, accent }: { style: HairStyle; color: string; accent: string }): ReactNode {
  switch (style) {
    case 'afro': return <><circle cx="34" cy="31" r="14" fill={color}/><circle cx="50" cy="24" r="17" fill={color}/><circle cx="67" cy="31" r="14" fill={color}/><circle cx="28" cy="43" r="11" fill={color}/><circle cx="72" cy="43" r="11" fill={color}/></>;
    case 'bob': return <path d="M25 51c-2-27 8-41 25-41s28 14 26 41l-8 14-4-28c-9 6-19 8-31 4l-2 25Z" fill={color}/>;
    case 'bun': return <><circle cx="61" cy="15" r="12" fill={color}/><path d="M26 45c0-24 10-35 25-35 18 0 27 13 25 37-6-16-15-23-27-23-9 0-17 7-23 21Z" fill={color}/></>;
    case 'cap': return <><path d="M28 34c2-17 10-25 23-25 14 0 23 8 25 25Z" fill={accent}/><path d="M22 34h56c-8 5-19 6-31 4-10-2-18-1-25-4Z" fill="#F5D36C"/><path d="M27 43c4-8 11-12 20-12 12 0 21 6 27 17l-2 9c-7-15-15-21-26-21-8 0-14 3-19 7Z" fill={color}/></>;
    case 'curls': return <><path d="M26 48c-2-25 8-38 25-38 18 0 28 13 25 40-5-17-15-25-28-25-9 0-16 5-22 16Z" fill={color}/>{[31, 41, 52, 63, 71].map((cx, index) => <circle key={cx} cx={cx} cy={index % 2 ? 22 : 25} r="7" fill={color}/>)}</>;
    case 'hijab': return <><path d="M21 54c0-31 10-46 29-46 20 0 30 16 30 47l-8 36H28Z" fill={color}/><path d="M31 48c0-19 7-29 19-29s20 10 20 29c0 17-8 28-20 28S31 65 31 48Z" fill="#000" opacity=".12"/></>;
    case 'long': return <path d="M22 92c1-16 3-35 4-49 2-23 11-34 25-34 18 0 27 14 25 39l4 44-16-5 2-48c-8-10-19-14-34-9l3 57Z" fill={color}/>;
    case 'mohawk': return <><path d="M31 43c4-11 12-17 23-17 9 0 16 4 21 13l-2 11c-7-11-15-16-25-16-7 0-13 3-17 9Z" fill={color}/><path d="M40 27 45 5l8 17L61 2l2 25Z" fill={color}/></>;
    case 'side': return <path d="M25 46c-1-25 9-37 26-37 18 0 28 14 25 40-5-12-10-20-17-25-7 10-18 17-34 22Z" fill={color}/>;
    case 'short': return <path d="M27 40c2-21 10-31 24-31 17 0 25 12 25 34-7-12-17-18-30-18-7 0-13 5-19 15Z" fill={color}/>;
    case 'spikes': return <path d="m26 42 4-25 10 8L46 6l8 18L65 8l2 20 11-6-4 25c-8-13-17-19-28-19-8 0-15 5-20 14Z" fill={color}/>;
    case 'waves': return <path d="M24 48c-2-26 9-39 26-39 19 0 29 15 26 42-5-9-10-16-16-20-5 7-11 11-18 12 4-5 6-10 6-15-6 8-14 14-24 20Z" fill={color}/>;
  }
}

function FaceAccessory({ type, accent }: { type: Accessory; accent: string }) {
  if (type === 'glasses' || type === 'round-glasses') return <g fill="none" stroke={accent} strokeWidth="2.2"><rect x="32" y="43" width="15" height="10" rx={type === 'round-glasses' ? 5 : 3}/><rect x="53" y="43" width="15" height="10" rx={type === 'round-glasses' ? 5 : 3}/><path d="M47 47h6M28 45l4 1M68 46l4-1"/></g>;
  if (type === 'headphones') return <g><path d="M26 51c0-22 9-34 24-34s24 12 24 34" fill="none" stroke={accent} strokeWidth="5"/><rect x="22" y="46" width="9" height="19" rx="4" fill={accent}/><rect x="69" y="46" width="9" height="19" rx="4" fill={accent}/></g>;
  if (type === 'earrings') return <g fill="#FFD76B"><circle cx="27" cy="58" r="3"/><circle cx="73" cy="58" r="3"/></g>;
  if (type === 'stars') return <g fill="#FFE978"><path d="m28 31 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/><path d="m76 22 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/></g>;
  return null;
}

export function Avatar({ id, size = 72, selected = false }: { id: string; size?: number; selected?: boolean }) {
  const safe = AVATAR_IDS.includes(id as AvatarId) ? id as AvatarId : 'nova';
  const style = styles[safe];
  const gradientId = `avatar-${useId().replace(/:/g, '')}`;
  const isHijab = style.hairStyle === 'hijab';
  const smile = style.expression === 'cheerful' ? 'M42 58c5 6 12 6 17 0' : style.expression === 'focused' ? 'M44 59h12' : 'M43 58c4 3 10 3 14 0';

  return <div className={`avatar ${selected ? 'avatar-selected' : ''}`} style={{ width: size, height: size }} data-avatar={safe}>
    <svg viewBox="0 0 100 100" role="img" aria-label={`${safe} avatar`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor={style.background[0]}/><stop offset="1" stopColor={style.background[1]}/></linearGradient>
        <clipPath id={`${gradientId}-clip`}><circle cx="50" cy="50" r="49"/></clipPath>
      </defs>
      <circle cx="50" cy="50" r="49" fill={`url(#${gradientId})`}/>
      <g clipPath={`url(#${gradientId}-clip)`}>
        <circle cx="18" cy="17" r="9" fill="#fff" opacity=".14"/><circle cx="86" cy="64" r="14" fill="#fff" opacity=".1"/>
        <path d="M13 105c3-24 17-36 37-36s34 12 38 36Z" fill={style.shirt}/>
        <path d="M39 69 50 82l11-13 8 3-7 33H38l-7-33Z" fill={style.accent} opacity=".92"/>
        {isHijab && <Hair style={style.hairStyle} color={style.accent} accent={style.accent}/>} 
        {!isHijab && ['bob', 'long'].includes(style.hairStyle) && <Hair style={style.hairStyle} color={style.hair} accent={style.accent}/>} 
        <ellipse cx="50" cy="48" rx="22" ry="27" fill={style.skin}/>
        {!isHijab && !['bob', 'long'].includes(style.hairStyle) && <Hair style={style.hairStyle} color={style.hair} accent={style.accent}/>} 
        {!isHijab && ['bob', 'long'].includes(style.hairStyle) && <path d="M27 42c2-22 10-33 24-33 16 0 24 12 24 35-6-13-14-20-25-20-9 0-16 6-23 18Z" fill={style.hair}/>} 
        {isHijab && <path d="M29 42c1-22 8-33 21-33s21 11 22 33c-5-13-12-20-22-20S34 29 29 42Z" fill={style.accent}/>} 
        <path d="M35 43c3-2 7-2 10 0M55 43c3-2 7-2 10 0" fill="none" stroke="#34251F" strokeWidth="1.7" strokeLinecap="round" opacity=".75"/>
        <ellipse cx="40" cy="48" rx="2.2" ry="2.7" fill="#28201D"/><ellipse cx="60" cy="48" rx="2.2" ry="2.7" fill="#28201D"/>
        <circle cx="39.3" cy="47.2" r=".7" fill="#fff"/><circle cx="59.3" cy="47.2" r=".7" fill="#fff"/>
        <path d="M50 49l-2 6h4" fill="none" stroke="#8B5F4D" strokeWidth="1.2" strokeLinecap="round" opacity=".55"/>
        <path d={smile} fill="none" stroke="#7D3D43" strokeWidth="2" strokeLinecap="round"/>
        <FaceAccessory type={style.accessory} accent={style.hair}/>
      </g>
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="#fff" strokeOpacity=".24"/>
    </svg>
  </div>;
}
