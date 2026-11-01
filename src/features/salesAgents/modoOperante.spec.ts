import { describe, expect, it } from 'vitest';
import { fraseDeFechamento, prontasDoAgente, ROTULO_DA_EXCECAO, ROTULO_DO_PASSO, SEMPRE_LIGADAS } from './modoOperante';

describe('fraseDeFechamento', () => {
  it('Filtra e passa com visita', () => {
    expect(fraseDeFechamento('filtra_passa', ['visita'])).toBe('Quer conhecer o imóvel? Já te passo pro corretor ver o melhor horário.');
  });

  it('Leva até a visita com visita e vídeo', () => {
    expect(fraseDeFechamento('leva_visita', ['visita', 'videochamada']))
      .toBe('Você prefere conhecer o imóvel ou fazer uma chamada de vídeo? Qual dia fica melhor pra você?');
  });

  it('três ou quatro opções separam por vírgula e fecham com "ou"', () => {
    expect(fraseDeFechamento('leva_visita', ['visita', 'videochamada', 'reuniao', 'ligacao']))
      .toBe('Você prefere conhecer o imóvel, fazer uma chamada de vídeo, passar no nosso escritório ou receber uma ligação? Qual dia fica melhor pra você?');
  });

  it('nada marcado pede pelo menos um', () => {
    expect(fraseDeFechamento('filtra_passa', [])).toBe('Marque pelo menos um.');
    expect(fraseDeFechamento('filtra_passa', null)).toBe('Marque pelo menos um.');
  });
});

describe('rótulos', () => {
  it('um rótulo pra cada passo e cada exceção pronta, sem travessão', () => {
    expect(Object.keys(ROTULO_DO_PASSO).sort()).toEqual(['ligacao', 'reuniao', 'videochamada', 'visita']);
    expect(Object.keys(ROTULO_DA_EXCECAO).sort()).toEqual(['nao_sei', 'objecao_sem_contorno', 'pediu_ligacao', 'pediu_pra_visitar', 'recusou_documento']);
    const todos = [...Object.values(ROTULO_DO_PASSO), ...Object.values(ROTULO_DA_EXCECAO), ...SEMPRE_LIGADAS];
    expect(todos.some((t) => /[—–]/.test(t))).toBe(false);
  });

  it('as sempre ligadas são as cinco do protótipo', () => {
    expect(SEMPRE_LIGADAS).toHaveLength(5);
  });
});

describe('prontasDoAgente', () => {
  const todas = (o: Partial<Record<string, boolean>>) => ({ recusou_documento: false, pediu_ligacao: false, nao_sei: false, pediu_pra_visitar: false, objecao_sem_contorno: false, ...o });

  it('gravadas: o que está gravado, chave ausente é desligada', () => {
    const p = prontasDoAgente({ handoff_exceptions: { prontas: { nao_sei: true } as never, escritas: [] }, transfer_config: {} });
    expect(p).toEqual(todas({ nao_sei: true }));
  });

  it('não migrado, critério das obrigatórias: as três do passar direto como estão, mais pediu pra visitar', () => {
    const p = prontasDoAgente({ handoff_exceptions: null, transfer_config: { mode: 'checklist', early_handoff: { pediu_ligacao: false } } });
    expect(p).toEqual(todas({ recusou_documento: true, nao_sei: true, pediu_pra_visitar: true }));
  });

  it('não migrado: visita marcada liga só a objeção; sem critério, todas', () => {
    expect(prontasDoAgente({ handoff_exceptions: null, transfer_config: { mode: 'pos_visita' } })).toEqual(todas({ objecao_sem_contorno: true }));
    expect(Object.values(prontasDoAgente({ handoff_exceptions: null, transfer_config: {} })).every(Boolean)).toBe(true);
  });
});
