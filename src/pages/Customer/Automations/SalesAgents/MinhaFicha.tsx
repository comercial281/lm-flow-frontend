// "Minha ficha da IA" (fase 6, Tarefa 76): o corretor dono de um número muda, só no número dele,
// o nome, "ele ou ela" e como se apresenta. A voz (quem fala) é do gestor. Grava na hora, no
// padrão das telas da IA: texto ao sair do campo, escolha no clique; se o servidor recusa, o campo
// volta ao valor anterior e a frase do servidor aparece como veio.
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BaseHeader, Carregando, EmptyState, Pagina } from '@/components/base';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { CampoTexto } from '@/components/base/Campo';
import { salesAgentsService, type CamposDaMinhaFicha, type MinhaFicha as Ficha } from '@/services/salesAgents/salesAgentsService';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';
import { previaDaApresentacao, ROTULO_DA_VOZ, vozDoNumero } from '@/features/salesAgents/fichas';
import { useMinhasFichas } from '@/features/salesAgents/useMinhasFichas';

const GENEROS = [{ valor: 'ela' as const, rotulo: 'Ela' }, { valor: 'ele' as const, rotulo: 'Ele' }];

/** Campo de uma linha que grava ao sair e volta ao valor anterior se a gravação falhar. */
function CampoDaFicha({ id, rotulo, salvo, placeholder, maxLength, ajuda, aoGravar }: {
  id: string; rotulo: string; salvo: string; placeholder?: string; maxLength?: number; ajuda?: string;
  aoGravar: (texto: string) => Promise<boolean>;
}) {
  const [valor, setValor] = useState(salvo);
  const [base, setBase] = useState(salvo);
  if (salvo !== base) { setBase(salvo); setValor(salvo); }

  const sair = async () => {
    if (valor.trim() === salvo.trim()) { setValor(salvo); return; }
    if (!(await aoGravar(valor.trim()))) setValor(salvo);
  };
  return (
    <CampoTexto id={id} rotulo={rotulo} valor={valor} aoMudar={setValor} onBlur={() => { void sair(); }}
      placeholder={placeholder} maxLength={maxLength} ajuda={ajuda}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
  );
}

function Cartao({ ficha, aoSalvar }: { ficha: Ficha; aoSalvar: (f: Ficha) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const propria = ficha.voice ?? {};
  const voz = vozDoNumero(ficha, ficha.house_voice);
  const casa = ficha.house_voice ?? {};
  const rotuloDoNumero = ficha.inbox_name || ficha.phone || 'sem nome';

  const gravar = async (campos: CamposDaMinhaFicha): Promise<boolean> => {
    setErro(null);
    try {
      aoSalvar(await salesAgentsService.gravarMinhaFicha(ficha.id, campos));
      return true;
    } catch (e) {
      setErro(motivoDaFalha(e, 'Não consegui salvar a ficha.'));
      return false;
    }
  };

  return (
    <section role="group" aria-label={`Número ${rotuloDoNumero}`}
      className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{rotuloDoNumero}</h2>
        <p className="text-sm text-muted-foreground">
          IA: {ficha.agent_name}{ficha.phone ? ` · ${ficha.phone}` : ''}
        </p>
        <p className="text-sm">
          Voz: <span className="font-medium">{voz.kind ? ROTULO_DA_VOZ[voz.kind] : 'Da casa'}</span>
        </p>
        <p className="text-sm text-muted-foreground">A voz quem escolhe é o gestor.</p>
      </header>

      <CampoDaFicha id={`nome-${ficha.id}`} rotulo="Nome" salvo={propria.name ?? ''} placeholder={casa.name || 'Como a IA te chama'}
        maxLength={60} ajuda="Em branco, vale o nome da ficha da casa." aoGravar={(name) => gravar({ name })} />

      <div className="space-y-2">
        <p className="text-sm font-medium">Ele ou ela</p>
        <BotoesDeEscolha rotulo="Ele ou ela" valor={voz.gender ?? null} opcoes={GENEROS}
          aoEscolher={(gender) => { void gravar({ gender }); }} />
      </div>

      <CampoDaFicha id={`intro-${ficha.id}`} rotulo="Como se apresenta" salvo={propria.intro ?? ''}
        placeholder={casa.intro || 'Ex.: aqui é o Caio, corretor da imobiliária'} maxLength={200}
        ajuda="Uma linha, até 200 caracteres. Em branco, vale a apresentação da casa." aoGravar={(intro) => gravar({ intro })} />

      <div className="space-y-1 rounded-xl bg-muted p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prévia da primeira mensagem</p>
        <p className="text-sm">{previaDaApresentacao(voz)}</p>
      </div>

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </section>
  );
}

export default function MinhaFicha() {
  const { fichas, temNumero, estado, trocar } = useMinhasFichas(true);
  const cabecalho = <BaseHeader title="Minha ficha da IA" />;

  if (estado === 'carregando') {
    return <Pagina cabecalho={cabecalho}><Carregando variante="texto" linhas={4} rotulo="Carregando a ficha..." /></Pagina>;
  }
  if (estado === 'erro') {
    return <Pagina cabecalho={cabecalho}><EmptyState title="Não consegui abrir sua ficha" description="Recarregue a página. Se continuar, avise o gestor." /></Pagina>;
  }
  if (!temNumero) return <Navigate to="/dashboard" replace />;

  return (
    <Pagina cabecalho={cabecalho}>
      <div className="mx-auto max-w-2xl space-y-5">
        <p className="text-sm text-muted-foreground">
          É assim que a IA fala no seu número. Você muda o nome, o ele ou ela e como ela se apresenta.
        </p>
        {fichas.map((f) => <Cartao key={f.id} ficha={f} aoSalvar={trocar} />)}
      </div>
    </Pagina>
  );
}
