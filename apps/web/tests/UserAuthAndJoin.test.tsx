import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext';
import { UserLoginPage } from '../src/pages/UserLoginPage';
import { PreJoinPage } from '../src/pages/PreJoinPage';
import { api } from '../src/lib/api';

function createMockStorage() {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as Storage;
}

describe('User Supabase Authentication and Onboarding Flow', () => {
  const mockLocalStorage = createMockStorage();
  const mockSessionStorage = createMockStorage();

  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: mockLocalStorage });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: mockSessionStorage });
    vi.restoreAllMocks();

    // Mock mediaDevices for PreJoinPage
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
        }),
      },
    });
  });

  it('renders login page with room invitation header when redirecting to a room', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login?redirect=%2Froom%2Falgebra-101']}>
          <Routes>
            <Route path="/login" element={<UserLoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText(/You are invited to a study session/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /create account/i })).toBeInTheDocument();
  });

  it('switches between Sign in and Create account tabs', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<UserLoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByPlaceholderText('e.g. Alex Rivera')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /create account/i }));

    expect(screen.getByPlaceholderText('e.g. Alex Rivera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account & continue/i })).toBeInTheDocument();
  });

  it('signs in and redirects back to the invitation room', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login?redirect=%2Froom%2Fphysics-202']}>
          <Routes>
            <Route path="/login" element={<UserLoginPage />} />
            <Route path="/room/physics-202" element={<div>Room Reached After Login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'student@school.edu');
    await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'mypassword123');
    await userEvent.click(screen.getByRole('button', { name: /sign in & continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Room Reached After Login')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated invitation visitors to the login page', async () => {
    vi.spyOn(api, 'getRoom').mockResolvedValue({
      room: {
        publicRoomId: 'room-1',
        name: 'Chemistry 101',
        subject: 'Science',
        description: '',
        status: 'active',
        activeParticipants: 1,
        maxParticipants: 10,
        waitingRoomEnabled: false,
        passwordRequired: false,
        screenSharingEnabled: true,
        chatEnabled: true,
        expiresAt: null,
      },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/room/chem-101']}>
          <Routes>
            <Route path="/room/:roomId" element={<PreJoinPage />} />
            <Route path="/login" element={<div>Redirected To Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Redirected To Login Page')).toBeInTheDocument();
    });
  });

  it('shows verified email and does not require explicit email input when user is authenticated', async () => {
    localStorage.setItem(
      'studyroom.auth.user',
      JSON.stringify({
        id: 'dev_user_1',
        email: 'alex@studyroom.io',
        user_metadata: { displayName: 'Alex Rivera' },
      })
    );

    vi.spyOn(api, 'getRoom').mockResolvedValue({
      room: {
        publicRoomId: 'room-1',
        name: 'Biology 101',
        subject: 'Biology',
        description: 'Focus session',
        status: 'active',
        activeParticipants: 2,
        maxParticipants: 12,
        waitingRoomEnabled: false,
        passwordRequired: false,
        screenSharingEnabled: true,
        chatEnabled: true,
        expiresAt: null,
      },
    });

    const joinMock = vi.spyOn(api, 'joinRoom').mockResolvedValue({
      status: 'joined',
      livekitUrl: 'wss://livekit.example.com',
      token: 'jwt-token',
      sessionId: 'sess-1',
      sessionToken: 'token-1',
      identity: 'guest_1',
      joinedAt: '2026-10-31T08:00:00.000Z',
      room: {
        publicRoomId: 'room-1',
        name: 'Biology 101',
        subject: 'Biology',
        description: '',
        status: 'active',
        activeParticipants: 3,
        maxParticipants: 12,
        waitingRoomEnabled: false,
        passwordRequired: false,
        screenSharingEnabled: true,
        chatEnabled: true,
        expiresAt: null,
      },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/room/bio-101']}>
          <Routes>
            <Route path="/room/:roomId" element={<PreJoinPage />} />
            <Route path="/room/:roomId/live" element={<div>Live Room Connected</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Biology 101')).toBeInTheDocument();
    });

    // Should display verified Supabase account badge with user's email
    expect(screen.getByText('alex@studyroom.io')).toBeInTheDocument();
    expect(screen.getByText(/Verified Supabase account/i)).toBeInTheDocument();

    // The explicit email input field is NOT present
    expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument();

    // Clicking Join Room passes alex@studyroom.io as the email
    await userEvent.click(screen.getByRole('button', { name: /join study room/i }));

    await waitFor(() => {
      expect(joinMock).toHaveBeenCalledWith(
        'bio-101',
        expect.objectContaining({
          email: 'alex@studyroom.io',
          displayName: 'Alex Rivera',
        })
      );
    });
  });

  it('allows user to clear all characters in display name without it snapping back', async () => {
    localStorage.setItem(
      'studyroom.auth.user',
      JSON.stringify({
        id: 'dev_user_2',
        email: 'taylor@studyroom.io',
        user_metadata: { displayName: 'Taylor Swift' },
      })
    );

    vi.spyOn(api, 'getRoom').mockResolvedValue({
      room: {
        publicRoomId: 'room-math',
        name: 'Math Session',
        subject: 'Math',
        description: '',
        status: 'active',
        activeParticipants: 1,
        maxParticipants: 10,
        waitingRoomEnabled: false,
        passwordRequired: false,
        screenSharingEnabled: true,
        chatEnabled: true,
        expiresAt: null,
      },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/room/math-1']}>
          <Routes>
            <Route path="/room/:roomId" element={<PreJoinPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Math Session')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('Enter your name') as HTMLInputElement;
    expect(nameInput.value).toBe('Taylor Swift');

    // Clear the name input completely
    await userEvent.clear(nameInput);
    expect(nameInput.value).toBe('');

    // Type a new custom name
    await userEvent.type(nameInput, 'Dr. Taylor');
    expect(nameInput.value).toBe('Dr. Taylor');
  });
});
