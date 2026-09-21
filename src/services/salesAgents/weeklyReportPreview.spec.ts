import { beforeEach, describe, expect, it, vi } from 'vitest';
import { salesAgentsService } from './salesAgentsService';
import api from '@/services/core/api';

vi.mock('@/services/core/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

/**
 * O botão *Gerar prévia* do relatório da semana.
 *
 * ⚠️ A regra que estes casos travam: **o relatório vem pronto do POST**. Antes ele só
 * "começava" e tudo — números inclusive — dependia de um trabalho em segundo plano;
 * qualquer tropeço ali deixava o gestor sem relatório nenhum e sem nada explicando,
 * que é o "não consigo extrair esse relatório de maneira alguma" que esta leva veio
 * resolver. Só a REDAÇÃO da IA continua em segundo plano.
 */
describe('salesAgentsService.weeklyReportPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const relatorio = {
    id: 'r1',
    period_label: '08/09 a 14/09/2026',
    status: 'draft',
    text: 'Resumo da semana',
    stats: { ia: { attended: 7 }, equipe: { new_leads: 11 } },
    avisos: [],
  };

  it('devolve o relatório já montado, sem esperar o segundo plano', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { ...relatorio, building: true } },
    } as never);

    const { report, building, preview_error: erro } = await salesAgentsService.weeklyReportPreview();

    expect(report?.id).toBe('r1');
    expect(report?.text).toBe('Resumo da semana');
    // A redação segue sendo escrita — mas o relatório JÁ está em mãos.
    expect(building).toBe(true);
    expect(erro).toBeNull();
  });

  it('repassa o motivo quando a redação não pôde nem ser pedida', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          ...relatorio,
          building: false,
          preview_error: 'Os números desta semana já estão aqui, mas não consegui pedir a redação à IA agora.',
        },
      },
    } as never);

    const { report, building, preview_error: erro } = await salesAgentsService.weeklyReportPreview();

    // ⚠️ Falhar a redação NÃO pode custar o relatório.
    expect(report?.id).toBe('r1');
    expect(building).toBe(false);
    expect(erro).toContain('não consegui pedir a redação');
  });

  it('não quebra quando o servidor responde sem relatório', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: null } } as never);

    const { report, building } = await salesAgentsService.weeklyReportPreview();

    expect(report).toBeNull();
    expect(building).toBe(false);
  });

  it('manda a semana escolhida, e omite o campo quando não há escolha', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: relatorio } } as never);

    await salesAgentsService.weeklyReportPreview('2026-09-08');
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual({ week_start: '2026-09-08' });

    await salesAgentsService.weeklyReportPreview();
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual({ week_start: undefined });
  });
});

describe('salesAgentsService.weeklyReportDiagnostico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devolve o veredito de cada peça do caminho', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { checks: [{ chave: 'tabela', titulo: 'Onde o relatório é guardado', situacao: 'ok', detalhe: 'Pronto.' }] } },
    } as never);

    const { checks, checking } = await salesAgentsService.weeklyReportDiagnostico();

    expect(vi.mocked(api.get).mock.calls[0][0]).toBe('/weekly_reports/diagnostico');
    expect(checks[0].situacao).toBe('ok');
    expect(checking).toBe(false);
  });

  // Uma lista vazia é resposta legítima; quebrar aqui esconderia o diagnóstico
  // justamente quando ele é mais necessário.
  it('devolve lista vazia quando o servidor não manda nada', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: {} } } as never);

    await expect(salesAgentsService.weeklyReportDiagnostico()).resolves.toEqual({ checks: [], checking: false });
  });

  /**
   * ⚠️ A cicatriz da estreia: as duas conferências do WhatsApp não cabem numa
   * requisição (o servidor derruba aos 15 segundos, sem motivo dentro) e por isso
   * chegam depois. A tela precisa saber que ainda falta — senão mostra "conferindo"
   * para sempre, ou pior, dá o diagnóstico por completo pela metade.
   */
  it('avisa quando ainda falta conferência chegando', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: {
          checking: true,
          checks: [{ chave: 'numero', titulo: 'O número que envia', situacao: 'pendente', detalhe: 'Conferindo...' }],
        },
      },
    } as never);

    const { checking, checks } = await salesAgentsService.weeklyReportDiagnostico();

    expect(checking).toBe(true);
    expect(checks[0].situacao).toBe('pendente');
  });

  // O CLIQUE confere de novo; a espera pergunta sem `refresh`, senão cada pergunta
  // reiniciaria a conferência que está em andamento.
  it('só manda conferir de novo no clique', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { checks: [] } } } as never);

    await salesAgentsService.weeklyReportDiagnostico(true);
    expect(vi.mocked(api.get).mock.calls[0][1]).toEqual({ params: { refresh: 1 } });

    await salesAgentsService.weeklyReportDiagnostico();
    expect(vi.mocked(api.get).mock.calls[1][1]).toBeUndefined();
  });
});
