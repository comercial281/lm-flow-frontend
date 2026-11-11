// "Condomínio (opcional)" no cadastro da unidade (Revenda e Leilão). Busca no molde
// do SeletorDeImoveis: a lista abre ao entrar no campo, busca no servidor com atraso
// ao digitar e só a resposta mais nova vale. Escolher busca o condomínio inteiro
// (a unidade precisa do endereço e das comodidades dele) e entrega pra página, que
// decide se pergunta antes de plugar.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button, Input, Label as UILabel } from '@/components/ui/ds';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { useGuardaDeSaida } from '@/hooks/useAlteracoesNaoSalvas';
import {
  ROTULO_DO_TIPO,
  condominiumsService,
  type Condominium,
  type CondominiumRow,
} from '@/services/condominiums/condominiumsService';
import type { Property } from '@/services/properties/propertiesService';
import { linkParaCadastrarCondominio } from '@/features/properties/condominios/regrasDoCondominio';

const TEXTOS = {
  rotulo: 'Condomínio (opcional)',
  buscar: 'Buscar condomínio pelo nome',
  carregando: 'Carregando condomínios…',
  nenhum: 'Nenhum condomínio encontrado.',
  erro: 'Não deu pra carregar os condomínios. Tente de novo.',
  erroAoAbrir: 'Não deu pra abrir esse condomínio. Tente de novo.',
  tirar: 'Tirar do condomínio',
  cadastrar: '+ Cadastrar condomínio',
} as const;

const POR_PAGINA = 8;

const ondeFica = (c: CondominiumRow) => {
  const rua = [c.address_street, c.address_number].map(v => v?.trim()).filter(Boolean).join(', ');
  return [rua, c.address_neighborhood?.trim(), c.address_city?.trim()].filter(Boolean).join(' · ');
};

interface Props {
  escolhido: Property['condominium'];
  aoEscolher: (c: Condominium) => void;
  aoTirar: () => void;
  /** Unidade que não pode plugar (vem do site): busca parada, com o motivo embaixo. */
  desligado: boolean;
  motivo?: string;
  /** Com `condominiums.manage`: oferece cadastrar um condomínio novo. */
  podeCadastrar: boolean;
}

export default function CampoDoCondominio({ escolhido, aoEscolher, aoTirar, desligado, motivo, podeCadastrar }: Props) {
  const { pathname, search } = useLocation();
  const { aoClicar, dialogoDeConfirmacao } = useGuardaDeSaida();
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<CondominiumRow[]>([]);
  const [pronto, setPronto] = useState(false); // 1ª resposta da lista já veio (ou falhou)
  const [erro, setErro] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erroAoAbrir, setErroAoAbrir] = useState(false);

  const buscando = aberto && !escolhido && !desligado;

  // Lista: imediata ao abrir; com atraso de 300 ms ao digitar. Só a resposta mais nova vale.
  useEffect(() => {
    if (!buscando) return;
    const q = texto.trim();
    let vivo = true;
    const buscar = () => {
      condominiumsService.list({ ...(q ? { q } : {}), per_page: POR_PAGINA })
        .then(r => { if (!vivo) return; setLista(r.data ?? []); setErro(false); setPronto(true); })
        .catch(() => { if (vivo) { setLista([]); setErro(true); setPronto(true); } });
    };
    if (!q) { buscar(); return () => { vivo = false; }; }
    const espera = window.setTimeout(buscar, 300);
    return () => { window.clearTimeout(espera); vivo = false; };
  }, [buscando, texto]);

  const escolher = async (linha: CondominiumRow) => {
    setAbrindo(linha.id);
    setErroAoAbrir(false);
    try {
      const c = await condominiumsService.get(linha.id);
      setAberto(false);
      setTexto('');
      aoEscolher(c);
    } catch {
      setErroAoAbrir(true);
    } finally {
      setAbrindo(null);
    }
  };

  const cadastrar = podeCadastrar && (
    <Link
      to={linkParaCadastrarCondominio(pathname, search)}
      onClickCapture={aoClicar}
      className="justify-self-start text-sm font-medium text-primary hover:underline"
    >
      {TEXTOS.cadastrar}
    </Link>
  );

  return (
    <div className="grid min-w-0 gap-2">
      <UILabel htmlFor={escolhido ? undefined : 'campo-condominio-da-unidade'}>{TEXTOS.rotulo}</UILabel>

      {escolhido ? (
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{escolhido.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{ROTULO_DO_TIPO[escolhido.kind] ?? ''}</span>
          </span>
          {/* Até com a fonte do site religada: tirar sempre pode (o site já vence campo a campo). */}
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={aoTirar}>{TEXTOS.tirar}</Button>
        </div>
      ) : (
        <div
          className="grid min-w-0 gap-2"
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberto(false); }}
          onKeyDown={e => { if (e.key === 'Escape') setAberto(false); }}
        >
          <div className="relative min-w-0" title={desligado ? motivo : undefined}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="campo-condominio-da-unidade"
              value={texto}
              onChange={e => { setTexto(e.target.value); setAberto(true); }}
              onFocus={() => setAberto(true)}
              placeholder={TEXTOS.buscar}
              className="pl-9"
              disabled={desligado}
              autoComplete="off"
            />
          </div>

          {buscando && (
            // Clicar na lista não tira o foco do campo (senão ela fecha antes do clique valer).
            <div className="min-w-0 overflow-hidden rounded-md border border-border" onMouseDown={e => e.preventDefault()}>
              {!pronto ? (
                <Carregando variante="lista" linhas={3} rotulo={TEXTOS.carregando} />
              ) : erro ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">{TEXTOS.erro}</p>
              ) : lista.length === 0 ? (
                <EmptyState tamanho="compacto" title={TEXTOS.nenhum} />
              ) : (
                <ul className="max-h-60 min-w-0 overflow-y-auto overflow-x-hidden">
                  {lista.map(c => (
                    <li key={c.id} className="min-w-0">
                      <button
                        type="button"
                        disabled={abrindo !== null}
                        onClick={() => void escolher(c)}
                        className="flex w-full min-w-0 flex-col border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50 disabled:cursor-wait disabled:opacity-60"
                      >
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{ondeFica(c)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {erroAoAbrir && <p className="border-t border-border px-3 py-2 text-sm text-destructive">{TEXTOS.erroAoAbrir}</p>}
            </div>
          )}

          {desligado ? (motivo && <p className="text-xs text-muted-foreground">{motivo}</p>) : cadastrar}
        </div>
      )}
      {dialogoDeConfirmacao}
    </div>
  );
}
