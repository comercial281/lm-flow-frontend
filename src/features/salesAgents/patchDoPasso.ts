/**
 * O PATCH de um passo do passo a passo da IA Vendedora (entrega 2).
 *
 * POR QUE EXISTE: o `saveAgent` da tela antiga montava o PATCH campo a campo
 * (campo fora da lista era descartado calado, com a tela dizendo "Salvo") e
 * reenviava o agente inteiro a cada blur. Aqui cada passo diz QUAIS campos são
 * dele (`CAMPOS_DO_PASSO`) e manda só os que mudaram.
 *
 * jsonb dividido entre passos (`transfer_config`: voz no 1, cenário no 2,
 * obrigatórias no 3; `crm_policy`, `ai_limits`, `visit_config`, `playbook`,
 * `usage_limits`) é listado por SUBCHAVE: a raiz viaja inteira (o servidor troca o
 * jsonb todo), montada sobre o ÚLTIMO SALVO, com só as subchaves do passo trocadas.
 * Assim um passo nunca apaga o que é de outro, nem o que saiu da tela
 * (`crm_policy.invalid`, `visit_config.blocked_dates`, os encaixes do roteiro).
 */
import type { SalesAgent, SalesAgentPayload } from '@/services/salesAgents/salesAgentsService';

type Objeto = Record<string, unknown>;

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const ehObjeto = (v: unknown): v is Objeto => !!v && typeof v === 'object' && !Array.isArray(v);

function ler(obj: unknown, caminho: string[]): unknown {
  return caminho.reduce<unknown>((atual, chave) => (ehObjeto(atual) ? atual[chave] : undefined), obj);
}

function gravar(obj: Objeto, caminho: string[], valor: unknown): void {
  const [chave, ...resto] = caminho;
  if (resto.length === 0) {
    if (valor === undefined) delete obj[chave];
    else obj[chave] = valor;
    return;
  }
  const filho = obj[chave];
  const proximo: Objeto = ehObjeto(filho) ? { ...filho } : {};
  gravar(proximo, resto, valor);
  obj[chave] = proximo;
}

export function montarPatch(
  salvo: SalesAgent,
  rascunho: SalesAgent,
  campos: readonly string[],
): Partial<SalesAgentPayload> {
  const antes = salvo as unknown as Objeto;
  const depois = rascunho as unknown as Objeto;
  const patch: Objeto = {};
  const subchaves = new Map<string, string[][]>();

  for (const campo of campos) {
    const [raiz, ...resto] = campo.split('.');
    if (resto.length === 0) {
      if (!igual(antes[raiz], depois[raiz])) patch[raiz] = depois[raiz] === undefined ? null : depois[raiz];
      continue;
    }
    subchaves.set(raiz, [...(subchaves.get(raiz) ?? []), resto]);
  }

  for (const [raiz, caminhos] of subchaves) {
    const mudou = caminhos.some((c) => !igual(ler(antes[raiz], c), ler(depois[raiz], c)));
    if (!mudou) continue;
    const base = antes[raiz];
    const juntado: Objeto = ehObjeto(base) ? (JSON.parse(JSON.stringify(base)) as Objeto) : {};
    caminhos.forEach((c) => gravar(juntado, c, ler(depois[raiz], c)));
    patch[raiz] = juntado;
  }

  return patch as Partial<SalesAgentPayload>;
}
