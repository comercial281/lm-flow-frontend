// Conversa · Personalidade (onda 3). Formato (várias mensagens), áudio (quando +
// voz do catálogo com "Ouvir" + "Falar com a equipe" pra voz própria) e curtidas.
//
// ⚠️ "Nunca" (audio_mode = 'never') saiu: é a chave desligada. Ligar o áudio numa
// IA em "nunca" grava "quando o lead mandar áudio" junto.
// ⚠️ Voz que não está no catálogo (combinada com a equipe) aparece como "Voz
// própria" e continua valendo (o servidor aceita o id já gravado).
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import EtiquetasDeEscolha from '@/components/base/EtiquetasDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import { openSupport } from '@/components/support/openSupport';
import { salesAgentsService, type VozDaIa } from '@/services/salesAgents/salesAgentsService';
import TextoNaHora from '../TextoNaHora';
import { REACOES_POSSIVEIS } from '../opcoes';
import type { PropsDaPagina } from '../paginas';

export default function Personalidade({ agent, gravar }: PropsDaPagina) {
  const [vozes, setVozes] = useState<VozDaIa[]>([]);
  const [carregou, setCarregou] = useState(false);
  const tocando = useRef<HTMLAudioElement | null>(null);
  // Leitura de fundo: sem a lista, só a voz gravada aparece.
  useEffect(() => {
    let vivo = true;
    salesAgentsService.voices().then((v) => { if (vivo) setVozes(v); }).catch(() => {}).finally(() => { if (vivo) setCarregou(true); });
    return () => { vivo = false; tocando.current?.pause(); };
  }, []);

  const audioLigado = !!agent.audio_enabled && agent.audio_mode !== 'never';
  const vozGravada = agent.audio_voice_id ?? null;
  const opcoesDeVoz = [
    ...vozes.map((v) => ({ valor: v.id, rotulo: v.nome, descricao: v.descricao })),
    ...(vozGravada && carregou && !vozes.some((v) => v.id === vozGravada) ? [{ valor: vozGravada, rotulo: 'Voz própria', descricao: 'Combinada com a equipe.' }] : []),
  ];
  const ouvir = (url: string) => {
    tocando.current?.pause();
    const a = new Audio(url);
    tocando.current = a;
    void a.play().catch(() => toast.error('Não deu pra tocar a amostra.'));
  };
  const reacoes = agent.reaction_emojis ?? [];

  return (
    <Secoes>
      <Secao titulo="Formato" descricao="Mensagens curtas com digitando entre elas, como um corretor no WhatsApp.">
        <LinhaComChave rotulo="Responder em várias mensagens" ligada={agent.message_split_enabled !== false}
          aoMudar={(v) => gravar({ message_split_enabled: v })} />
      </Secao>

      <Secao titulo="Áudio" descricao="Resposta em áudio, com a voz que você escolher.">
        <LinhaComChave rotulo="Responder em áudio" ligada={audioLigado}
          aoMudar={(v) => gravar(v ? { audio_enabled: true, ...(agent.audio_mode === 'never' || !agent.audio_mode ? { audio_mode: 'mirror' as const } : {}) } : { audio_enabled: false })}>
          <BotoesDeEscolha rotulo="Quando ela responde em áudio" valor={agent.audio_mode === 'always' ? 'always' : 'mirror'}
            opcoes={[{ valor: 'mirror', rotulo: 'Quando o lead mandar áudio' }, { valor: 'always', rotulo: 'Sempre' }]}
            aoEscolher={(m) => void gravar({ audio_mode: m })} />
          {!vozGravada && <p className="text-sm text-muted-foreground">Sem escolha, ela usa a voz padrão da plataforma.</p>}
          <CartoesDeEscolha rotulo="Voz" valor={vozGravada} opcoes={opcoesDeVoz} aoEscolher={(id) => void gravar({ audio_voice_id: id })}
            acessorio={(o) => {
              const voz = vozes.find((v) => v.id === o.valor);
              if (!voz) return null;
              return (
                <Button type="button" variant="outline" className="h-auto self-stretch px-3" aria-label={`Ouvir ${voz.nome}`}
                  disabled={!voz.preview_url} title={voz.preview_url ? undefined : 'Sem amostra'} onClick={() => voz.preview_url && ouvir(voz.preview_url)}>
                  <Play className="h-4 w-4" aria-hidden />
                </Button>
              );
            }} />
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border-[1.5px] border-border bg-background p-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Quer a sua própria voz?</p>
              <p className="text-[13px] text-muted-foreground">A gente clona a voz do corretor e deixa disponível aqui.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => openSupport()}>Falar com a equipe</Button>
          </div>
        </LinhaComChave>
      </Secao>

      <Secao titulo="Curtidas" descricao="A reação com emoji grudada na mensagem do lead.">
        <LinhaComChave rotulo="Curtir mensagens do lead" ligada={!!agent.reaction_enabled} aoMudar={(v) => gravar({ reaction_enabled: v })}>
          <EtiquetasDeEscolha rotulo="Emojis que ela pode usar" grande escolhidas={reacoes}
            opcoes={REACOES_POSSIVEIS.map((e) => ({ valor: e, rotulo: e, nome: `Usar ${e}` }))}
            aoMudar={(lista) => void gravar({ reaction_emojis: lista })} />
          <TextoNaHora id="curtidas-maximo" tipo="numero" min={0} rotulo="No máximo, por conversa" className="w-40"
            salvo={String(agent.reaction_max_per_conversation ?? 3)}
            aoGravar={(v) => gravar({ reaction_max_per_conversation: Math.max(0, Number(v) || 0) })} />
        </LinhaComChave>
      </Secao>
    </Secoes>
  );
}
