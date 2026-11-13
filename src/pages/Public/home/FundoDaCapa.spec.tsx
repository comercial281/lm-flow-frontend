import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FundoDaCapa from './FundoDaCapa';

const imgs = (c: HTMLElement) => Array.from(c.querySelectorAll('img'));

describe('FundoDaCapa', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('mostra a primeira e deixa a próxima montada', () => {
    const { container } = render(<FundoDaCapa fotos={['a.jpg', 'b.jpg', 'c.jpg']} prioridade />);
    const srcs = imgs(container).map(i => i.getAttribute('src'));
    expect(srcs).toContain('a.jpg');
    expect(srcs).toContain('b.jpg');
    expect(srcs).not.toContain('c.jpg');
    expect(imgs(container).find(i => i.getAttribute('src') === 'a.jpg')!.className).toContain('opacity-100');
    expect(imgs(container).find(i => i.getAttribute('src') === 'a.jpg')!.getAttribute('fetchpriority')).toBe('high');
  });
  it('troca a ativa depois de 6 s', () => {
    const { container } = render(<FundoDaCapa fotos={['a.jpg', 'b.jpg', 'c.jpg']} />);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(imgs(container).find(i => i.getAttribute('src') === 'b.jpg')!.className).toContain('opacity-100');
    expect(imgs(container).find(i => i.getAttribute('src') === 'a.jpg')!.className).toContain('opacity-0');
  });
  it('uma foto só vira um img simples', () => {
    const { container } = render(<FundoDaCapa fotos={['a.jpg']} />);
    expect(imgs(container)).toHaveLength(1);
    expect(container.querySelector('div')).toBeNull();
  });
});
