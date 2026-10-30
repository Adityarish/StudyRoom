import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AvatarSelector } from '../src/components/AvatarSelector';

describe('AvatarSelector', () => {
  it('shows locally bundled avatar choices and updates selection', async () => { const select = vi.fn(); render(<AvatarSelector value="nova" onChange={select}/>); expect(screen.getAllByRole('button')).toHaveLength(12); await userEvent.click(screen.getByRole('button', { name: /choose sage avatar/i })); expect(select).toHaveBeenCalledWith('sage'); });
});
