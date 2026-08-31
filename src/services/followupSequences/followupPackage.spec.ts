import { describe, it, expect } from 'vitest';
import { readFollowupPackage, FOLLOWUP_PACKAGE_FORMAT } from './followupSequencesService';

// O arquivo de funil é lido no navegador ANTES de subir, pra a pessoa ver o que
// vai entrar no CRM. Importar às cegas o que veio de outro cliente é o mesmo
// problema que escolher modelo pronto sem ver o texto.
const file = (content: string) => new File([content], 'funil.json', { type: 'application/json' });

const pacote = (extra: Record<string, unknown> = {}) => JSON.stringify({
  format: FOLLOWUP_PACKAGE_FORMAT,
  version: 1,
  exported_from: 'APTO PREMIUM',
  sequence: {
    name: 'Pós-visita',
    steps: [
      { message_type: 'text' },
      { message_type: 'image', media: { data: 'x' } },
      { message_type: 'audio', media: { data: 'y' } },
    ],
    entries: [{ kind: 'stage' }],
  },
  ...extra,
});

describe('ler o arquivo do funil', () => {
  it('conta as mensagens, as mídias e as entradas pra prévia', async () => {
    const { summary, error } = await readFollowupPackage(file(pacote()));

    expect(error).toBeNull();
    expect(summary).toMatchObject({
      name: 'Pós-visita',
      stepsCount: 3,
      mediaCount: 2,
      entriesCount: 1,
      exportedFrom: 'APTO PREMIUM',
    });
  });

  // Planilha, foto ou JSON de outra coisa: recusar aqui é mais barato do que
  // deixar o servidor recusar depois de a pessoa esperar o upload.
  it('recusa arquivo que não é um funil exportado do LM Flow', async () => {
    const { summary, error } = await readFollowupPackage(file('{"foo":"bar"}'));

    expect(summary).toBeNull();
    expect(error).toContain('não é um funil');
  });

  it('recusa arquivo corrompido', async () => {
    const { error } = await readFollowupPackage(file('{ isto não é json'));

    expect(error).toContain('corrompido');
  });

  it('recusa funil sem nenhuma mensagem', async () => {
    const vazio = JSON.stringify({
      format: FOLLOWUP_PACKAGE_FORMAT, version: 1, sequence: { name: 'X', steps: [] },
    });

    const { error } = await readFollowupPackage(file(vazio));

    expect(error).toContain('nenhuma mensagem');
  });

  // Os avisos vêm do servidor que exportou (ex.: mídia grande demais pra caber
  // no arquivo) e precisam chegar na janela de confirmação, não sumir.
  it('carrega os avisos gravados no arquivo', async () => {
    const { summary } = await readFollowupPackage(file(pacote({ warnings: ['vídeo grande demais'] })));

    expect(summary?.warnings).toEqual(['vídeo grande demais']);
  });
});
