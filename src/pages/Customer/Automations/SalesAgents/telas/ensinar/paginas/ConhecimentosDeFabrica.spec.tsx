import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import type { ConhecimentoDeFabrica, SalesAgent } from '@/services/salesAgents/salesAgentsService';

const conhecimentos = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => ({
  ...(await orig<object>()),
  salesAgentsService: { conhecimentosDeFabrica: conhecimentos },
}));
import ConhecimentosDeFabrica from './ConhecimentosDeFabrica';

const C = (topic: string, title: string, extra: Partial<ConhecimentoDeFabrica> = {}) => ({
  topic, title, body: `Texto de ${title}.\n\nSegundo parágrafo.`, reviewed_at: '2026-10-31', enabled: true, by_marks: true, ...extra,
}) as ConhecimentoDeFabrica;

function abrir(extra: Partial<SalesAgent> = {}) {
  const gravar = gravarDeTeste('ensinar');
  render(<ConhecimentosDeFabrica agent={agenteDeTeste({ serves: ['venda'], factory_knowledge_off: [], ...extra })} gravar={gravar}
    licoes={{} as never} arquivos={{} as never} irPara={vi.fn()} confirmar={vi.fn()} />);
  return { gravar };
}

beforeEach(() => {
  vi.clearAllMocks();
  conhecimentos.mockResolvedValue([
    C('financiamento', 'Financiamento'),
    C('mcmv', 'Minha Casa Minha Vida', { enabled: false, by_marks: false }),
    C('fgts', 'FGTS', { enabled: false, by_marks: true }),
  ]);
});

describe('Conhecimentos de fábrica', () => {
  it('um cartão por tópico, com a marca que liga', async () => {
    abrir({ serves: ['venda', 'empreendimento'] });
    const cartao = within(await screen.findByRole('article', { name: 'Financiamento' }));
    expect(cartao.getByText(/Ligado pela marca Venda e Empreendimento/)).toBeInTheDocument();
    expect(cartao.getByRole('switch', { name: /Financiamento/ })).toBeChecked();
    expect(conhecimentos).toHaveBeenCalledWith('ia-1');
  });

  it('sem marca ligada, a chave fica apagada e diz com qual marca liga', async () => {
    abrir({ serves: ['venda'] });
    const cartao = within(await screen.findByRole('article', { name: 'Minha Casa Minha Vida' }));
    const chave = cartao.getByRole('switch', { name: /Minha Casa Minha Vida/ });
    expect(chave).toBeDisabled();
    expect(chave).not.toBeChecked();
    expect(cartao.getByText('Liga com a marca Empreendimento')).toBeInTheDocument();
  });

  it('a chave tira o tópico de factory_knowledge_off (só esse campo)', async () => {
    const { gravar } = abrir({ factory_knowledge_off: [] });
    await userEvent.click(await screen.findByRole('switch', { name: /Financiamento/ }));
    expect(gravar).toHaveBeenCalledWith({ factory_knowledge_off: ['financiamento'] });
  });

  it('desligado pelo dono mostra desligado, e a chave põe de volta', async () => {
    const { gravar } = abrir({ factory_knowledge_off: ['fgts'] });
    const chave = await screen.findByRole('switch', { name: /FGTS/ });
    expect(chave).not.toBeChecked();
    await userEvent.click(chave);
    expect(gravar).toHaveBeenCalledWith({ factory_knowledge_off: [] });
  });

  it('"Ler o texto" abre só leitura, com o pé da casa', async () => {
    abrir();
    const cartao = within(await screen.findByRole('article', { name: 'Financiamento' }));
    await userEvent.click(cartao.getByRole('button', { name: 'Ler o texto' }));
    const janela = within(await screen.findByRole('dialog'));
    expect(janela.getByText(/Texto de Financiamento\./)).toBeInTheDocument();
    expect(janela.queryByRole('textbox')).not.toBeInTheDocument();
    expect(janela.getByText('Escrito pela Leal Mídia · conferido nas fontes oficiais em 31/10/2026 · revisado a cada 180 dias · o documento da imobiliária vale mais.')).toBeInTheDocument();
  });

  it('erro na carga tem Tentar de novo', async () => {
    conhecimentos.mockRejectedValueOnce(new Error('x'));
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(conhecimentos).toHaveBeenCalledTimes(2));
  });
});
