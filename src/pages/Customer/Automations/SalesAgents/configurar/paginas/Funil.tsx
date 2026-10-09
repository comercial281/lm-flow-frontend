// Repasse · Funil (onda 3). Chave "Mover o card", o funil e os 6 MOMENTOS em
// fileira (esquerda → direita, na ordem em que acontecem), com a coluna embaixo de
// cada um. "Não mover" deixa o card onde está. Ela nunca puxa o card de volta.
// Abaixo de `md` vira 2 por linha (spec §3.1; protótipo).
import { useEffect, useRef, useState } from 'react';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import LinhaComChave from '@/components/base/LinhaComChave';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { PipelineOpt, StageOpt } from '../../configuracao/comum';
import { MOMENTOS_DO_FUNIL } from '../opcoes';
import type { PropsDaPagina } from '../paginas';

const lista = <T,>(res: unknown): T[] => (res as { data?: T[] }).data ?? (Array.isArray(res) ? (res as T[]) : []);

export default function Funil({ agent, gravar }: PropsDaPagina) {
  const mover = agent.pipeline_move_enabled === true;
  const funil = agent.pipeline_id ?? '';
  const mapa = agent.pipeline_stage_map ?? {};
  // ⚠️ O mapa vai INTEIRO no PATCH: dois cliques rápidos em momentos diferentes não podem
  // partir do mesmo mapa velho (o segundo apagaria o primeiro). Guarda o último pedido.
  const ultimoMapa = useRef(mapa);
  useEffect(() => { ultimoMapa.current = agent.pipeline_stage_map ?? {}; }, [agent.pipeline_stage_map]);
  const [funis, setFunis] = useState<PipelineOpt[]>([]);
  const [colunas, setColunas] = useState<StageOpt[]>([]);

  useEffect(() => {
    if (!mover) return;
    pipelinesService.getPipelines({ include_items: false }).then((r: unknown) => setFunis(lista<PipelineOpt>(r).map((p) => ({ id: String(p.id), name: p.name })))).catch(() => setFunis([]));
  }, [mover]);
  useEffect(() => {
    if (!mover || !funil) { setColunas([]); return; }
    pipelinesService.getPipelineStages(funil).then((r: unknown) => setColunas(lista<StageOpt>(r).map((s) => ({ id: String(s.id), name: s.name })))).catch(() => setColunas([]));
  }, [mover, funil]);

  const trocarMomento = (chave: string, coluna: string) => {
    const proximo = { ...ultimoMapa.current };
    if (coluna) proximo[chave] = coluna; else delete proximo[chave];
    ultimoMapa.current = proximo;
    return gravar({ pipeline_stage_map: proximo });
  };

  return (
    <Secoes>
      <Secao titulo="Mover o card" descricao="Conforme a conversa anda, ela leva o card pra coluna certa. Nunca puxa de volta.">
        <LinhaComChave rotulo="Mover o card conforme a conversa anda" ligada={mover} aoMudar={(v) => gravar({ pipeline_move_enabled: v })}>
          <Campo id="funil-funil" rotulo="Funil" className="max-w-xs">
            <Seletor id="funil-funil" className={`${CLASSE_DO_CAMPO} w-full`} value={funil}
              onChange={(e) => { ultimoMapa.current = {}; void gravar({ pipeline_id: e.target.value || null, pipeline_stage_map: {} }); }}>
              <option value="">Escolha o funil</option>
              {funis.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Seletor>
          </Campo>
        </LinhaComChave>
      </Secao>
      {mover && funil && (
        <section className="space-y-3.5 py-8">
          <div>
            <h2 className="text-base font-semibold">Momento da conversa → coluna</h2>
            <p className="text-sm text-muted-foreground">Da esquerda pra direita, na ordem em que acontece. "Não mover" deixa o card onde está.</p>
          </div>
          <ol className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {MOMENTOS_DO_FUNIL.map(([chave, titulo], i) => (
              <li key={chave} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-2.5">
                <span className="text-[11px] font-bold text-primary" aria-hidden>{i + 1}</span>
                <span data-momento className="min-h-[2.2rem] text-[13px] font-semibold leading-tight">{titulo}</span>
                <Seletor aria-label={titulo} className="h-9 w-full text-[13px]" value={mapa[chave] ?? ''}
                  onChange={(e) => void trocarMomento(chave, e.target.value)}>
                  <option value="">Não mover</option>
                  {colunas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Seletor>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Secoes>
  );
}
