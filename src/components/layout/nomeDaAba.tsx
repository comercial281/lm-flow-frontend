// Nome da aba do navegador (08/10/2026, pedido do Tony): com muita aba aberta,
// todas se chamavam "LM Flow". Agora é UMA regra para o app inteiro:
//
//   <item> · <página> · <cliente>      ex.: "João Silva · Funil de vendas · Moeda Forte"
//
// Do mais específico para o mais geral, porque o Chrome corta o fim do nome
// quando a aba encolhe. Sem "LM Flow" no fim: o ícone da aba já diz isso.
//
// - página: o nome do item do menu dono do endereço (o mesmo que fica aceso),
//   ou da aba dele quando a página tem abas. Tela fora do menu usa o título do
//   cabeçalho (BaseHeader), quando ele é texto.
// - item: só nas telas de UM registro (lead, conversa, imóvel...), que avisam
//   o nome com `useNomeDaAba`.
// - cliente: o nome da conta. Na Área do Admin, "Admin".
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { donoDoEndereco, type MenuItem, type MenuSection } from './config/menuItems';
import { donoDoEnderecoAdmin, type AdminMenuItem } from './config/adminMenuItems';

export const NOME_PADRAO_DA_ABA = 'LM Flow';
const SEPARADOR = ' · ';

type Texto = string | null | undefined;

/** Junta as partes que existem, sem repetir a mesma palavra (Contatos · Contatos). */
export function montarNomeDaAba(partes: Texto[]): string {
  const vistas = new Set<string>();
  const limpas: string[] = [];
  for (const parte of partes) {
    const texto = parte?.replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const chave = texto.toLocaleLowerCase('pt-BR');
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    limpas.push(texto);
  }
  return limpas.length > 0 ? limpas.join(SEPARADOR) : NOME_PADRAO_DA_ABA;
}

/** Nome da página no menu do CRM (a aba dela, quando tem abas). */
export function paginaNoMenu(secoes: MenuSection[], rodape: MenuItem[], pathname: string): string | null {
  const todas = rodape.length > 0 ? [...secoes, { id: 'rodape', rotulo: '', itens: rodape }] : secoes;
  const dono = donoDoEndereco(todas, pathname);
  return dono ? (dono.aba?.name ?? dono.item.name) : null;
}

/** Nome da página no menu da Área do Admin (a aba dela, quando tem abas). */
export function paginaNoMenuAdmin(itens: AdminMenuItem[], pathname: string): string | null {
  const dono = donoDoEnderecoAdmin(itens, pathname);
  return dono ? (dono.aba?.name ?? dono.item.name) : null;
}

type Tipo = 'item' | 'cabecalho';
type Registro = { dono: symbol; nome: string } | null;
type Registrar = (tipo: Tipo, dono: symbol, nome: string | null) => void;

const RegistrarContext = createContext<Registrar | null>(null);

/**
 * Moldura que escreve o nome na aba. Fica no MainLayout e no AdminLayout; ao
 * sair dela (login, páginas públicas) a aba volta a "LM Flow".
 */
export function NomeDaAba({ pagina, cliente, children }: { pagina: Texto; cliente: Texto; children: ReactNode }) {
  const [item, setItem] = useState<Registro>(null);
  const [cabecalho, setCabecalho] = useState<Registro>(null);

  // Quem registrou por último vale; quem sai só apaga o que é dele (a tela nova
  // pode ter registrado antes da antiga desmontar).
  const registrar = useCallback<Registrar>((tipo, dono, nome) => {
    const set = tipo === 'item' ? setItem : setCabecalho;
    set(atual => (nome ? { dono, nome } : atual?.dono === dono ? null : atual));
  }, []);

  const nome = montarNomeDaAba([item?.nome, pagina || cabecalho?.nome, cliente]);

  useEffect(() => {
    document.title = nome;
  }, [nome]);

  useEffect(() => () => {
    document.title = NOME_PADRAO_DA_ABA;
  }, []);

  return <RegistrarContext.Provider value={registrar}>{children}</RegistrarContext.Provider>;
}

function useRegistro(tipo: Tipo, nome: Texto) {
  const registrar = useContext(RegistrarContext);
  const [dono] = useState(() => Symbol(tipo));
  const limpo = nome?.trim() || null;
  useEffect(() => {
    if (!registrar) return;
    registrar(tipo, dono, limpo);
    return () => registrar(tipo, dono, null);
  }, [registrar, tipo, dono, limpo]);
}

/**
 * Tela de UM registro avisa o nome dele (o lead, o imóvel, o cliente no admin).
 * Enquanto carrega, passe `null`: a aba fica só com página · cliente.
 */
export function useNomeDaAba(nome: Texto) {
  useRegistro('item', nome);
}

/** Uso interno do BaseHeader: o título vira o nome da página fora do menu. */
export function useCabecalhoNaAba(titulo: ReactNode) {
  useRegistro('cabecalho', typeof titulo === 'string' ? titulo : null);
}
