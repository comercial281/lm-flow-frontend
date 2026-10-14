import { Loader2, Lock, Wand2 } from 'lucide-react';
import { Button, Label as UILabel, Textarea } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import type { Property } from '@/services/properties/propertiesService';
import { dicaSe, useCampoTravado } from '@/features/properties/cadastro/travasDoSite';
import type { PropsDaSecao } from './tipos';

/*
 * Observação interna do corretor trazida por importação (a "nota do corretor" do
 * Kenlo: "proprietário quer no mínimo X em mãos"). Fica nos campos livres do
 * imóvel, que NÃO vão para o site público, para os feeds dos portais nem para o
 * contexto da IA Vendedora — é justamente por isso que ela pode morar ali.
 *
 * Lê só ESTAS chaves, de propósito. Os campos livres também guardam as
 * características que não têm equivalente no catálogo, o empreendimento de
 * origem e o nome dos corretores da base antiga: despejar tudo na tela viraria
 * gaveta de bagunça em cima da ficha.
 */
const INTERNAL_NOTE_KEYS = ['kenlo_obs_interna', 'obs_interna'] as const;

const internalNoteOf = (p: Property | null): string | null => {
  const bag = p?.custom_attributes;
  if (!bag) return null;
  for (const k of INTERNAL_NOTE_KEYS) {
    const v = (bag as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

interface Props extends PropsDaSecao {
  podeGerar: boolean;
  gerando: boolean;
  aoGerar: () => void;
}

export default function SecaoDescricao({ form: f, setF, editando, podeGerar, gerando, aoGerar }: Props) {
  const notaInterna = internalNoteOf(editando);
  // Descrição que vem do site fica travada; a IA também não reescreve por cima.
  const travada = useCampoTravado('description');
  return (
    <div className="mt-4 space-y-4">
      <div title={dicaSe(travada)}>
        <div className="flex items-center justify-between mb-1">
          <UILabel htmlFor="campo-descricao">Descrição</UILabel>
          {podeGerar && !travada && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={gerando}
              onClick={aoGerar}
              className="text-xs gap-1"
            >
              {gerando
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Wand2 className="h-3 w-3" />
              }
              Gerar descrição com IA
            </Button>
          )}
        </div>
        <Textarea id="campo-descricao" value={f.description} disabled={travada} onChange={e => setF({ description: e.target.value })}
          rows={5} placeholder="Descreva o imóvel..." className="resize-none" />
      </div>

      {/* Observação interna vinda da importação: só leitura, e só quando existe.
          Fica colada na Descrição de propósito — uma é o que o cliente lê, a
          outra é o que só a imobiliária vê. */}
      {notaInterna && (
        <Aviso tom="atencao" icone={Lock} titulo="Observações internas (importado do Kenlo)">
          <p className="whitespace-pre-wrap">{notaInterna}</p>
          <p className="mt-2 text-xs">
            Não aparece no site, não vai para os portais e a IA Vendedora não lê.
          </p>
        </Aviso>
      )}
    </div>
  );
}
