import type { FormEvent } from 'react';
import type { PortalProperty, SiteInfo } from '../portalShared';
import type { AbaId, HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { resolverAparencia } from '@/features/siteBuilder/public/aparenciaConfig';
import { finalidadeInicial, type Finalidade } from '../finalidade';
import CapaModerna from './CapaModerna';
import VitrinesModernas from './VitrinesModernas';
import ComoFuncionaModerno from './ComoFuncionaModerno';
import AtendimentoModerno from './AtendimentoModerno';
import NumerosModernos from './NumerosModernos';
import ChamadasModernas from './ChamadasModernas';
import MaisBuscadosModerno from './MaisBuscadosModerno';
import CapturaModerna from './CapturaModerna';

/* ────────────────────────────────────────────────────────────────────────────
   Início do Moderno (spec 7 "Início"): as seções de hoje, na ordem de hoje,
   com o desenho do protótipo. Topo e rodapé vêm do PortalHeader/PortalFooter.
   Ordem: capa · vitrines · Como funciona · chamadas · Atendimento · mais
   buscados · números · "Não achou?". `captura` traz o estado e o envio do
   contato, que continuam no PortalHomePage (os mesmos do Clássico).
──────────────────────────────────────────────────────────────────────────── */

/** O "Não achou?" de hoje: estado e envio moram no PortalHomePage (o mesmo do Clássico). */
export interface PropsDaCaptura {
  /** `sections.lead_capture`: desligado, o bloco não aparece. */
  ligada: boolean;
  nome: string; aoMudarNome: (v: string) => void;
  telefone: string; aoMudarTelefone: (v: string) => void;
  telefoneInvalido: boolean;
  finalidade: Finalidade; aoMudarFinalidade: (f: Finalidade) => void;
  enviado: boolean; enviadoNaPrevia: boolean; erro: string | null;
  enviar: (e: FormEvent) => void;
}

interface Props {
  site: SiteInfo; home: HomeConfig; items: PortalProperty[]; tenant: string; abas: AbaId[];
  cities: string[]; hoods: string[]; types: string[];
  /** WhatsApp do site: o painel do "Não achou?" mostra. */
  wa?: string | null;
  captura: PropsDaCaptura;
}

export default function InicioModerno({ site, home, items, tenant, abas, cities, hoods, types, wa, captura }: Props) {
  const ap = resolverAparencia(site.appearance);
  const modo = ap.heading_highlight;

  return (
    <div className="pb-[clamp(64px,9vw,112px)]">
      <CapaModerna
        site={site} home={home} items={items} tenant={tenant} abas={abas} cities={cities} hoods={hoods} types={types}
        // A aba da busca marca o "Quero comprar / Quero alugar" do contato (Lançamentos não muda).
        onTab={k => { if (k !== 'launch') captura.aoMudarFinalidade(finalidadeInicial(k)); }}
      />
      <VitrinesModernas home={home} items={items} tenant={tenant} abas={abas} modo={modo} cartoesGrandes={ap.card_style === 'large'} />
      <ComoFuncionaModerno home={home} modo={modo} />
      <ChamadasModernas site={site} home={home} items={items} tenant={tenant} modo={modo} />
      <AtendimentoModerno home={home} modo={modo} />
      <MaisBuscadosModerno home={home} items={items} tenant={tenant} abas={abas} />
      {site.sections?.stats !== false && <NumerosModernos imoveis={items.length} cidades={cities.length} modo={modo} />}
      <CapturaModerna site={site} wa={wa} captura={captura} />
    </div>
  );
}
