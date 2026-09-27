import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@/services/propertyCaptureRequests/propertyCaptureRequestsService', () => ({
  propertyCaptureRequestsService: {
    list: (...a: unknown[]) => mocks.list(...a),
    approve: vi.fn(),
    reject: vi.fn(),
  },
  CAPTURE_STATUS_LABELS: {},
  CAPTURE_STATUS_COLORS: {},
}));

import PropertyCaptureRequests from './PropertyCaptureRequests';

describe('Captação: recusa explicada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('403 mostra o aviso do cargo', async () => {
    mocks.list.mockRejectedValue({ response: { status: 403 } });
    render(<PropertyCaptureRequests />);
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
  });

  it('queda de rede NÃO culpa o cargo', async () => {
    mocks.list.mockRejectedValue(new Error('Network Error'));
    render(<PropertyCaptureRequests />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
  });
});
