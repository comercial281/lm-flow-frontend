// Mapa das telas do Meu site (barra de topo própria, modelo Kenlo).
// Fonte única: rótulo da lista suspensa, dica, título e frase de cada tela.
// Spec: LM FLOW/specs/2026-10-03-meu-site-painel-design.md (A1).

export type GrupoId = 'painel' | 'personalizar' | 'marketing' | 'config';
export type TelaId = 'painel' | 'contatos' | 'modelo' | 'aparencia' | 'busca' | 'vitrines' | 'chamadas' | 'buscados' | 'secoes' | 'ficha' | 'lista'
  | 'menus' | 'paginas' | 'financiamento' | 'anuncie' | 'traducao'
  | 'blog' | 'anuncios' | 'redes' | 'rastreamento' | 'marca' | 'endereco' | 'dados' | 'destino' | 'google';

export interface TelaInfo {
  id: TelaId;
  grupo: GrupoId;
  rotulo: string;
  dica: string;
  titulo: string;
  frase: string;
  noMenu: boolean;
}

export const GRUPOS: { id: GrupoId; rotulo: string }[] = [
  { id: 'painel', rotulo: 'Painel' },
  { id: 'personalizar', rotulo: 'Personalizar' },
  { id: 'marketing', rotulo: 'Marketing' },
  { id: 'config', rotulo: 'Configurações' },
];

export const TELAS: TelaInfo[] = [
  { id: 'painel', grupo: 'painel', rotulo: 'Painel', dica: '', titulo: 'Painel', frase: 'Como o seu site está indo.', noMenu: false },
  { id: 'contatos', grupo: 'painel', rotulo: 'Contatos do site', dica: '', titulo: 'Contatos do site', frase: 'Quem pediu contato pelo site.', noMenu: false },
  { id: 'modelo', grupo: 'personalizar', rotulo: 'Modelo do site', dica: 'Clássico, Editorial ou Popular', titulo: 'Modelo do site', frase: 'Um ponto de partida para o visual do site. Depois, cores, logo e textos continuam editáveis em Aparência e na Página inicial.', noMenu: true },
  { id: 'aparencia', grupo: 'personalizar', rotulo: 'Aparência', dica: 'Logo, cores, topo e rodapé', titulo: 'Aparência', frase: 'Logo, cores, fonte, fundo, topo, capa e rodapé do site.', noMenu: true },
  { id: 'busca', grupo: 'personalizar', rotulo: 'Página inicial · Busca rápida', dica: 'Título e filtros da entrada', titulo: 'Busca rápida', frase: 'O título da capa e os filtros que o visitante vê ao entrar no site.', noMenu: true },
  { id: 'vitrines', grupo: 'personalizar', rotulo: 'Página inicial · Vitrines', dica: 'Faixas de imóveis', titulo: 'Vitrines', frase: 'Faixas de imóveis na página inicial. Elas se atualizam sozinhas.', noMenu: true },
  { id: 'chamadas', grupo: 'personalizar', rotulo: 'Página inicial · Chamadas', dica: 'Financiamento, Anuncie e outros', titulo: 'Chamadas', frase: 'Os atalhos da página inicial: financiamento, anunciar imóvel, encomenda e os seus.', noMenu: true },
  { id: 'buscados', grupo: 'personalizar', rotulo: 'Página inicial · Mais buscados', dica: 'Atalhos pra busca', titulo: 'Mais buscados', frase: 'Atalhos que levam direto pra busca, por tipo e bairro.', noMenu: true },
  { id: 'secoes', grupo: 'personalizar', rotulo: 'Página inicial · Mais seções', dica: 'Como funciona e atendimento', titulo: 'Mais seções', frase: 'Duas seções opcionais da página inicial: o passo a passo de como comprar e quem atende o cliente.', noMenu: true },
  { id: 'ficha', grupo: 'personalizar', rotulo: 'Página do imóvel', dica: 'O que aparece em cada imóvel', titulo: 'Página do imóvel', frase: 'O que aparece na página de cada imóvel e quem recebe cópia dos contatos feitos nela.', noMenu: true },
  { id: 'lista', grupo: 'personalizar', rotulo: 'Lista de imóveis', dica: 'Ordem e visual dos cartões', titulo: 'Lista de imóveis', frase: 'A ordem e o visual dos imóveis na busca do site.', noMenu: true },
  { id: 'menus', grupo: 'personalizar', rotulo: 'Menus', dica: 'Ordem e nomes do menu', titulo: 'Menus', frase: 'Os itens do menu do topo do site: a ordem, o nome de cada um e os links para fora do site.', noMenu: true },
  { id: 'paginas', grupo: 'personalizar', rotulo: 'Páginas', dica: 'Sobre nós, privacidade e outras', titulo: 'Páginas', frase: 'Páginas que você cria e que podem aparecer no menu do site. Há modelos prontos de Sobre nós e de Política de privacidade.', noMenu: true },
  { id: 'financiamento', grupo: 'personalizar', rotulo: 'Financiamento', dica: 'Simulador dos bancos', titulo: 'Financiamento', frase: 'A página com os simuladores dos bancos.', noMenu: true },
  { id: 'anuncie', grupo: 'personalizar', rotulo: 'Anuncie seu imóvel', dica: 'Captação de imóvel', titulo: 'Anuncie seu imóvel', frase: 'A página onde o proprietário oferece o imóvel.', noMenu: true },
  { id: 'traducao', grupo: 'personalizar', rotulo: 'Tradução', dica: 'Outros idiomas', titulo: 'Tradução', frase: 'Botão para o visitante ver o site em outro idioma.', noMenu: true },
  { id: 'blog', grupo: 'marketing', rotulo: 'Blog', dica: 'Artigos', titulo: 'Blog', frase: 'Artigos que ajudam o site a aparecer no Google.', noMenu: true },
  { id: 'anuncios', grupo: 'marketing', rotulo: 'Páginas de anúncio', dica: 'Para colar no anúncio', titulo: 'Páginas de anúncio', frase: 'Páginas para colar no anúncio, com destino do contato.', noMenu: true },
  { id: 'redes', grupo: 'marketing', rotulo: 'Redes sociais', dica: 'Instagram, Facebook…', titulo: 'Redes sociais', frase: 'O link de cada ícone do site.', noMenu: true },
  { id: 'rastreamento', grupo: 'config', rotulo: 'Rastreamento', dica: 'Google e Meta', titulo: 'Rastreamento', frase: 'Google e Meta medindo quem visita o site.', noMenu: true },
  { id: 'marca', grupo: 'config', rotulo: "Marca d'água", dica: 'Logo nas fotos', titulo: "Marca d'água", frase: 'Seu logo nas fotos dos imóveis, para ninguém usar sem pedir.', noMenu: true },
  { id: 'endereco', grupo: 'config', rotulo: 'Endereço do site', dica: 'Domínio próprio', titulo: 'Endereço do site', frase: 'Nome do site, endereço e o seu domínio próprio.', noMenu: true },
  { id: 'dados', grupo: 'config', rotulo: 'Dados de contato', dica: 'Telefone e e-mail', titulo: 'Dados de contato', frase: 'Telefone, WhatsApp, e-mail e endereço que aparecem no site.', noMenu: true },
  { id: 'destino', grupo: 'config', rotulo: 'Para onde vão os contatos', dica: 'Funil e roleta', titulo: 'Para onde vão os contatos', frase: 'Funil, etapa e quem recebe quem pede contato pelo site.', noMenu: true },
  { id: 'google', grupo: 'config', rotulo: 'Aparecer no Google', dica: 'Ligar e o que o Google mostra', titulo: 'Aparecer no Google', frase: 'Se o site aparece no Google, e o título e a descrição que ele mostra.', noMenu: true },
];

const LEGADO: Record<string, TelaId> = {
  portal: 'painel', config: 'aparencia', pages: 'paginas', articles: 'blog', leads: 'contatos', landings: 'anuncios',
};

const POR_ID = new Map(TELAS.map(t => [t.id, t]));

export function telaInfo(id: TelaId): TelaInfo {
  return POR_ID.get(id) ?? POR_ID.get('painel')!;
}

export function telaDaUrl(params: URLSearchParams): TelaId {
  const tela = params.get('tela');
  if (tela && POR_ID.has(tela as TelaId)) return tela as TelaId;
  const tab = params.get('tab');
  // Só chave própria: `?tab=constructor` não pode cair numa propriedade herdada do objeto.
  if (tab && Object.prototype.hasOwnProperty.call(LEGADO, tab)) return LEGADO[tab];
  return 'painel';
}

export function itensDoGrupo(grupo: GrupoId, opts: { podeAnuncios: boolean }): TelaInfo[] {
  return TELAS.filter(t => t.grupo === grupo && t.noMenu && (t.id !== 'anuncios' || opts.podeAnuncios));
}

export function trilhaDe(id: TelaId): string {
  const t = telaInfo(id);
  if (t.grupo === 'painel') return '';
  return GRUPOS.find(g => g.id === t.grupo)?.rotulo ?? '';
}
