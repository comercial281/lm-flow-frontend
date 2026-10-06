// Introdução · Abertura (onda 3). Primeira mensagem (Automática / Com texto de
// base), imagem e áudio de abertura, de onde o lead veio quando ela não sabe, e
// as variações por campanha em tabela (Editar abre a janela).
//
// ⚠️ "Com texto de base": o texto é MODELO, não literal (roteiro de hoje; o "texto
// exato" foi cortado pelo dono em 05/10). Vale quando o lead escreve primeiro.
import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import type { SalesAgentOpening } from '@/services/salesAgents/salesAgentsService';
import { CampoDeMidia } from '../CampoDeMidia';
import TextoNaHora from '../TextoNaHora';
import VariacaoDaCampanha from './VariacaoDaCampanha';
import type { PropsDaPagina } from '../paginas';

type Modo = 'auto' | 'base';

function etiquetas(v: SalesAgentOpening): string[] {
  const e: string[] = [];
  if ((v.form_ids ?? []).length) e.push('Formulário');
  if ((v.origins ?? []).length) e.push('Origem');
  (v.keywords ?? []).forEach((k) => e.push(`Palavra "${k}"`));
  if (v.greeting) e.push('Texto próprio');
  if (v.image_url) e.push('Imagem');
  if (v.audio_url) e.push('Áudio');
  return e;
}

export default function Abertura({ agent, gravar }: PropsDaPagina) {
  const [modo, setModo] = useState<Modo>(agent.greeting ? 'base' : 'auto');
  const [editando, setEditando] = useState<number | null>(null);
  const variacoes = agent.openings ?? [];

  // ⚠️ "Automática" SEMPRE grava o null (o gravar não manda nada se já estava
  // vazio): o texto que acabou de ser digitado pode não ter chegado na IA lida
  // ainda, e "só limpar se tiver texto" deixava o texto gravado com a tela dizendo
  // Automática. E grava num efeito, não no clique: o campo do texto some com o
  // modo e, sem blur, grava o que tinha AO DESMONTAR — a limpeza do desmonte roda
  // antes dos efeitos novos, então o null vem depois e ganha.
  const modoAnterior = useRef(modo);
  useEffect(() => {
    if (modoAnterior.current === 'base' && modo === 'auto') void gravar({ greeting: null });
    modoAnterior.current = modo;
  }, [modo, gravar]);
  const novaVariacao = async () => {
    const nova: SalesAgentOpening = { label: 'Nova campanha', origins: [], form_ids: [], keywords: [] };
    if (await gravar({ openings: [...variacoes, nova] })) setEditando(variacoes.length);
  };

  return (
    <Secoes>
      <Secao titulo="Primeira mensagem" descricao="Como ela abre a conversa com quem veio do anúncio. Lead de formulário recebe a mensagem da automação.">
        <BotoesDeEscolha<Modo> rotulo="Primeira mensagem" valor={modo}
          opcoes={[{ valor: 'auto', rotulo: 'Automática' }, { valor: 'base', rotulo: 'Com texto de base' }]} aoEscolher={setModo} />
        {modo === 'base' && (
          <TextoNaHora id="abertura-texto" tipo="varias" rows={3} rotulo="Texto de base" salvo={agent.greeting ?? ''}
            ajuda="Ela usa o seu texto como modelo, trocando pelo nome do lead e pelo anúncio."
            aoGravar={(v) => gravar({ greeting: v.trim() ? v : null })} />
        )}
        <TextoNaHora id="abertura-origem" rotulo="Quando não souber o anúncio, ela diz que o lead veio de" salvo={agent.default_origin ?? ''}
          placeholder="nosso anúncio do Instagram" aoGravar={(v) => gravar({ default_origin: v.trim() ? v : null })} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoDeMidia id="abertura-imagem" agentId={agent.id} tipo="image" rotulo="Imagem de abertura" valor={agent.opening_image_url}
            aoMudar={(url) => void gravar({ opening_image_url: url })} />
          <CampoDeMidia id="abertura-audio" agentId={agent.id} tipo="audio" rotulo="Áudio de abertura" valor={agent.opening_audio_url}
            aoMudar={(url) => void gravar({ opening_audio_url: url })} />
        </div>
      </Secao>

      <Secao titulo="Variações por campanha" descricao="Abertura diferente pra um anúncio ou formulário específico. A primeira que bater vale.">
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {variacoes.map((v, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 px-3.5 py-3">
              <b className="flex-1 text-sm">{v.label || 'Sem nome'}</b>
              {etiquetas(v).map((e) => <span key={e} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{e}</span>)}
              <Button type="button" variant="ghost" size="sm" aria-label={`Editar ${v.label || 'variação'}`} onClick={() => setEditando(i)}>Editar</Button>
            </li>
          ))}
          <li className="px-2 py-1.5">
            <Button type="button" variant="ghost" className="text-primary" aria-label="Nova variação" onClick={() => void novaVariacao()}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Nova variação
            </Button>
          </li>
        </ul>
      </Secao>
      {editando !== null && <VariacaoDaCampanha agent={agent} indice={editando} gravar={gravar} aoFechar={() => setEditando(null)} />}
    </Secoes>
  );
}
