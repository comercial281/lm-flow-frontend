// Ensinar · Conhecimentos de fábrica: os 8 da fase 3, um cartão por tópico. Cada um mostra se está ligado e por
// qual marca, com chave pra desligar (`factory_knowledge_off`) e "Ler o texto" só leitura. Sem marca ligada, a chave
// fica apagada (a marca liga o tópico no Produto; aqui o dono só desliga). Quem diz o que está ligado é o servidor
// (`by_marks`); a chave lê o `factory_knowledge_off` da IA, que muda na hora quando grava.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secoes } from '@/components/base/Secao';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import { cn } from '@/lib/utils';
import { salesAgentsService, type ConhecimentoDeFabrica, type TopicoDeFabrica } from '@/services/salesAgents/salesAgentsService';
import { CONHECIMENTOS_DA_MARCA, MARCAS, ROTULO_DA_MARCA } from '@/features/salesAgents/marcas';
import JanelaDoConhecimento from './JanelaDoConhecimento';
import type { PropsDaPaginaDoEnsinar } from './tipos';

function lista(nomes: string[]): string {
  return nomes.length < 2 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export default function ConhecimentosDeFabrica({ agent, gravar }: PropsDaPaginaDoEnsinar) {
  const [itens, setItens] = useState<ConhecimentoDeFabrica[]>([]);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [lendo, setLendo] = useState<ConhecimentoDeFabrica | null>(null);
  const pedido = useRef(0);

  const carregar = useCallback(async () => {
    const n = ++pedido.current;
    setEstado('carregando');
    try {
      const r = await salesAgentsService.conhecimentosDeFabrica(agent.id);
      if (n !== pedido.current) return;
      setItens(r);
      setEstado('pronto');
    } catch {
      if (n === pedido.current) setEstado('erro');
    }
  }, [agent.id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const desligados = agent.factory_knowledge_off ?? [];
  const serve = agent.serves ?? [];

  const mudar = (topico: TopicoDeFabrica, ligar: boolean) => gravar({
    factory_knowledge_off: ligar ? desligados.filter((t) => t !== topico) : [...desligados.filter((t) => t !== topico), topico],
  });

  if (estado === 'erro') return <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar()} />;
  if (estado === 'carregando') return <Secoes><Carregando linhas={3} rotulo="Carregando os conhecimentos" /></Secoes>;
  if (itens.length === 0) {
    return <EmptyState icon={BookOpen} title="Nenhum conhecimento de fábrica" description="Os conhecimentos aparecem aqui quando a casa marca o que atende, em Público-alvo e produto." />;
  }

  return (
    <>
      <ul className="grid gap-4 md:grid-cols-2">
        {itens.map((c) => {
          const delasQueLigam = MARCAS.filter((m) => CONHECIMENTOS_DA_MARCA[m].includes(c.topic));
          const pelaMarca = delasQueLigam.filter((m) => serve.includes(m)).map((m) => ROTULO_DA_MARCA[m]);
          const ligado = c.by_marks && !desligados.includes(c.topic);
          return (
            <li key={c.topic}>
              <article aria-label={c.title} className={cn('flex h-full flex-col gap-3 rounded-xl border border-border p-4', !ligado && 'bg-muted/30')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-[15px] font-semibold">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {c.by_marks
                        ? `${ligado ? 'Ligado' : 'Desligado por vocês'} ${pelaMarca.length ? `pela marca ${lista(pelaMarca)}` : 'pelo cadastro'}`
                        : `Liga com a marca ${delasQueLigam.map((m) => ROTULO_DA_MARCA[m]).join(' ou ')}`}
                    </p>
                  </div>
                  <Chave rotulo={`Conhecimento ${c.title}`} semRotuloVisivel semAviso genero="o" ligada={ligado}
                    desabilitada={!c.by_marks} aoMudar={(v) => mudar(c.topic, v)} />
                </div>
                <div className="mt-auto">
                  <Button type="button" variant="outline" size="sm" onClick={() => setLendo(c)}>Ler o texto</Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      {lendo && <JanelaDoConhecimento item={lendo} aoFechar={() => setLendo(null)} />}
    </>
  );
}
