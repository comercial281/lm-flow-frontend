import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/leadAds/leadAdsFormsService', () => ({
  leadAdsFormsService: { getAll: vi.fn().mockResolvedValue([{ form_id: '111', form_name: 'Capri', page_name: null, is_active: true }]) },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [] }), getPipelineStages: vi.fn() },
}));

vi.mock('@/services/campanhas/campanhasService', () => ({
  campanhasService: {
    lista: vi.fn().mockResolvedValue([
      { key: 'campaign:Campanha Teste', kind: 'campaign', label: 'Campanha Teste', link_id: 'l1', form_config_id: null },
      { key: 'ad:9', kind: 'ad', label: null, link_id: 'l2', form_config_id: null, ad_title: 'Anúncio Teste', match_value: '9' },
      { key: 'campaign:Sem Linha', kind: 'campaign', label: 'Sem Linha', link_id: null, form_config_id: null },
    ]),
  },
}));

import { TriggersSection } from './configurar/blocos/TriggersSection';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

function Harness() {
  const [agent, setAgent] = useState({ id: 'a1', triggers: [{ type: 'form', form_ids: [] }], trigger_match_mode: 'any' } as unknown as SalesAgent);
  return <TriggersSection agent={agent} onSave={(p) => setAgent((a) => ({ ...a, ...p }))} />;
}

// A caixinha marca quando o servidor devolve a lista. Se ela "desmarca sozinha"
// em produção, quem descartou foi o servidor — e a tela passou a avisar isso.
describe('gatilho de formulário', () => {
  it('marca o formulário ao clicar', async () => {
    render(<Harness />);
    const box = await screen.findByRole('checkbox');
    fireEvent.click(box);
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeChecked());
  });
});

// No computador a caixa da lista do produto mede o rótulo escolhido (w-fit). Na
// condição, cada lista tem largura que não depende do rótulo: a linha não pula
// quando se troca a escolha, como o <select> nativo. Desde 03/11/2026 (cartão por
// condição) o tipo estica na linha dele (`flex-1`) e as outras ocupam a largura
// toda até um teto (`w-full`).
describe('gatilho no computador', () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false, media: '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    // @ts-expect-error: o jsdom não tem matchMedia; voltamos a não ter.
    delete window.matchMedia;
  });

  it('o tipo do gatilho tem largura que não depende do rótulo e troca pela lista do produto', async () => {
    render(<Harness />);
    const tipo = (await screen.findByText('Veio de um destes formulários')).closest('button')!;
    expect(tipo.className.split(/\s+/)).toContain('flex-1');
    await userEvent.click(tipo);
    await userEvent.click(await screen.findByRole('option', { name: 'Origem do lead' }));
    const origem = (await screen.findByText('Só anúncios (FB/IG/Google)')).closest('button')!;
    expect(origem.className.split(/\s+/)).toContain('w-full');
  });
});

// Gravação na hora (06/10): palavra digitada só grava ao sair do campo, não por tecla.
describe('gatilho de texto grava ao sair', () => {
  it('digitar não grava; sair do campo grava uma vez', async () => {
    const onSave = vi.fn();
    const agent = { id: 'a1', triggers: [{ type: 'keyword', value: '', match_type: 'contains' }], trigger_match_mode: 'any' } as unknown as SalesAgent;
    render(<TriggersSection agent={agent} onSave={onSave} />);
    await userEvent.type(screen.getByPlaceholderText('palavra (ex: fluxoimob)'), 'mcmv');
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ triggers: [{ type: 'keyword', value: 'mcmv', match_type: 'contains' }] });
  });
});

// Achado da revisão (3.7): a palavra digitada se perdia quando o bloco sumia sem
// o campo perder o foco (trocou de página pelo endereço, o Voltar do navegador) —
// o React não dispara o blur no desmonte. Mesma regra do TextoNaHora.
describe('palavra digitada e o bloco some', () => {
  const comPalavra = (triggers: unknown[]) => ({ id: 'a1', triggers, trigger_match_mode: 'any' } as unknown as SalesAgent);

  it('grava a palavra ao desmontar sem blur', () => {
    const onSave = vi.fn();
    const { unmount } = render(<TriggersSection agent={comPalavra([{ type: 'keyword', value: '', match_type: 'contains' }])} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText('palavra (ex: fluxoimob)'), { target: { value: 'fluxoimob' } });
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ triggers: [{ type: 'keyword', value: 'fluxoimob', match_type: 'contains' }] });
  });

  it('sem nada digitado, desmontar não grava', () => {
    const onSave = vi.fn();
    const { unmount } = render(<TriggersSection agent={comPalavra([{ type: 'keyword', value: 'x', match_type: 'contains' }])} onSave={onSave} />);
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('já gravou no blur: desmontar não grava de novo', () => {
    const onSave = vi.fn();
    const { unmount } = render(<TriggersSection agent={comPalavra([{ type: 'keyword', value: '', match_type: 'contains' }])} onSave={onSave} />);
    const campo = screen.getByPlaceholderText('palavra (ex: fluxoimob)');
    fireEvent.change(campo, { target: { value: 'fluxoimob' } });
    fireEvent.blur(campo);
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // "Todos os leads" zera as condições e o bloco some: a palavra a meio caminho
  // não pode ressuscitar as condições que a pessoa acabou de tirar.
  // O Canal liga `escolheuTodos` antes de desmontar o bloco.
  it('as condições foram zeradas (Todos os leads): desmontar não traz de volta', () => {
    const onSave = vi.fn();
    const escolheuTodos = { current: false };
    const { rerender, unmount } = render(<TriggersSection agent={comPalavra([{ type: 'keyword', value: '', match_type: 'contains' }])} onSave={onSave} escolheuTodos={escolheuTodos} />);
    fireEvent.change(screen.getByPlaceholderText('palavra (ex: fluxoimob)'), { target: { value: 'fluxoimob' } });
    escolheuTodos.current = true;
    rerender(<TriggersSection agent={comPalavra([])} onSave={onSave} escolheuTodos={escolheuTodos} />);
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('gatilho de campanha', () => {
  function HarnessCampanha({ ids = [] as string[] }) {
    const [agent, setAgent] = useState({ id: 'a1', triggers: [{ type: 'campaign', campaign_link_ids: ids }], trigger_match_mode: 'any' } as unknown as SalesAgent);
    return <TriggersSection agent={agent} onSave={(p) => setAgent((a) => ({ ...a, ...p }))} />;
  }

  it('lista só as campanhas e anúncios com linha, marca e desmarca', async () => {
    render(<HarnessCampanha />);
    const campanha = await screen.findByRole('checkbox', { name: 'Campanha Teste' });
    expect(await screen.findByRole('checkbox', { name: 'Anúncio Teste' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Sem Linha' })).toBeNull();
    fireEvent.click(campanha);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Campanha Teste' })).toBeChecked());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Campanha Teste' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Campanha Teste' })).not.toBeChecked());
  });

  it('campanha marcada que sumiu da lista aparece como não cadastrada', async () => {
    render(<HarnessCampanha ids={['l-velha']} />);
    expect(await screen.findByText('(não está mais cadastrada)')).toBeInTheDocument();
  });

  it('lista que falhou não marca toda campanha como apagada', async () => {
    const { campanhasService } = await import('@/services/campanhas/campanhasService');
    vi.mocked(campanhasService.lista).mockRejectedValueOnce(new Error('x'));
    render(<HarnessCampanha ids={['l1']} />);
    expect(await screen.findByText(/Não deu pra carregar a lista de campanhas/)).toBeInTheDocument();
    expect(screen.queryByText('(não está mais cadastrada)')).toBeNull();
  });

  it('o seletor do tipo tem "Veio destas campanhas"', async () => {
    render(<HarnessCampanha />);
    expect(await screen.findByText('Veio destas campanhas')).toBeInTheDocument();
  });
});
