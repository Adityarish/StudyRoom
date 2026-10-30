import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/lib/clipboard';

afterEach(() => vi.restoreAllMocks());

describe('copyText', () => {
  it('uses the Clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    await copyText('invite-url');

    expect(writeText).toHaveBeenCalledWith('invite-url');
  });

  it('falls back to a selected temporary field when clipboard permission is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const copy = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: copy });

    await copyText('fallback-url');

    expect(copy).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).not.toBeInTheDocument();
  });
});
