import { describe, expect, it, vi } from 'vitest';
import { deleteStudyRoom } from './admin.js';

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
