import { describe, expect, it, vi } from 'vitest';
import { deleteGuestProfile, deleteStudyRoom } from './admin.js';

describe('deleteStudyRoom', () => {
  it('deletes the database room even when LiveKit is unavailable', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ livekit_room_name: 'studyroom_test' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const end = vi.fn().mockRejectedValue(new Error('LiveKit unavailable'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(deleteStudyRoom({ query } as never, { end } as never, 'room-1')).resolves.toBeUndefined();

    expect(end).toHaveBeenCalledWith('studyroom_test');
    expect(query).toHaveBeenLastCalledWith('DELETE FROM study_rooms WHERE id=$1', ['room-1']);
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });
});

describe('deleteGuestProfile', () => {
  it('deletes the Supabase login, disconnects active rooms, and removes profile history transactionally', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'profile-1', email: 'guest@example.com', auth_user_id: '4e944620-6adf-4f95-b61e-bf0cbca8fdbc', connections: [{ roomName: 'studyroom_one', identity: 'guest_one' }] }],
      rowCount: 1,
    });
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const release = vi.fn();
    const db = { query, connect: vi.fn(async () => ({ query: clientQuery, release })) } as never;
    const remove = vi.fn().mockResolvedValue(undefined);
    const deleteUser = vi.fn().mockResolvedValue(undefined);

    await deleteGuestProfile(db, { remove } as never, { deleteUser } as never, 'profile-1');

    expect(deleteUser).toHaveBeenCalledWith({ id: '4e944620-6adf-4f95-b61e-bf0cbca8fdbc', email: 'guest@example.com' });
    expect(remove).toHaveBeenCalledWith('studyroom_one', 'guest_one');
    expect(clientQuery).toHaveBeenNthCalledWith(2, 'DELETE FROM guest_sessions WHERE profile_id=$1', ['profile-1']);
    expect(clientQuery).toHaveBeenNthCalledWith(3, 'DELETE FROM guest_profiles WHERE id=$1', ['profile-1']);
    expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });
});
