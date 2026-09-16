import api from '@/services/core/api';

/**
 * Os logos dos cinco bancos da página *Simule seu financiamento*, subidos UMA
 * VEZ pela Leal Mídia e herdados por toda imobiliária.
 *
 * Antes disto o logo era por cliente: cinco arquivos vezes trinta e uma
 * imobiliárias, e a imobiliária nova nascia sem nenhum. Quem tem arte própria de
 * parceria continua enviando a dela no Site Builder — ela vence.
 *
 * Backend: /api/v1/super/portal_bank_logos (`Sites::BankLogos`).
 */
export interface PlatformBank {
  key: string;
  name: string;
  /** Cor da marca: é o círculo quando não há logo. */
  color: string;
  /** Cor do texto sobre o círculo quando a cor da marca é clara (Banco do Brasil). */
  ink?: string | null;
  /** O logo da plataforma. Vazio = o banco sai no círculo com o nome. */
  logo_url?: string | null;
  /** O simulador oficial do banco, só para a linha dizer para onde o clique vai. */
  default_url?: string | null;
}

const BASE = '/super/portal_bank_logos';

export const platformBanksService = {
  async list(): Promise<PlatformBank[]> {
    const res = await api.get(BASE);
    return (res.data as { data: { banks: PlatformBank[] } }).data.banks;
  },

  /**
   * Grava o mapa INTEIRO. Endereço em branco tira o logo daquele banco — é o
   * que a lixeira significa, e é o mesmo sentido que vazio tem em toda a
   * plataforma.
   */
  async save(logos: Record<string, string>): Promise<PlatformBank[]> {
    const res = await api.put(BASE, { logos });
    return (res.data as { data: { banks: PlatformBank[] } }).data.banks;
  },
};
