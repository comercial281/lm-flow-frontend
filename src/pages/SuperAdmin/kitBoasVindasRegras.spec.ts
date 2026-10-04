import { describe, expect, it } from 'vitest';
import {
  problemaNoVideo, problemaNaImagem, moverImagem, tamanhoLegivel, textoUltimoEnvio,
  textoAndamento, rotuloDoBotao, motivo, previaDoTexto, esperaEstourou,
} from './kitBoasVindasRegras';
import type { KitDelivery } from '@/services/superAdmin/welcomeKitService';

const MB = 1024 * 1024;
const envio = (over: Partial<KitDelivery> = {}): KitDelivery => ({
  state: 'done', started_at: '2026-10-04T17:32:00Z', finished_at: '2026-10-04T17:33:00Z', by: 'Tony',
  group: { jid: '1@g.us', name: 'APTO x Leal Mídia', source: 'nome', found: true },
  items: [
    { kind: 'text', label: 'Mensagem', status: 'sent', detail: null },
    { kind: 'video', label: 'Vídeo', status: 'sent', detail: null },
  ],
  sent: 2, total: 2, ...over,
});

describe('arquivos', () => {
  it('vídeo: só MP4 até 16 MB', () => {
    expect(problemaNoVideo({ type: 'video/mp4', size: 10 * MB, name: 'a.mp4' })).toBeNull();
    expect(problemaNoVideo({ type: 'video/quicktime', size: MB, name: 'a.mov' })).toBe('Envie o vídeo em MP4.');
    expect(problemaNoVideo({ type: 'video/mp4', size: 17 * MB, name: 'a.mp4' })).toBe('O vídeo passa de 16 MB, o limite do WhatsApp.');
  });
  it('imagem: JPG ou PNG até 5 MB', () => {
    expect(problemaNaImagem({ type: 'image/png', size: MB, name: 'a.png' })).toBeNull();
    expect(problemaNaImagem({ type: 'image/webp', size: MB, name: 'a.webp' })).toBe('Envie a imagem em JPG ou PNG.');
    expect(problemaNaImagem({ type: 'image/jpeg', size: 6 * MB, name: 'a.jpg' })).toBe('A imagem passa de 5 MB.');
  });
  it('tamanho legível', () => {
    expect(tamanhoLegivel(12.3 * MB)).toBe('12,3 MB');
    expect(tamanhoLegivel(500 * 1024)).toBe('500 KB');
  });
});

describe('ordem das imagens', () => {
  it('move para cima e para baixo, sem sair da lista', () => {
    expect(moverImagem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moverImagem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moverImagem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moverImagem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('textos', () => {
  it('último envio', () => {
    expect(textoUltimoEnvio(null)).toBe('Ainda não enviado.');
    expect(textoUltimoEnvio(envio())).toMatch(/^Enviado em 04\/10\/2026 às \d\d:\d\d por Tony · 2 de 2 peças$/);
    expect(textoUltimoEnvio(envio({ sent: 1, items: [
      { kind: 'text', label: 'Mensagem', status: 'sent' },
      { kind: 'video', label: 'Vídeo', status: 'failed' },
    ] }))).toMatch(/1 de 2 peças · 1 falhou$/);
  });
  it('só conta como falha o que falhou; peça que não chegou a sair não é falha', () => {
    const interrompido = envio({ state: 'interrupted', sent: 1, total: 3, items: [
      { kind: 'text', label: 'Mensagem', status: 'sent' },
      { kind: 'video', label: 'Vídeo', status: 'failed', detail: 'x' },
      { kind: 'image', label: 'Imagem 1', status: 'queued' },
    ] });
    expect(textoUltimoEnvio(interrompido))
      .toMatch(/^Envio interrompido em 04\/10\/2026 às \d\d:\d\d por Tony · 1 de 3 peças · 1 falhou · 1 não saiu$/);
  });
  it('nada saiu: não diz "Enviado"', () => {
    const nada = envio({ sent: 0, items: [
      { kind: 'text', label: 'Mensagem', status: 'failed' },
      { kind: 'video', label: 'Vídeo', status: 'failed' },
    ] });
    expect(textoUltimoEnvio(nada)).toMatch(/^Tentativa em .* por Tony · 0 de 2 peças · 2 falharam$/);
  });
  it('andamento', () => {
    const p = envio({ state: 'running', items: [
      { kind: 'text', label: 'Mensagem', status: 'sent' },
      { kind: 'video', label: 'Vídeo', status: 'queued' },
      { kind: 'image', label: 'Imagem 1', status: 'queued' },
    ], total: 3 });
    expect(textoAndamento(p)).toBe('Enviando 2 de 3…');
  });
  it('botão com a contagem', () => {
    expect(rotuloDoBotao(1)).toBe('Enviar no grupo (1 peça)');
    expect(rotuloDoBotao(8)).toBe('Enviar no grupo (8 peças)');
  });
  it('prévia troca os trechos pelo exemplo', () => {
    expect(previaDoTexto('Oi {nome}: {{link}}')).toBe('Oi Imobiliária Exemplo: https://cliente.lmflow.com.br');
  });
  it('erro nos dois formatos da API', () => {
    expect(motivo({ response: { data: { error: 'Já tem um envio' } } }, 'x')).toBe('Já tem um envio');
    expect(motivo({ response: { data: { error: { message: 'Sem cargo' } } } }, 'x')).toBe('Sem cargo');
    expect(motivo(new Error('rede'), 'Reserva')).toBe('Reserva');
  });
  it('espera tem teto de 10 minutos', () => {
    expect(esperaEstourou(0, 9 * 60_000)).toBe(false);
    expect(esperaEstourou(0, 11 * 60_000)).toBe(true);
  });
});
