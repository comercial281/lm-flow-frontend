import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));
import { propertiesService } from './propertiesService';

beforeEach(() => {
  vi.clearAllMocks();
  api.post.mockResolvedValue({ data: { data: { id: 'p1' } } });
});

describe('uploadBook', () => {
  it('PDF sem tipo vai com application/pdf', async () => {
    await propertiesService.uploadBook('p1', new File(['x'], 'book.pdf', { type: '' }));
    const fd = api.post.mock.calls[0][1] as FormData;
    const enviado = fd.get('file') as File;
    expect(enviado.type).toBe('application/pdf');
    expect(enviado.name).toBe('book.pdf');
  });
  it('PDF com tipo segue como veio', async () => {
    const f = new File(['x'], 'book.pdf', { type: 'application/pdf' });
    await propertiesService.uploadBook('p1', f);
    expect((api.post.mock.calls[0][1] as FormData).get('file')).toBeInstanceOf(File);
    expect(((api.post.mock.calls[0][1] as FormData).get('file') as File).type).toBe('application/pdf');
  });
});
