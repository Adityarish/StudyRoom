import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AdminRoom } from '@studyroom/shared';
import { AdminDashboardPage } from '../src/pages/AdminDashboardPage';
import { api } from '../src/lib/api';

vi.mock('../src/lib/api', () => ({
  api: {
    adminMe: vi.fn(), adminRooms: vi.fn(), participants: vi.fn(), deleteRoom: vi.fn(),
    adminLogout: vi.fn(), createRoom: vi.fn(), updateRoom: vi.fn(),
    approveParticipant: vi.fn(), removeParticipant: vi.fn(),
  },
}));

const room: AdminRoom = {
  id: 'room-1', publicRoomId: 'public-room-id-long-enough', name: 'Physics Focus',
  description: '', subject: 'Physics', status: 'active', maxParticipants: 12,
  chatEnabled: true, screenSharingEnabled: true, waitingRoomEnabled: false,
  passwordRequired: false, expiresAt: null, activeParticipants: 1,
  createdAt: '2026-10-29T00:00:00.000Z', updatedAt: '2026-10-29T00:00:00.000Z', closedAt: null,
};

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 });
    vi.mocked(api.adminMe).mockResolvedValue({ administrator: { id: 'admin-1', username: 'admin' }, csrfToken: 'csrf' });
    vi.mocked(api.adminRooms).mockResolvedValue({ rooms: [room] });
    vi.mocked(api.participants).mockResolvedValue({ participants: [{ id: 'session-1', identity: 'guest-1', displayName: 'Tushita', avatarId: 'nova', joinedAt: '2026-10-29T00:00:00.000Z', approvalStatus: 'approved', live: true }] });
    vi.mocked(api.deleteRoom).mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('opens the participant overview from the sidebar', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/admin/rooms']}><AdminDashboardPage/></MemoryRouter>);
    await screen.findByText('Physics Focus');
    await user.click(screen.getByRole('button', { name: 'Participants' }));
    expect(await screen.findByText('Tushita')).toBeInTheDocument();
    expect(api.participants).toHaveBeenCalledWith('room-1');
  });

  it('removes a deleted room from the dashboard', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/admin/rooms']}><AdminDashboardPage/></MemoryRouter>);
    await screen.findByText('Physics Focus');
    await user.click(screen.getByRole('button', { name: 'Delete Physics Focus' }));
    await waitFor(() => expect(api.deleteRoom).toHaveBeenCalledWith('room-1'));
    expect(await screen.findByText('Your first room is one click away.')).toBeInTheDocument();
    expect(screen.queryByText('Physics Focus')).not.toBeInTheDocument();
  });

  it('switches and persists the administrator theme', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/admin/rooms']}><AdminDashboardPage/></MemoryRouter>);
    await screen.findByText('Physics Focus');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dark');
    await waitFor(() => expect(document.documentElement.dataset.adminTheme).toBe('dark'));
    expect(localStorage.setItem).toHaveBeenCalledWith('studyroom.admin-theme', 'dark');
  });
});
