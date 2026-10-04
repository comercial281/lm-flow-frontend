import { renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteInfo } from './portalShared';

vi.mock('@/features/siteBuilder/public/siteTracking', () => ({ installSiteTracking: vi.fn(), trackPageView: vi.fn() }));
vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
import { trackPageView } from '@/features/siteBuilder/public/siteTracking';
import { sendSiteVisit } from '@/features/siteBuilder/public/siteVisits';
import { usePortalTracking } from './usePortalTracking';

const site = { name: 'x' } as SiteInfo;
const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/a']}>{children}</MemoryRouter>;

describe('usePortalTracking', () => {
  beforeEach(() => { vi.mocked(trackPageView).mockClear(); vi.mocked(sendSiteVisit).mockClear(); });

  it('mudança só do path da visita não repete page_view nem visita', () => {
    const { rerender } = renderHook(({ path }) => usePortalTracking(site, 'imob', { kind: 'search', path }), { wrapper, initialProps: { path: '/a' } });
    expect(trackPageView).toHaveBeenCalledTimes(1);
    expect(sendSiteVisit).toHaveBeenCalledTimes(1);
    rerender({ path: '/a?stage=ready' });
    expect(trackPageView).toHaveBeenCalledTimes(1);
    expect(sendSiteVisit).toHaveBeenCalledTimes(1);
  });

  it('trocar de página (pathname) conta de novo', () => {
    const { result } = renderHook(() => { usePortalTracking(site, 'imob', { kind: 'home', path: '/x' }); return useNavigate(); }, { wrapper });
    act(() => result.current('/b'));
    expect(trackPageView).toHaveBeenCalledTimes(2);
    expect(sendSiteVisit).toHaveBeenCalledTimes(2);
  });

  it('visita nula espera; page_view sai mesmo assim', () => {
    renderHook(() => usePortalTracking(site, 'imob', null), { wrapper });
    expect(trackPageView).toHaveBeenCalledTimes(1);
    expect(sendSiteVisit).not.toHaveBeenCalled();
  });
});
