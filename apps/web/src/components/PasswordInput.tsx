import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return <div className="password-input">
    <input {...props} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-visibility" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}>
      {visible ? <EyeOff size={17}/> : <Eye size={17}/>}
    </button>
  </div>;
}
