// Condições e argumentos (Tarefa 78, 01/11/2026): o que a IA pode dizer sobre pagamento deste imóvel,
// pra quem ele serve, o que nunca prometer, o fato de urgência e as objeções. Grava pelo Salvar do cadastro.
import { useState } from 'react';
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import { X } from 'lucide-react';
import { useCampoTravado, dicaSe } from '@/features/properties/cadastro/travasDoSite';
import { avisoDaUrgencia } from '@/features/properties/cadastro/formularioDoCadastro';
import { INTENCOES, ROTULO_DA_INTENCAO, fraseDaIntencao } from '@/features/salesAgents/intencao';
import type { Intencao } from '@/services/salesAgents/salesAgentsService';
import { CampoDeDinheiro } from './campos';
import type { PropsDaSecao } from './tipos';

export const MAX_FLUXO = 300;
export const MAX_NUNCA_PROMETER = 6;
export const MAX_LINHA_NUNCA_PROMETER = 150;
export const MAX_OBJECOES = 10;
export const MAX_OBJECAO = 200;
export const MAX_RESPOSTA = 600;
export const MAX_FATO = 150;

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export default function SecaoCondicoes({ form: f, setF }: PropsDaSecao) {
  const travado = {
    entrada: useCampoTravado('down_payment_from'),
    parcela: useCampoTravado('installment_from'),
    renda: useCampoTravado('min_income'),
    fluxo: useCampoTravado('payment_terms'),
    fato: useCampoTravado('urgency_fact'),
    ate: useCampoTravado('urgency_until'),
  };
  const [nova, setNova] = useState('');
  const nunca = f.never_promise ?? [];
  const objecoes = f.objections ?? [];
  const serve = INTENCOES.filter(k => (f.serves_intents ?? []).includes(k));
  const frase = fraseDaIntencao(serve, 'deste imóvel');
  const semData = avisoDaUrgencia(f);

  const trocarIntencao = (k: Intencao, on: boolean) => {
    const marcadas = INTENCOES.filter(x => (x === k ? on : serve.includes(x)));
    setF({ serves_intents: marcadas });
  };
  const porNunca = () => {
    const linha = nova.trim();
    if (!linha || nunca.length >= MAX_NUNCA_PROMETER) return;
    setF(prev => ({ never_promise: [...(prev.never_promise ?? []), linha.slice(0, MAX_LINHA_NUNCA_PROMETER)] }));
    setNova('');
  };
  const mudarObjecao = (i: number, patch: Partial<{ objecao: string; resposta: string }>) =>
    setF(prev => ({ objections: (prev.objections ?? []).map((o, j) => (j === i ? { ...o, ...patch } : o)) }));

  return (
    <div className="mt-4 space-y-6">
      <p className="text-sm text-muted-foreground">
        Vale pra qualquer IA da imobiliária e também quando ela oferece este imóvel como alternativa pra outro lead.
        O Preencher a partir de um texto traz entrada, parcela e renda mínima quando o texto diz. O resto é decisão do time: a IA não preenche.
      </p>

      <section aria-labelledby="cond-condicao">
        <h3 id="cond-condicao" className="text-sm font-semibold">Condição</h3>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div title={dicaSe(travado.entrada)}>
            <UILabel htmlFor="campo-entrada">Entrada a partir de (R$)</UILabel>
            <CampoDeDinheiro id="campo-entrada" disabled={travado.entrada} valor={f.down_payment_from}
              aoMudar={v => setF({ down_payment_from: v })} className="mt-1" />
          </div>
          <div title={dicaSe(travado.parcela)}>
            <UILabel htmlFor="campo-parcela">Parcela a partir de (R$)</UILabel>
            <CampoDeDinheiro id="campo-parcela" disabled={travado.parcela} valor={f.installment_from}
              aoMudar={v => setF({ installment_from: v })} className="mt-1" />
          </div>
          <div title={dicaSe(travado.renda)}>
            <UILabel htmlFor="campo-renda-minima">Renda mínima (R$)</UILabel>
            <CampoDeDinheiro id="campo-renda-minima" disabled={travado.renda} valor={f.min_income}
              aoMudar={v => setF({ min_income: v })} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Da família, por mês.</p>
          </div>
          <div title={dicaSe(travado.fluxo)}>
            <UILabel htmlFor="campo-fluxo">Fluxo de pagamento</UILabel>
            <Input id="campo-fluxo" value={f.payment_terms ?? ''} maxLength={MAX_FLUXO} disabled={travado.fluxo}
              onChange={e => setF({ payment_terms: e.target.value.slice(0, MAX_FLUXO) })} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Até {MAX_FLUXO} letras.</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Como a IA usa: começa por entrada e parcela "a partir de", nunca manda a tabela inteira, nunca diz que o caso da pessoa cabe.
          Vazio: não fala de número, diz que o corretor simula.
        </p>
      </section>

      <section aria-labelledby="cond-serve">
        <h3 id="cond-serve" className="text-sm font-semibold">Pra quem serve</h3>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {INTENCOES.map(k => (
            <label key={k} className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={serve.includes(k)} onCheckedChange={v => trocarIntencao(k, v === true)} />
              <span className="text-sm">{ROTULO_DA_INTENCAO[k]}</span>
            </label>
          ))}
        </div>
        <p data-testid="frase-pra-quem-serve" className="mt-2 text-sm">{frase.texto}</p>
        <p className="mt-1 text-xs text-muted-foreground">Os 4 caminhos são os de fábrica. Pode deixar vazio: vale o padrão da IA.</p>
      </section>

      <section aria-labelledby="cond-nunca">
        <h3 id="cond-nunca" className="text-sm font-semibold">O que nunca prometer</h3>
        <ul className="mt-2 space-y-2">
          {nunca.map((linha, i) => (
            <li key={`${i}-${linha}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span>{linha}</span>
              <button type="button" aria-label={`Tirar: ${linha}`} className="text-muted-foreground hover:text-foreground"
                onClick={() => setF(prev => ({ never_promise: (prev.never_promise ?? []).filter((_, j) => j !== i) }))}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {nunca.length < MAX_NUNCA_PROMETER ? (
          <div className="mt-2 flex gap-2">
            <Input aria-label="Nova linha de nunca prometer" value={nova} maxLength={MAX_LINHA_NUNCA_PROMETER}
              placeholder="Ex.: Nunca dizer que a entrega é em 2027"
              onChange={e => setNova(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); porNunca(); } }} />
            <Button type="button" variant="outline" onClick={porNunca} disabled={!nova.trim()}>Pôr</Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Até {MAX_NUNCA_PROMETER} linhas, de até {MAX_LINHA_NUNCA_PROMETER} letras cada. Tire uma pra pôr outra.</p>
        )}
      </section>

      <section aria-labelledby="cond-urgencia">
        <h3 id="cond-urgencia" className="text-sm font-semibold">Fato de urgência</h3>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2" title={dicaSe(travado.fato)}>
            <UILabel htmlFor="campo-fato">O fato</UILabel>
            <Input id="campo-fato" value={f.urgency_fact ?? ''} maxLength={MAX_FATO} disabled={travado.fato}
              aria-invalid={semData ? true : undefined} aria-describedby={semData ? 'erro-fato' : undefined}
              onChange={e => setF({ urgency_fact: e.target.value.slice(0, MAX_FATO) })} className="mt-1" />
          </div>
          <div title={dicaSe(travado.ate)}>
            <UILabel htmlFor="campo-fato-ate">Vale até</UILabel>
            <Input id="campo-fato-ate" type="date" value={f.urgency_until ?? ''} disabled={travado.ate}
              onChange={e => setF({ urgency_until: e.target.value })} className="mt-1" />
          </div>
        </div>
        {semData && <p id="erro-fato" role="alert" className="mt-1 text-xs text-destructive">{semData}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {f.urgency_fact?.trim() && f.urgency_until
            ? `A IA usa até ${dataBr(f.urgency_until)}. Depois some da conversa sozinho e a Saúde da IA avisa.`
            : 'Sem fato: a IA não cria urgência.'}
        </p>
      </section>

      <section aria-labelledby="cond-objecoes">
        <h3 id="cond-objecoes" className="text-sm font-semibold">Objeções deste imóvel</h3>
        <div className="mt-2 space-y-3">
          {objecoes.map((o, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex gap-2">
                <Input aria-label={`Objeção ${i + 1}`} value={o.objecao} maxLength={MAX_OBJECAO} placeholder="O que o lead diz"
                  onChange={e => mudarObjecao(i, { objecao: e.target.value.slice(0, MAX_OBJECAO) })} />
                <button type="button" aria-label={`Tirar objeção ${i + 1}`} className="text-muted-foreground hover:text-foreground"
                  onClick={() => setF(prev => ({ objections: (prev.objections ?? []).filter((_, j) => j !== i) }))}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea aria-label={`Resposta da objeção ${i + 1}`} value={o.resposta} maxLength={MAX_RESPOSTA} rows={2}
                placeholder="Como a IA responde"
                onChange={e => mudarObjecao(i, { resposta: e.target.value.slice(0, MAX_RESPOSTA) })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          ))}
        </div>
        {objecoes.length < MAX_OBJECOES && (
          <Button type="button" variant="outline" className="mt-2"
            onClick={() => setF(prev => ({ objections: [...(prev.objections ?? []), { objecao: '', resposta: '' }] }))}>
            Adicionar objeção
          </Button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Até {MAX_OBJECOES}. Só entram com este imóvel em foco. As que valem pra qualquer imóvel ficam em Objeções da casa, na IA.
        </p>
      </section>
    </div>
  );
}
