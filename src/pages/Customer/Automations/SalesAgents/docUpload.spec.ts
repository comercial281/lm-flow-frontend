import { DOC_ACCEPT, docUploadError, VIDEO_MAX_BYTES } from './docUpload';

const MB = 1024 * 1024;

// Vídeo entra nos arquivos da IA (tour do decorado, lançamento), mas só até 16 MB:
// acima disso ele não sai pelo WhatsApp e, por decisão do dono (29/09/26), também
// não vira link. Melhor avisar no upload do que a IA nunca oferecer e ninguém saber por quê.
describe('docUploadError', () => {
  it('aceita MP4', () => {
    expect(DOC_ACCEPT).toContain('.mp4');
    expect(docUploadError({ name: 'tour.mp4', size: 10 * MB, type: 'video/mp4' })).toBeNull();
  });

  it('recusa vídeo acima de 16 MB, dizendo o limite', () => {
    const erro = docUploadError({ name: 'tour.mp4', size: VIDEO_MAX_BYTES + 1, type: 'video/mp4' });

    expect(erro).toContain('16 MB');
    expect(erro).toContain('tour.mp4');
  });

  it('documento segue com o teto de 25 MB', () => {
    expect(docUploadError({ name: 'book.pdf', size: 20 * MB, type: 'application/pdf' })).toBeNull();
    expect(docUploadError({ name: 'book.pdf', size: 26 * MB, type: 'application/pdf' })).toContain('25 MB');
  });
});
