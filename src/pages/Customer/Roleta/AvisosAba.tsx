import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import BarraSalvar from '@/components/base/BarraSalvar';
import Chave from '@/components/base/Chave';
import { Campo, CampoTextoLongo } from '@/components/base/Campo';
import EmptyState from '@/components/base/EmptyState';
import IconActionButton from '@/components/base/IconActionButton';
import { Secao, Secoes } from '@/components/base/Secao';
import { Seletor } from '@/components/base/Seletor';
import { VariableChipBar } from '@/components/flowAutomations/VariableChipBar';
import { mesmoConteudo, useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import usersService from '@/services/users/usersService';
import type { User } from '@/types/users';
import { leadAutomationService, type WaGroup } from '@/services/leadAutomation/leadAutomationService';
import { mensagemDoServidor } from '@/services/roletaConfig/roletaConfigService';
import {
  camposGravaveis,
  roletaSettingsService,
  type RoletaNoticeKey,
  type RoletaSettings,
  type RoletaTemplateKey,
} from '@/services/roletaConfig/roletaSettingsService';

// ── AVISOS DA ROLETA (roleta nova, D7) ──────────────────────────────────────
//
// Configurados UMA vez e valem pra todas as roletas, organizados por quem
// recebe: Corretor · Gestor · Grupo. Tudo sai pelo Operacional (LM01),
// inclusive o grupo; não existe mais "Número que envia os avisos" na tela.
// Todos nascem desligados.
//
// Chaves, gestores e grupo valem na hora. Os textos esperam o Salvar.

// Instância central da Leal Mídia que está em todos os grupos de cliente (a
// mesma fonte do "Grupo de avisos" da tela antiga).
const CENTRAL_DOS_GRUPOS = 'Operacional (LM01)';

const VARIAVEIS_DOS_AVISOS = [
  { token: '{{nome}}', label: '+ Nome do lead' },
  { token: '{{corretor}}', label: '+ Corretor' },
  { token: '{{prazo}}', label: '+ Prazo' },
  { token: '{{link_aceite}}', label: '+ Link pra aceitar' },
  { token: '{{origem}}', label: '+ Origem' },
  { token: '{{roleta}}', label: '+ Roleta' },
];

const TEXTOS: { chave: RoletaTemplateKey; rotulo: string }[] = [
  { chave: 'template_broker_offer', rotulo: 'Corretor: lead novo esperando o aceite' },
  { chave: 'template_broker_won', rotulo: 'Corretor: "O lead é seu"' },
  { chave: 'template_gestor_exhausted', rotulo: 'Gestor: ninguém aceitou o lead' },
  { chave: 'template_gestor_accepted', rotulo: 'Gestor: corretor aceitou' },
  { chave: 'template_group_offer', rotulo: 'Grupo: lead novo na roleta' },
  { chave: 'template_group_repass', rotulo: 'Grupo: lead repassado pro próximo' },
];

type Textos = Record<RoletaTemplateKey, string>;

const textosDe = (s: RoletaSettings): Textos =>
  Object.fromEntries(TEXTOS.map(t => [t.chave, s[t.chave] ?? ''])) as Textos;

// Declarado no escopo do módulo: guarda o ref do campo pro botão de inserir.
function CampoDeTexto({ chave, rotulo, valor, aoMudar }: { chave: RoletaTemplateKey; rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-1">
      <CampoTextoLongo
        id={`aviso-${chave}`}
        rotulo={rotulo}
        rows={4}
        ref={ref}
        placeholder="Em branco, vai o texto de fábrica."
        valor={valor}
        aoMudar={aoMudar}
      />
      <VariableChipBar targetRef={ref} value={valor} onChange={aoMudar} variables={VARIAVEIS_DOS_AVISOS} />
    </div>
  );
}

export default function AvisosAba() {
  const [avisos, setAvisos] = useState<RoletaSettings | null>(null);
  const [erro, setErro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [equipe, setEquipe] = useState<User[]>([]);
  const [grupos, setGrupos] = useState<WaGroup[] | null>(null);
  const [personalizando, setPersonalizando] = useState(false);
  const [textos, setTextos] = useState<Textos | null>(null);
  const [salvandoTextos, setSalvandoTextos] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    setAvisos(null);
    try {
      const s = await roletaSettingsService.get();
      setAvisos(s);
      setTextos(textosDe(s));
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  // Listas de fundo: falha só deixa o seletor vazio (o gravado continua à vista).
  useEffect(() => {
    let vivo = true;
    usersService.getUsers({ per_page: 200 }).then(r => { if (vivo) setEquipe(r.data ?? []); }).catch(() => {});
    leadAutomationService.getGroups(CENTRAL_DOS_GRUPOS, true)
      .then(g => { if (vivo) setGrupos([...g].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))); })
      .catch(() => { if (vivo) setGrupos([]); });
    return () => { vivo = false; };
  }, []);

  const textosGravados = useMemo(() => (avisos ? textosDe(avisos) : null), [avisos]);
  const textosMudaram = !!textos && !!textosGravados && !mesmoConteudo(textos, textosGravados);
  useAlteracoesNaoSalvas(textosMudaram);

  if (erro) return <EmptyState tipo="erro" aoTentarDeNovo={carregar} />;
  if (!avisos || !textos) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-label="Carregando os avisos">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  /** Grava na hora, a partir do que JÁ está salvo (texto em edição não vai junto). */
  const gravar = async (mudanca: Partial<RoletaSettings>, aviso?: string): Promise<boolean> => {
    if (ocupado) return false;
    setOcupado(true);
    try {
      const salvo = await roletaSettingsService.update(camposGravaveis({ ...avisos, ...mudanca }));
      setAvisos(salvo);
      if (aviso) toast.success(aviso);
      return true;
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra salvar. Tente de novo.');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const chave = (k: RoletaNoticeKey, rotulo: string, descricao?: string, desabilitada = false) => (
    <Chave
      rotulo={rotulo}
      descricao={descricao}
      ligada={avisos[k]}
      desabilitada={desabilitada}
      aoMudar={async proximo => ((await gravar({ [k]: proximo })) ? undefined : false)}
    />
  );

  const nomeDaPessoa = (id: string) =>
    avisos.gestores.find(g => g.id === id)?.name || equipe.find(u => u.id === id)?.name || 'Pessoa da Equipe';
  const semWhatsapp = (id: string) => avisos.gestores.find(g => g.id === id)?.whatsapp_present === false;
  const paraAdicionar = equipe
    .filter(u => !u.deactivated && !avisos.gestor_user_ids.includes(u.id))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  const grupoGravado = avisos.group_jid ?? '';
  const listaDeGrupos = grupos ?? [];

  const salvarTextos = async () => {
    if (salvandoTextos) return;
    setSalvandoTextos(true);
    try {
      const limpos = Object.fromEntries(TEXTOS.map(t => [t.chave, textos[t.chave].trim() || null]));
      const salvo = await roletaSettingsService.update(camposGravaveis({ ...avisos, ...limpos }));
      setAvisos(salvo);
      setTextos(textosDe(salvo));
      toast.success('Textos salvos');
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra salvar os textos. Tente de novo.');
    } finally {
      setSalvandoTextos(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Valem para todas as roletas e saem pelo WhatsApp da Leal Mídia. Todos começam desligados.
      </p>
      <Secoes>
        <Secao titulo="Corretor" descricao="Quem recebe o lead da roleta.">
          {chave('notify_broker_offer', 'Lead novo esperando o aceite', 'No WhatsApp e no celular')}
          {chave('notify_broker_won', '"O lead é seu", no aceite', 'No WhatsApp')}
        </Secao>

        <Secao
          titulo="Gestor"
          descricao="Pessoas da Equipe que acompanham as roletas. O WhatsApp vem do cadastro de cada uma."
        >
          <div className="space-y-3">
            {avisos.gestor_user_ids.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum gestor escolhido ainda.</p>
            ) : (
              <ul className="space-y-2" aria-label="Gestores que recebem os avisos">
                {avisos.gestor_user_ids.map(id => (
                  <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{nomeDaPessoa(id)}</span>
                      {semWhatsapp(id) && (
                        <span className="block text-sm text-amber-700 dark:text-amber-400">sem WhatsApp no cadastro: não recebe</span>
                      )}
                    </span>
                    <IconActionButton
                      label={`Tirar ${nomeDaPessoa(id)} dos gestores`}
                      variant="ghost"
                      disabled={ocupado}
                      onClick={() => void gravar({ gestor_user_ids: avisos.gestor_user_ids.filter(x => x !== id) }, 'Gestor tirado')}
                      icon={<X className="h-4 w-4" />}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Seletor
              aria-label="Adicionar gestor"
              value=""
              disabled={ocupado || paraAdicionar.length === 0}
              onChange={e => { if (e.target.value) void gravar({ gestor_user_ids: [...avisos.gestor_user_ids, e.target.value] }, 'Gestor adicionado'); }}
              className="w-64"
            >
              <option value="">+ Adicionar gestor</option>
              {paraAdicionar.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Seletor>
          </div>
          {chave('notify_gestor_exhausted', 'Ninguém aceitou o lead', 'No WhatsApp')}
          {chave('notify_gestor_accepted', 'Corretor aceitou', 'No WhatsApp')}
          {chave('notify_gestor_morning', 'Resumo da manhã', 'No WhatsApp, às 8h: o que chegou fora do horário')}
        </Secao>

        <Secao titulo="Grupo" descricao="Um grupo de WhatsApp, se quiser. A lista é a dos grupos do Operacional.">
          <Campo id="avisos-grupo" rotulo="Grupo que recebe">
            <Seletor
              id="avisos-grupo"
              value={grupoGravado}
              disabled={ocupado || grupos === null}
              onChange={e => {
                const jid = e.target.value;
                const g = listaDeGrupos.find(x => x.id === jid);
                void gravar({ group_jid: jid || null, group_name: jid ? g?.name ?? avisos.group_name : null }, jid ? 'Grupo escolhido' : 'Sem grupo');
              }}
              className="w-full sm:w-80"
            >
              <option value="">Nenhum</option>
              {grupoGravado && !listaDeGrupos.some(g => g.id === grupoGravado) && (
                <option value={grupoGravado}>{avisos.group_name || 'Grupo escolhido antes'}</option>
              )}
              {listaDeGrupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Seletor>
          </Campo>
          {chave('notify_group_offer', 'Lead novo na roleta', grupoGravado ? 'No grupo' : 'Escolha o grupo primeiro', !grupoGravado && !avisos.notify_group_offer)}
          {chave('notify_group_repass', 'Lead repassado pro próximo', grupoGravado ? 'No grupo' : 'Escolha o grupo primeiro', !grupoGravado && !avisos.notify_group_repass)}
        </Secao>

        <Secao
          titulo="Personalizar textos"
          descricao="Os textos de fábrica já funcionam, inclusive com roleta sem prazo. Mude só se quiser."
          acao={
            <Button type="button" variant="outline" aria-expanded={personalizando} onClick={() => setPersonalizando(p => !p)}>
              {personalizando ? 'Fechar os textos' : 'Personalizar textos'}
            </Button>
          }
        >
          {personalizando && TEXTOS.map(t => (
            <CampoDeTexto
              key={t.chave}
              chave={t.chave}
              rotulo={t.rotulo}
              valor={textos[t.chave]}
              aoMudar={v => setTextos(atual => (atual ? { ...atual, [t.chave]: v } : atual))}
            />
          ))}
        </Secao>
      </Secoes>

      <BarraSalvar
        visivel={textosMudaram}
        salvando={salvandoTextos}
        aoSalvar={() => void salvarTextos()}
        aoDescartar={() => textosGravados && setTextos(textosGravados)}
      />
    </div>
  );
}
