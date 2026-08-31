// Porta de entrada da Área de Membros.
//
// A aula mora DENTRO do app de cada imobiliária, atrás do login dela. Um link
// único só leva alguém a algum lugar depois de descobrir qual é esse app — é a
// única coisa que este serviço pergunta ao servidor.

import axios from 'axios';

// Rota truly public (/api/public/v1), sem auth — mesma convenção do onboarding
// público e do Espaço.
const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/public/v1`,
  headers: { 'Content-Type': 'application/json' },
});

export interface AcademyEntryResult {
  found: boolean;
  slug?: string;
  name?: string;
  host?: string;
}

export const academyEntryService = {
  resolve: (email: string) =>
    client.post<{ data: AcademyEntryResult }>('/academy_entry', { email }),
};

// Onde a pessoa entrou da última vez, neste aparelho. Existe para o link abrir
// direto na segunda vez em diante, sem perguntar nada.
const CHAVE = 'lmflow:academia:cliente';

export interface ClienteLembrado {
  slug: string;
  name: string;
  host: string;
}

export function lerClienteLembrado(): ClienteLembrado | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as ClienteLembrado;
    return dados?.slug && dados?.host ? dados : null;
  } catch {
    return null;
  }
}

export function lembrarCliente(cliente: ClienteLembrado): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(cliente));
  } catch {
    // Navegador sem armazenamento (aba anônima, site bloqueado): a próxima
    // visita só vai perguntar o e-mail de novo. Não é motivo para falhar.
  }
}

export function esquecerCliente(): void {
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    // idem
  }
}

export default academyEntryService;
