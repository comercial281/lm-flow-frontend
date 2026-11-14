// src/pages/Public/whatsappDoSite.ts
// O que o botão de WhatsApp do site escreve (13/11/2026, pedido do Tony).
//
//   - Ficha do imóvel: o LINK do imóvel na primeira linha, uma linha em branco
//     e "Olá! Tenho interesse no imóvel 205 — Apartamento…". Nessa página, o
//     topo, o rodapé e o botão flutuante mandam a mesma coisa.
//   - Outras páginas (início, busca, blog, manutenção): "Olá! Vim pelo site
//     <domínio> e quero saber mais sobre os imóveis disponíveis."
//
// O link e o domínio saem do endereço ABERTO na hora (nunca de um domínio
// gravado): o cliente troca de domínio e a mensagem acompanha. Sem domínio
// próprio (site no endereço do LM Flow), vai o NOME do site.
//
// ⚠️ O servidor lê as duas frases (Whatsapp::SiteReferral, backend) pra marcar
// o lead como vindo do site. Mudou a frase aqui, muda a expressão lá.
//
// ARMADILHA: o portalShared importa daqui. Não importar nada dele em tempo de
// execução (só tipo), senão vira importação circular.
import { createContext, useContext, useMemo } from 'react';
import { SiteDoDominioContext } from '@/features/siteBuilder/public/useTenantDoSite';
import type { SiteInfo } from './portalShared';

export function mensagemDoImovel(link: string, code: string, title: string): string {
  return `${link}\n\nOlá! Tenho interesse no imóvel ${code} — ${title}.`;
}

export function mensagemDoSite(onde: string): string {
  return `Olá! Vim pelo site ${onde} e quero saber mais sobre os imóveis disponíveis.`;
}

/** Domínio próprio: o endereço da barra. Fora dele: o nome do site (ou o endereço, sem nome). */
export function ondeDoSite(site: Pick<SiteInfo, 'name'>, noDominio: boolean, host: string): string {
  const nome = site.name?.trim();
  return !noDominio && nome ? nome : host;
}

/** O endereço da página aberta, sem query (finalidade, prévia) nem hash. */
export function enderecoDaPagina(origin: string, pathname: string): string {
  return `${origin}${pathname}`;
}

export function linkDoWhatsAppCom(wa: string | null | undefined, texto: string): string | null {
  const digitos = (wa || '').replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}` : null;
}

/** A ficha do imóvel põe aqui a frase dela; sem provedor, vale a frase do site. */
export const MensagemDoWhatsAppContext = createContext<string | null>(null);

/** Link de todo botão de WhatsApp do site (topo, rodapé, flutuante, blog, manutenção). */
export function useLinkDoWhatsApp(site: SiteInfo): string | null {
  const daPagina = useContext(MensagemDoWhatsAppContext);
  const dominio = !!useContext(SiteDoDominioContext);
  const wa = site.contact?.whatsapp;
  const name = site.name;
  return useMemo(() => {
    const texto = daPagina ?? mensagemDoSite(ondeDoSite({ name }, dominio, window.location.host));
    return linkDoWhatsAppCom(wa, texto);
  }, [daPagina, dominio, wa, name]);
}
