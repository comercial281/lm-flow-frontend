// Gatilho "Veio de um destes formulários" da IA Vendedora (23/09/2026).
//
// O cliente roda várias campanhas e só quer a IA nos leads de algumas. As outras
// também chegam no WhatsApp com origem Facebook, e "Origem: só anúncios" não
// separa uma campanha da outra.
//
// O que é gravado é o `form_id` das configs de *Origem → Formulários*. Quem casa o
// lead com o formulário é o SERVIDOR, com a mesma régua da entrada do lead (id
// exato ou palavra-chave do imóvel) — por isso a tela oferece as configs, e não os
// formulários crus do Facebook.

export interface FormConfigLike {
  form_id: string;
  form_name: string | null;
  page_name?: string | null;
  is_active?: boolean;
}

export interface FormOption {
  formId: string;
  label: string;
  checked: boolean;
  // Escolhido antes e sem config hoje (apagada). Continua à mostra: sumir com ele
  // faria o próximo clique regravar a lista sem ele, calado.
  orphan: boolean;
  inactive: boolean;
}

export function formOptions(configs: FormConfigLike[], selected: string[] | undefined): FormOption[] {
  const chosen = new Set((selected ?? []).map(String));
  const known = new Set<string>();
  const options: FormOption[] = configs.map((c) => {
    const id = String(c.form_id);
    known.add(id);
    const base = c.form_name?.trim() || `Formulário ${id}`;
    return {
      formId: id,
      label: c.page_name ? `${base} · ${c.page_name}` : base,
      checked: chosen.has(id),
      orphan: false,
      inactive: c.is_active === false,
    };
  });
  for (const id of chosen) {
    if (!known.has(id)) {
      options.push({ formId: id, label: `Formulário ${id}`, checked: true, orphan: true, inactive: false });
    }
  }
  return options;
}

export function toggleForm(selected: string[] | undefined, formId: string): string[] {
  const list = (selected ?? []).map(String);
  return list.includes(formId) ? list.filter((f) => f !== formId) : [...list, formId];
}

// O aviso que a tela mostra embaixo da lista. Nenhum marcado não é "todos": o
// gatilho sem formulário não casa com ninguém, e a IA para de entrar em conversa
// nova por ele.
export function formTriggerNotice(selected: string[] | undefined, configsCount: number): string | null {
  if (configsCount === 0 && !(selected ?? []).length) {
    return 'Nenhum formulário cadastrado em Origem → Formulários. Cadastre lá primeiro para escolher aqui.';
  }
  if (!(selected ?? []).length) {
    return 'Marque pelo menos um formulário. Sem nenhum, este gatilho não ativa a IA para ninguém.';
  }
  return null;
}

// O servidor guardou os formulários marcados? Servidor antigo descarta a lista
// calado e devolve o gatilho vazio — a caixinha "desmarca sozinha" e ninguém sabe
// por quê. Compara o que foi enviado com o que voltou, gatilho a gatilho.
export function formIdsDropped(
  sent: { type: string; form_ids?: string[] }[] | undefined,
  saved: { type: string; form_ids?: string[] }[] | undefined,
): boolean {
  const s = (sent ?? []).filter((t) => t.type === 'form');
  const r = (saved ?? []).filter((t) => t.type === 'form');
  return s.some((t, i) => (t.form_ids ?? []).length > 0 && (r[i]?.form_ids ?? []).length === 0);
}
