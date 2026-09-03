import { describe, it, expect } from 'vitest';
import { groupCatalogByTheme, matchesQuery, itemLabel, AVULSAS_KEY, type CatalogItem } from './featureCatalog';

// O painel de Funções mostrava ~60 interruptores numa lista corrida. O que estes
// casos protegem é a arrumação dela — e, principalmente, que nenhuma chave suma
// da tela por causa da arrumação: chave escondida é chave que ninguém consegue
// liberar para o cliente.
describe('organização do catálogo de Funções', () => {
  const catálogo: CatalogItem[] = [
    { key: 'conversations', label: 'Conversas', group: 'conversations', theme: 'atendimento', theme_label: 'Atendimento' },
    { key: 'chat_send_audio', label: 'Enviar áudio (gravar)', group: 'conversations', theme: 'atendimento', theme_label: 'Atendimento' },
    { key: 'contacts', label: 'Contatos', group: 'contacts', theme: 'atendimento', theme_label: 'Atendimento' },
    { key: 'pipelines', label: 'Pipelines', group: 'pipelines', theme: 'funil', theme_label: 'Funil e vendas' },
    { key: 'card_notes', label: 'Observações do card', group: 'pipelines', theme: 'funil', theme_label: 'Funil e vendas' },
  ];

  it('agrupa em tema > menu > funções do menu', () => {
    const [atendimento, funil] = groupCatalogByTheme(catálogo);

    expect(atendimento.label).toBe('Atendimento');
    expect(atendimento.menus.map(m => m.label)).toEqual(['Conversas', 'Contatos']);
    expect(atendimento.menus[0].toggle?.key).toBe('conversations');
    expect(atendimento.menus[0].items.map(i => i.key)).toEqual(['chat_send_audio']);
    expect(funil.label).toBe('Funil e vendas');
  });

  it('o toggle do menu vem antes das funções de dentro dele', () => {
    const [atendimento] = groupCatalogByTheme(catálogo);

    expect(atendimento.menus[0].all.map(i => i.key)).toEqual(['conversations', 'chat_send_audio']);
  });

  it('os temas saem na ordem da tela, não na ordem em que o servidor mandou', () => {
    const embaralhado = [...catálogo].reverse();

    expect(groupCatalogByTheme(embaralhado).map(s => s.key)).toEqual(['atendimento', 'funil']);
  });

  // Janela de deploy: o servidor antigo ainda não manda tema. Sem esta reserva o
  // painel voltaria a ser lista corrida logo depois de publicar, que é o pior
  // momento possível para isso acontecer.
  it('sem tema vindo do servidor, o menu decide o tema', () => {
    const semTema: CatalogItem[] = [
      { key: 'conversations', label: 'Conversas', group: 'conversations' },
      { key: 'chat_emoji', label: 'Emoji', group: 'conversations' },
    ];

    const [secao] = groupCatalogByTheme(semTema);

    expect(secao.key).toBe('atendimento');
    expect(secao.all).toHaveLength(2);
  });

  // Função apontando para um menu que não existe no catálogo (não há o toggle
  // dele) não pode inventar um bloco com nome de código no título: ela entra como
  // função avulsa no fim do tema.
  it('função cujo menu não existe entra como avulsa, no fim do tema', () => {
    const órfã: CatalogItem[] = [
      { key: 'conversations', label: 'Conversas', group: 'conversations', theme: 'atendimento' },
      { key: 'chat_reacao_emoji', label: 'Reagir com emoji', group: 'chat_reacao', theme: 'atendimento' },
    ];

    const [secao] = groupCatalogByTheme(órfã);

    expect(secao.menus.map(m => m.key)).toEqual(['conversations', AVULSAS_KEY]);
    expect(secao.all.map(i => i.key)).toContain('chat_reacao_emoji');
  });

  // Menu que só tem o toggle (Dashboard, Marketplace, Tutoriais) continua sendo
  // um bloco de um item — é um menu de verdade, não um chute.
  it('menu sem funções dentro continua sendo bloco próprio', () => {
    const [secao] = groupCatalogByTheme([
      { key: 'dashboard', label: 'Dashboard', group: 'dashboard', theme: 'visao_geral' },
    ]);

    expect(secao.menus[0].toggle?.key).toBe('dashboard');
    expect(secao.menus[0].items).toHaveLength(0);
  });

  it('chave sem tema nenhum cai em "Outras funções", no fim — nunca some', () => {
    const desconhecida: CatalogItem[] = [
      ...catálogo,
      { key: 'coisa_nova', label: 'Coisa Nova', group: 'menu_que_ninguem_mapeou' },
    ];

    const seções = groupCatalogByTheme(desconhecida);
    const última = seções[seções.length - 1];

    expect(última.label).toBe('Outras funções');
    expect(última.all.map(i => i.key)).toEqual(['coisa_nova']);
    expect(seções.flatMap(s => s.all)).toHaveLength(desconhecida.length);
  });

  it('nenhuma chave do catálogo fica de fora da arrumação', () => {
    const total = groupCatalogByTheme(catálogo).flatMap(s => s.all).map(i => i.key);

    expect(total.sort()).toEqual(catálogo.map(i => i.key).sort());
  });

  it('a busca acha pelo nome da tela e pela chave técnica', () => {
    const item = catálogo[1];

    expect(matchesQuery(item, 'áudio')).toBe(true);
    expect(matchesQuery(item, 'chat_send')).toBe(true);
    expect(matchesQuery(item, '  ')).toBe(true);
    expect(matchesQuery(item, 'proposta')).toBe(false);
  });

  it('item sem rótulo mostra a chave legível, nunca em branco', () => {
    expect(itemLabel({ key: 'bolsao_import' })).toBe('Bolsao Import');
  });
});
