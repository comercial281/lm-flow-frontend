// Preparar a Sala: conferência, ajustes e nome do lead. Nova demonstração só
// libera com nome preenchido e a conferência toda verde.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input,
} from '@/components/ui/ds';
import { Aviso } from '@/components/base';
import { Seletor } from '@/components/base/Seletor';
import { demoRoomService } from '@/services/demoRoom/demoRoomService';
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { DemoRoomConfig, DemoRoomState, PreflightItem } from '@/types/demoRoom';

export interface PrepararProps {
  state: DemoRoomState;
  onStart: (leadName: string) => void | Promise<void>;
  /** Chamado depois de salvar os ajustes: a tela pai relê o estado (config nova). */
  onSaved?: () => void | Promise<void>;
}

interface Opcao { id: string; name: string }

function mensagemDe(e: unknown, padrao: string): string {
  return e instanceof Error && e.message ? e.message : padrao;
}

function Ajustes({ config, aberto, aoFechar, aoSalvar }: {
  config: DemoRoomConfig; aberto: boolean; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [agentes, setAgentes] = useState<Opcao[]>([]);
  const [fluxos, setFluxos] = useState<Opcao[]>([]);
  const [agentId, setAgentId] = useState(config.agent_id ?? '');
  const [flowId, setFlowId] = useState(config.followup_flow_id ?? '');
  const [codigo, setCodigo] = useState(config.property_code ?? '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setAgentId(config.agent_id ?? '');
    setFlowId(config.followup_flow_id ?? '');
    setCodigo(config.property_code ?? '');
    void salesAgentsService.list().then(l => setAgentes(l.map(a => ({ id: a.id, name: a.name })))).catch(() => setAgentes([]));
    void flowAutomationsService.list({ kind: 'automation' }).then(l => setFluxos(l.map(f => ({ id: f.id, name: f.name })))).catch(() => setFluxos([]));
  }, [aberto, config]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await demoRoomService.saveConfig({
        agent_id: agentId || null,
        followup_flow_id: flowId || null,
        property_code: codigo.trim() || null,
      });
      aoSalvar();
    } catch (e) {
      toast.error(mensagemDe(e, 'Não consegui salvar os ajustes da Sala.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={v => { if (!v) aoFechar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustes da Sala</DialogTitle>
          <DialogDescription>Qual IA atende, qual follow-up roda e qual imóvel a demonstração usa.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 text-sm">
          <div className="grid gap-1.5">
            <label htmlFor="sala-ia" className="font-medium">IA que atende</label>
            <Seletor id="sala-ia" value={agentId} onChange={e => setAgentId(e.target.value)}>
              <option value="">Escolha a IA</option>
              {agentes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Seletor>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="sala-followup" className="font-medium">Follow-up da Sala</label>
            <Seletor id="sala-followup" value={flowId} onChange={e => setFlowId(e.target.value)}>
              <option value="">Escolha o follow-up</option>
              {fluxos.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Seletor>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="sala-imovel" className="font-medium">Código do imóvel</label>
            <Input id="sala-imovel" value={codigo} onChange={e => setCodigo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando}>Salvar ajustes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Preparar({ state, onStart, onSaved }: PrepararProps) {
  const [itens, setItens] = useState<PreflightItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [nome, setNome] = useState('');
  const [ajustes, setAjustes] = useState(false);
  const [comecando, setComecando] = useState(false);
  const vivo = useRef(true);

  const conferir = useCallback(async (voz: boolean) => {
    setConferindo(true);
    try {
      const r = await demoRoomService.preflight(voz);
      if (!vivo.current) return;
      setItens(r);
      setErro(null);
    } catch (e) {
      if (vivo.current) setErro(mensagemDe(e, 'Não consegui conferir a Sala.'));
    } finally {
      if (vivo.current) setConferindo(false);
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void conferir(false);
    return () => { vivo.current = false; };
  }, [conferir]);

  const vermelhos = (itens ?? []).filter(i => !i.ok);
  const liberado = itens !== null && vermelhos.length === 0 && nome.trim() !== '' && !comecando;

  const comecar = async () => {
    setComecando(true);
    try { await onStart(nome.trim()); } finally { if (vivo.current) setComecando(false); }
  };

  return (
    <section aria-label="Preparar a demonstração" data-testid="preparar" className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {itens && vermelhos.length === 0 && <Aviso tom="sucesso">Tudo certo para a demonstração.</Aviso>}
        {vermelhos.map(i => (
          <Aviso key={i.key} tom="erro" titulo={i.label}>{i.fix}</Aviso>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void conferir(false)} disabled={conferindo}>Conferir de novo</Button>
          <Button variant="outline" onClick={() => void conferir(true)} disabled={conferindo}>Testar a voz</Button>
          <Button variant="link" onClick={() => setAjustes(true)}>Ajustes da Sala</Button>
        </div>
      </div>

      {/* Formulário: Enter no nome começa, com as mesmas travas do botão. */}
      <form
        className="space-y-5"
        onSubmit={e => { e.preventDefault(); if (liberado) void comecar(); }}
      >
        <div className="grid gap-2">
          <label htmlFor="sala-lead" className="text-lg font-medium">Primeiro nome do lead</label>
          <Input id="sala-lead" className="h-12 text-lg" value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <Button type="submit" size="lg" disabled={!liberado}>Nova demonstração</Button>
      </form>

      <Ajustes
        config={state.config}
        aberto={ajustes}
        aoFechar={() => setAjustes(false)}
        aoSalvar={() => { setAjustes(false); void onSaved?.(); void conferir(false); }}
      />
    </section>
  );
}
