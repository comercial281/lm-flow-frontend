import { describe, it, expect } from 'vitest';
import { embedDoTour, embedDoVideo } from './midiaDoImovel';

const yt = (id: string) => ({ tipo: 'embed', src: `https://www.youtube-nocookie.com/embed/${id}` });

describe('embedDoVideo', () => {
  it('youtu.be/ID', () => {
    expect(embedDoVideo('https://youtu.be/dQw4w9WgXcQ')).toEqual(yt('dQw4w9WgXcQ'));
    expect(embedDoVideo('https://youtu.be/dQw4w9WgXcQ?si=abc&t=3')).toEqual(yt('dQw4w9WgXcQ'));
  });
  it('watch?v=ID com parâmetros extras', () => {
    expect(embedDoVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toEqual(yt('dQw4w9WgXcQ'));
    expect(embedDoVideo('https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ')).toEqual(yt('dQw4w9WgXcQ'));
    expect(embedDoVideo('  https://youtube.com/watch?v=dQw4w9WgXcQ  ')).toEqual(yt('dQw4w9WgXcQ'));
  });
  it('shorts', () => {
    expect(embedDoVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share')).toEqual(yt('dQw4w9WgXcQ'));
  });
  it('vimeo', () => {
    expect(embedDoVideo('https://vimeo.com/123456789')).toEqual({ tipo: 'embed', src: 'https://player.vimeo.com/video/123456789' });
    expect(embedDoVideo('https://www.vimeo.com/123456789?share=copy')).toEqual({ tipo: 'embed', src: 'https://player.vimeo.com/video/123456789' });
  });
  it('domínio desconhecido vira link, nunca iframe', () => {
    expect(embedDoVideo('https://exemplo.com.br/video.mp4')).toEqual({ tipo: 'link', href: 'https://exemplo.com.br/video.mp4' });
    // parece YouTube mas não é
    expect(embedDoVideo('https://youtube.com.golpe.io/watch?v=dQw4w9WgXcQ')).toEqual({ tipo: 'link', href: 'https://youtube.com.golpe.io/watch?v=dQw4w9WgXcQ' });
  });
  it('endereço conhecido sem id válido vira link', () => {
    expect(embedDoVideo('https://www.youtube.com/watch?v=x"onload=1')?.tipo).toBe('link');
    expect(embedDoVideo('https://www.youtube.com/@canal')?.tipo).toBe('link');
    expect(embedDoVideo('https://vimeo.com/canal/abc')?.tipo).toBe('link');
  });
  it('javascript:, vazio e lixo viram null', () => {
    expect(embedDoVideo('javascript:alert(1)')).toBeNull();
    expect(embedDoVideo(' JavaScript:alert(1)')).toBeNull();
    expect(embedDoVideo('')).toBeNull();
    expect(embedDoVideo('   ')).toBeNull();
    expect(embedDoVideo(null)).toBeNull();
    expect(embedDoVideo(undefined)).toBeNull();
    expect(embedDoVideo('data:text/html,oi')).toBeNull();
    expect(embedDoVideo('youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

describe('embedDoTour', () => {
  it('Matterport vira embed com play=1', () => {
    expect(embedDoTour('https://my.matterport.com/show/?m=SxQL3iGyoDo')).toEqual({ tipo: 'embed', src: 'https://my.matterport.com/show/?m=SxQL3iGyoDo&play=1' });
    expect(embedDoTour('https://my.matterport.com/show/?m=SxQL3iGyoDo&play=0')).toEqual({ tipo: 'embed', src: 'https://my.matterport.com/show/?m=SxQL3iGyoDo&play=1' });
  });
  it('outro http(s) vira link', () => {
    expect(embedDoTour('https://tour.exemplo.com/123')).toEqual({ tipo: 'link', href: 'https://tour.exemplo.com/123' });
    expect(embedDoTour('https://my.matterport.com/show/')).toEqual({ tipo: 'link', href: 'https://my.matterport.com/show/' });
    // YouTube não é tour: link, não iframe
    expect(embedDoTour('https://youtu.be/dQw4w9WgXcQ')?.tipo).toBe('link');
  });
  it('javascript: e vazio viram null', () => {
    expect(embedDoTour('javascript:alert(1)')).toBeNull();
    expect(embedDoTour('')).toBeNull();
  });
});
