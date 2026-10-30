import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WhatsAppInviteDialog } from '../src/components/WhatsAppInviteDialog';

describe('WhatsAppInviteDialog', () => {
  it('requires manual selection and presents an individual Click-to-Chat link', async () => {
    const user = userEvent.setup();
    const prepare = vi.fn(async () => [{
      id: 'invitation-1', recipientName: 'Asha', message: 'Hello Asha',
      whatsappUrl: 'https://wa.me/919876543210?text=Hello%20Asha', status: 'prepared' as const,
    }]);
    render(<WhatsAppInviteDialog open roomName="Physics Circle" contacts={[{ id: '11111111-1111-4111-8111-111111111111', displayName: 'Asha', maskedNumber: '+91 ••••••3210' }]} onClose={vi.fn()} onPrepare={prepare} onOpened={vi.fn(async () => {})}/>);

    expect(screen.getByText(/you press/i)).toHaveTextContent('Send');
    expect(screen.getByRole('button', { name: /prepare/i })).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /prepare 1 invitation/i }));

    const link = await screen.findByRole('link', { name: /open whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/919876543210?text=Hello%20Asha');
    expect(screen.getByText(/nothing has been marked sent or delivered/i)).toBeInTheDocument();
  });
});
