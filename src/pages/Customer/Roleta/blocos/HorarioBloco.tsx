import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import BarraSalvar from '@/components/base/BarraSalvar';
import Chave from '@/components/base/Chave';
import { Campo, CampoTextoLongo } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { DEFAULT_WINDOW, type ScheduleWindow } from '@/components/schedule/scheduleWindows';
import { VariableChipBar } from '@/components/flowAutomations/VariableChipBar';
import { mesmoConteudo, useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import inboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';
import {
  mensagemDoServidor,
  roletaConfigService,
  type RoletaBusinessHours,
  type RoletaConfig,
} from '@/services/roletaConfig/roletaConfigService';

// ── QUANDO FUNCIONA (roleta nova, D8) ───────────────────────────────────────
//
// O horário é DA ROLETA. Fora dele o lead espera e é oferecido quando abrir
// (sempre, com a chave ligada: não existe mais "número de plantão"). Opcional:
// mandar uma mensagem pro lead enquanto ele espera, escolhendo o número e o texto.
//
// Regra da casa: a chave da mensagem vale na hora; o horário, o número e o
// texto esperam o Salvar (BarraSalvar).

const FUSO_PADRAO = 'America/Sao_Paulo';

// Pro lead, só o nome dele faz sentido (corretor e prazo ainda não existem).
const VARIAVEIS_DA_MENSAGEM = [{ token: '{{nome}}', label: '+ Nome do lead' }];

interface Rascunho {
  sempre: boolean;
  janelas: ScheduleWindow[];
  numero: string;
  mensagem: string;
}

function rascunhoDa(r: RoletaConfig): Rascunho {
  const bh = r.business_hours_config ?? {};
  return {
    sempre: bh.mode !== 'custom',
    janelas: bh.windows?.length ? bh.windows : [DEFAULT_WINDOW],
    numero: r.after_hours_inbox_id ?? '',
    mensagem: r.after_hours_message ?? '',
  };
}

function horarioPara(r: RoletaConfig, d: Rascunho): RoletaBusinessHours {
  // 24 horas manda `{ mode: 'always' }` em vez de omitir: omitir num PATCH
  // deixaria o horário antigo gravado (mesma lição da tela antiga).
  if (d.sempre) return { mode: 'always' };
  return { mode: 'custom', tz: r.business_hours_config?.tz || FUSO_PADRAO, windows: d.janelas };
}

// Números conectados do cliente (o que já caiu não manda mensagem). O gravado
// continua na lista mesmo fora do ar, pra salvar não trocar sem ninguém ver.
function numerosParaEscolher(inboxes: Inbox[], gravado: string) {
  return inboxes.filter(i => i.connection_status !== 'disconnected' || i.id === gravado);
}

interface Props {
  roleta: RoletaConfig;
  aoMudar: (r: RoletaConfig) => void;
}

export default function HorarioBloco({ roleta, aoMudar }: Props) {
  const carregado = useMemo(() => rascunhoDa(roleta), [roleta]);
  const [d, setD] = useState<Rascunho>(carregado);
  const [salvando, setSalvando] = useState(false);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const campoMensagem = useRef<HTMLTextAreaElement>(null);

  // Roleta recarregada (ex.: a fila salvou) sem alteração pendente: segue o servidor.
  const pendenteRef = useRef(false);
  const temAlteracao = !mesmoConteudo(d, carregado);
  pendenteRef.current = temAlteracao;
  useEffect(() => { if (!pendenteRef.current) setD(carregado); }, [carregado]);
  useAlteracoesNaoSalvas(temAlteracao);

  useEffect(() => {
    let vivo = true;
    inboxesService.list()
      .then(r => { if (vivo) setInboxes(r.data ?? []); })
      .catch(() => { /* leitura de fundo: sem a lista, o número gravado continua aparecendo */ });
    return () => { vivo = false; };
  }, []);

  const mudar = (p: Partial<Rascunho>) => setD(atual => ({ ...atual, ...p }));

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      const nova = await roletaConfigService.update(roleta.id, {
        business_hours_config: horarioPara(roleta, d),
        after_hours_inbox_id: d.numero || null,
        after_hours_message: d.mensagem.trim() || null,
      });
      aoMudar(nova);
      setD(rascunhoDa(nova));
      toast.success('Horário salvo');
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra salvar o horário. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const ligarMensagem = async (proximo: boolean) => {
    try {
      aoMudar(await roletaConfigService.update(roleta.id, { after_hours_message_enabled: proximo }));
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra salvar. Tente de novo.');
      return false;
    }
  };

  const numeros = numerosParaEscolher(inboxes, d.numero);
  const comMensagem = !!roleta.after_hours_message_enabled;

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Quando a roleta funciona" className="flex flex-wrap gap-2">
        <Button type="button" role="radio" aria-checked={d.sempre} variant={d.sempre ? 'default' : 'outline'} onClick={() => mudar({ sempre: true })}>
          24 horas
        </Button>
        <Button type="button" role="radio" aria-checked={!d.sempre} variant={!d.sempre ? 'default' : 'outline'} onClick={() => mudar({ sempre: false })}>
          Só em alguns horários
        </Button>
      </div>

      {!d.sempre && (
        <>
          <WeeklyWindowsEditor
            value={d.janelas}
            onChange={janelas => mudar({ janelas })}
            idPrefix="roleta_nova_win"
            addLabel="+ Adicionar outra faixa (ex.: fechar no almoço)"
          />

          <div className="space-y-5 border-t border-border pt-5">
            <Chave
              rotulo="Mandar mensagem pro lead enquanto isso"
              descricao="Uma vez por lead, logo que ele chega fora do horário."
              genero="a"
              ligada={comMensagem}
              aoMudar={ligarMensagem}
            />
            {comMensagem && (
              <>
                <Campo id="roleta-fora-numero" rotulo="Número que manda a mensagem">
                  <Seletor
                    id="roleta-fora-numero"
                    value={d.numero}
                    onChange={e => mudar({ numero: e.target.value })}
                    className="w-full sm:w-80"
                  >
                    <option value="">Escolha o número</option>
                    {d.numero && !numeros.some(i => i.id === d.numero) && <option value={d.numero}>Número escolhido antes</option>}
                    {numeros.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </Seletor>
                </Campo>
                <div className="space-y-1">
                  <CampoTextoLongo
                    id="roleta-fora-mensagem"
                    rotulo="Mensagem"
                    rows={4}
                    ref={campoMensagem}
                    placeholder="Ex.: Oi, {{nome}}! Recebemos seu contato. Amanhã cedo um corretor fala com você."
                    valor={d.mensagem}
                    aoMudar={mensagem => mudar({ mensagem })}
                    aviso={!d.numero || !d.mensagem.trim() ? 'Sem número e texto, a mensagem não sai.' : undefined}
                  />
                  <VariableChipBar
                    targetRef={campoMensagem}
                    value={d.mensagem}
                    onChange={mensagem => mudar({ mensagem })}
                    variables={VARIAVEIS_DA_MENSAGEM}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}

      <BarraSalvar
        visivel={temAlteracao}
        salvando={salvando}
        aoSalvar={() => void salvar()}
        aoDescartar={() => setD(carregado)}
      />
    </div>
  );
}
