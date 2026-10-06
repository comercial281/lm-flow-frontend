import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import { dinheiro, numero, tempoDesde, toDate } from '@/lib/formato';
import { clientesService } from '@/services/superAdmin/clientesService';
import { overviewService } from '@/services/superAdmin/overviewService';
import type { ClientePooled, Pessoa } from '@/types/admin/clientes';
import type { ClienteComProblema, Numeros } from '@/types/admin/overview';
import { linhasDoProblema } from '@/pages/Admin/Area/VisaoGeral/formatoAtencao';
import AiUsageLine from '../AiUsageLine';
import { EQUIPE, chaveDoCliente } from '../lista';

// Resumo do cliente: problemas da Atenção e números do mês, das MESMAS contas
// da Visão Geral (batem com ela). Cada parte carrega sozinha e falha sozinha.
type Leitura<T> = { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; valor: T };

// Último acesso de alguém do cliente: o mais recente entre as pessoas, sem a
// equipe da Leal Mídia (o "Entrar" do admin esconderia que o cliente sumiu).
function ultimoAcesso(pessoas: Pessoa[]): { quando: string; quem: string } | null {
  let melhor: { quando: string; quem: string; ms: number } | null = null;
  for (const p of pessoas) {
    if (EQUIPE.test(p.email)) continue;
    const ms = toDate(p.last_seen_at)?.getTime();
    if (ms !== undefined && !Number.isNaN(ms) && (!melhor || ms > melhor.ms)) melhor = { quando: p.last_seen_at as string, quem: p.name || p.email, ms };
  }
  return melhor;
}

export default function AbaResumo({ cliente: t }: { cliente: ClientePooled }) {
  const [problema, setProblema] = useState<Leitura<ClienteComProblema | null>>({ tipo: 'carregando' });
  const [numeros, setNumeros] = useState<Leitura<Numeros>>({ tipo: 'carregando' });
  const [acesso, setAcesso] = useState<Leitura<{ quando: string; quem: string } | null>>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const [tentativaNumeros, setTentativaNumeros] = useState(0);
  const [tentativaAcesso, setTentativaAcesso] = useState(0);
  const chave = chaveDoCliente(t);

  useEffect(() => {
    let ignore = false;
    setProblema({ tipo: 'carregando' });
    overviewService.atencao()
      .then((a) => { if (!ignore) setProblema({ tipo: 'pronto', valor: a.clients.find((c) => (c.slug ?? c.schema) === chave) ?? null }); })
      .catch(() => { if (!ignore) setProblema({ tipo: 'erro' }); });
    return () => { ignore = true; };
  }, [t.id, chave, tentativa]);

  useEffect(() => {
    let ignore = false;
    setNumeros({ tipo: 'carregando' });
    overviewService.numeros({ periodo: 'mes_atual', tenant: t.schema_name })
      .then((n) => { if (!ignore) setNumeros({ tipo: 'pronto', valor: n }); })
      .catch(() => { if (!ignore) setNumeros({ tipo: 'erro' }); });
    return () => { ignore = true; };
  }, [t.id, t.schema_name, tentativaNumeros]);

  useEffect(() => {
    let ignore = false;
    setAcesso({ tipo: 'carregando' });
    clientesService.pessoas(t.id)
      .then((p) => { if (!ignore) setAcesso({ tipo: 'pronto', valor: ultimoAcesso(p) }); })
      .catch(() => { if (!ignore) setAcesso({ tipo: 'erro' }); });
    return () => { ignore = true; };
  }, [t.id, tentativaAcesso]);

  // Cliente congelado/arquivado/sem schema fica fora da conta da Visão Geral e a resposta cai nas contas da agência
  // inteira: só vale se veio exatamente deste cliente.
  const dadosSaoDele = numeros.tipo === 'pronto' && numeros.valor.clients.length === 1 && numeros.valor.clients[0].schema === t.schema_name;
  const semNumeros = numeros.tipo === 'pronto' && !dadosSaoDele;
  const totais = dadosSaoDele && numeros.tipo === 'pronto' ? numeros.valor.totals : undefined;
  const cartoes = [
    { rotulo: 'Leads no mês', carrega: true, valor: totais && numero(totais.leads) },
    { rotulo: 'Conversas no mês', carrega: true, valor: totais && numero(totais.conversations) },
    { rotulo: 'Pessoas ativas', carrega: true, valor: totais && numero(totais.users_active) },
    { rotulo: 'Atendidos pela IA', carrega: true, valor: totais && numero(totais.ai_attended) },
    { rotulo: 'Custo da IA no mês', carrega: true, valor: totais && dinheiro(totais.ai_cost_brl) },
    { rotulo: 'Números de WhatsApp', carrega: false, valor: `${t.whatsapp_channels_used ?? '—'}${t.max_whatsapp_channels ? ` de ${t.max_whatsapp_channels}` : ''}` },
  ];
  const comProblema = problema.tipo === 'pronto' ? problema.valor : null;

  return (
    <div className="flex flex-col gap-4">
      {problema.tipo === 'erro' && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm text-muted-foreground">
          <span>Não deu pra conferir os problemas deste cliente.</span>
          <Button size="sm" variant="outline" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Button>
        </div>
      )}
      {comProblema && (
        <section aria-labelledby="problemas" className="rounded-lg border border-red-500/40 p-4">
          <h2 id="problemas" className="mb-2 text-sm font-medium">Precisa de atenção</h2>
          <ul className="flex flex-col gap-2">
            {comProblema.problems.flatMap((p) => linhasDoProblema(comProblema, p).map((l, i) => (
              <li key={`${p.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{l.texto}</span><Link className="text-primary underline-offset-2 hover:underline" to={l.acao.href}>{l.acao.rotulo}</Link>
              </li>
            )))}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.rotulo}</p>
            <p className="mt-1 text-2xl font-semibold">{numeros.tipo === 'carregando' && c.carrega ? '…' : c.valor ?? '—'}</p>
          </div>
        ))}
      </div>
      {numeros.tipo === 'erro' && (
        <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Não deu pra ler os números do mês agora.</span>
          <Button size="sm" variant="outline" onClick={() => setTentativaNumeros((n) => n + 1)}>Tentar de novo</Button>
        </div>
      )}
      {semNumeros && <p role="status" className="text-sm text-muted-foreground">Sem números deste cliente no mês.</p>}
      <div className="rounded-lg border bg-card p-4 text-sm">
        {acesso.tipo === 'carregando' && <span className="text-muted-foreground">Último acesso: …</span>}
        {acesso.tipo === 'erro' && (
          <span role="status" className="flex flex-wrap items-center gap-3 text-muted-foreground">
            Não deu pra ver o último acesso.
            <Button size="sm" variant="outline" onClick={() => setTentativaAcesso((n) => n + 1)}>Tentar de novo</Button>
          </span>
        )}
        {acesso.tipo === 'pronto' && (acesso.valor
          ? <span>Último acesso: {tempoDesde(acesso.valor.quando)} ({acesso.valor.quem})</span>
          : <span className="text-muted-foreground">Ninguém entrou ainda</span>)}
      </div>
      <div className="rounded-lg border bg-card p-4"><AiUsageLine u={t.ai_usage} /></div>
    </div>
  );
}
