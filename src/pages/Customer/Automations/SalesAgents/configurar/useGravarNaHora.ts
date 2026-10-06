/**
 * GRAVAÇÃO NA HORA das páginas da IA (decisão 13 do Tony, 06/10/2026): chave e
 * botões gravam no clique, texto ao sair do campo, e aparece "Salvo · Desfazer"
 * por alguns segundos. Mesmo padrão da aba Funções de Clientes (AbaFuncoes.tsx):
 * otimista, volta no erro, Desfazer regrava o valor de antes.
 *
 * O PATCH continua sendo o do passo a passo (`montarPatch`): campo solto viaja
 * sozinho; jsonb dividido (`RAIZES_DIVIDIDAS`) viaja INTEIRO, montado sobre o
 * último salvo, com só as subchaves da mudança trocadas. Por isso quem grava
 * jsonb diz a subchave (`gravar({ transfer_config }, ['transfer_config.mode'])`),
 * e o hook RECUSA (erro de programação) jsonb sem subchave ou campo escondido.
 *
 * ⚠️ FILA POR IA. Dois cliques rápidos mandariam dois PATCH ao mesmo tempo, e o
 * que chegasse por último ganharia o jsonb inteiro — o resumo desligado no
 * segundo clique sumiria se o primeiro chegasse depois. Aqui o segundo espera o
 * primeiro e é montado sobre a RESPOSTA dele.
 *
 * ⚠️ O "ÚLTIMO SALVO" É UM SÓ POR IA (`registrarSalvo`), alimentado por todas as
 * telas (esta, o Motor, o Ensinar e a chave Ligada, via `aoSalvo` da casca). Um
 * "Desfazer" clicado depois de sair da página monta o PATCH sobre ele — nunca
 * sobre a cópia velha da página —, senão desfazer o critério apagaria o resumo
 * que o Destino desligou depois. A cópia OTIMISTA nunca entra no registro.
 */
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { salesAgentsService, type SalesAgent, type SalesAgentPayload } from '@/services/salesAgents/salesAgentsService';
import { montarPatch } from '@/features/salesAgents/patchDoPasso';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';
import { CAMPOS_ESCONDIDOS, RAIZES_DIVIDIDAS } from './camposDaIa';

export type Gravar = (mudanca: Partial<SalesAgent>, subchaves?: string[]) => Promise<boolean>;

export interface Gravacao {
  mudanca: Partial<SalesAgent>;
  campos: string[];
}

export const TOAST_SALVO = 'ia-salvo';
export const TEMPO_DO_DESFAZER_MS = 6000;

const ultimos = new Map<string, SalesAgent>();
const filas = new Map<string, Promise<unknown>>();
const otimistas = new WeakSet<SalesAgent>();

/** Guarda a IA vinda do servidor (a mais nova ganha; a cópia otimista é ignorada). */
export function registrarSalvo(a: SalesAgent): void {
  if (otimistas.has(a)) return;
  const atual = ultimos.get(a.id);
  if (!atual || (a.updated_at ?? '') >= (atual.updated_at ?? '')) ultimos.set(a.id, a);
}

export function ultimoSalvoDa(id: string): SalesAgent | undefined {
  return ultimos.get(id);
}

/** Só pros testes. */
export function esquecerSalvos(): void {
  ultimos.clear();
  filas.clear();
}

const raizDe = (campo: string) => campo.split('.')[0];

export function camposDaMudanca(mudanca: Partial<SalesAgent>, subchaves: string[] = []): string[] {
  const divididas = new Set<string>(RAIZES_DIVIDIDAS);
  const campos: string[] = [];
  for (const chave of Object.keys(mudanca)) {
    if (divididas.has(chave)) {
      if (!subchaves.some((s) => raizDe(s) === chave)) {
        throw new Error(`${chave} é dividido entre páginas: diga a subchave (ex.: ${chave}.mode).`);
      }
      continue;
    }
    campos.push(chave);
  }
  campos.push(...subchaves);
  // ⚠️ A raiz dividida como "subchave" (['crm_policy']) faria o jsonb inteiro viajar
  // da cópia da página e apagaria o que saiu da tela (crm_policy.invalid).
  const raizInteira = campos.find((c) => divididas.has(c));
  if (raizInteira) throw new Error(`${raizInteira} é dividido entre páginas: diga a subchave (ex.: ${raizInteira}.mode).`);
  const escondidos: readonly string[] = CAMPOS_ESCONDIDOS;
  const proibido = campos.find((c) => escondidos.some((e) => c === e || c.startsWith(`${e}.`)));
  if (proibido) throw new Error(`${proibido} saiu da tela e não pode ser gravado.`);
  return campos;
}

/** A IA com a mudança aplicada, pela mesma regra do PATCH. */
export function aplicarGravacao(base: SalesAgent, g: Gravacao): SalesAgent {
  const patch = montarPatch(base, { ...base, ...g.mudanca } as SalesAgent, g.campos);
  return { ...base, ...(patch as Partial<SalesAgent>) };
}

// ⚠️ Valores ANTIGOS que a onda 2 recusa em gravação nova (contratos 4 e 6): continuam
// sendo lidos, mas o Desfazer volta pro equivalente de hoje — senão o Desfazer de
// uma IA antiga falharia com a recusa do servidor. `inbox_roleta` vira a roleta
// (sem roleta escolhida, a pendência leva ao Destino); `owner` aparece como a
// Consultora (Identidade.tsx) e volta como ela.
const EQUIVALENTE_DE_HOJE: Record<string, Record<string, unknown>> = {
  handoff_target: { inbox_roleta: 'roleta' },
  persona_kind: { owner: 'assistant' },
};

/** A gravação que volta ao que estava em `antes` nos mesmos campos. */
function inversa(antes: SalesAgent, g: Gravacao): Gravacao {
  const lido = antes as unknown as Record<string, unknown>;
  const mudanca: Record<string, unknown> = {};
  new Set(g.campos.map(raizDe)).forEach((raiz) => {
    const valor = lido[raiz] ?? null;
    const hoje = EQUIVALENTE_DE_HOJE[raiz];
    mudanca[raiz] = hoje && typeof valor === 'string' && Object.prototype.hasOwnProperty.call(hoje, valor) ? hoje[valor] : valor;
  });
  return { mudanca: mudanca as Partial<SalesAgent>, campos: g.campos };
}

export function useGravarNaHora(agent: SalesAgent, aoSalvo: (a: SalesAgent) => void): { gravar: Gravar } {
  const id = agent.id;
  const aoSalvoRef = useRef(aoSalvo);
  aoSalvoRef.current = aoSalvo;
  const naFila = useRef<Gravacao[]>([]);

  // A IA que a casca entregou (lista relida, outra tela salvou) entra no registro.
  useEffect(() => { registrarSalvo(agent); }, [agent]);

  const mostrar = useCallback(() => {
    const confirmado = ultimos.get(id) ?? agent;
    const visivel = naFila.current.reduce(aplicarGravacao, confirmado);
    if (visivel !== confirmado) otimistas.add(visivel);
    aoSalvoRef.current(visivel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `agent` só de reserva antes do primeiro registro
  }, [id]);

  const enviar = useCallback(async (g: Gravacao, desfazivel: boolean): Promise<boolean> => {
    naFila.current = [...naFila.current, g];
    mostrar();

    const anterior = filas.get(id) ?? Promise.resolve();
    const minha = anterior.then(async () => {
      const antes = ultimos.get(id) ?? agent;
      const patch = montarPatch(antes, aplicarGravacao(antes, g), g.campos) as Partial<SalesAgentPayload>;
      if (Object.keys(patch).length === 0) return { ok: true, mudou: false, antes };
      try {
        registrarSalvo(await salesAgentsService.update(id, patch));
        return { ok: true, mudou: true, antes };
      } catch (e) {
        toast.error(motivoEscrito(e) ?? 'Não deu pra salvar. Tente de novo.');
        return { ok: false, mudou: false, antes };
      }
    });
    filas.set(id, minha.catch(() => undefined));
    const r = await minha;

    naFila.current = naFila.current.filter((x) => x !== g);
    mostrar();

    if (r.ok && r.mudou && desfazivel) {
      const volta = inversa(r.antes, g);
      toast('Salvo', {
        id: TOAST_SALVO,
        duration: TEMPO_DO_DESFAZER_MS,
        action: {
          label: 'Desfazer',
          onClick: () => { void enviar(volta, false).then((ok) => { if (ok) toast('Desfeito', { id: TOAST_SALVO }); }); },
        },
      });
    }
    return r.ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `agent` só de reserva antes do primeiro registro
  }, [id, mostrar]);

  const gravar = useCallback<Gravar>(
    (mudanca, subchaves) => enviar({ mudanca, campos: camposDaMudanca(mudanca, subchaves) }, true),
    [enviar],
  );

  return { gravar };
}
