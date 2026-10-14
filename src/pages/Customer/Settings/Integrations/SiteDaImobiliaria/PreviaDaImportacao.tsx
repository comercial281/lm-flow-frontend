// src/pages/Customer/Settings/Integrations/SiteDaImobiliaria/PreviaDaImportacao.tsx
// O que vai acontecer antes de gravar: contagens, avisos e 5 imóveis do jeito que vão ficar.
import { Button } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { numero, plural } from '@/lib/formato';
import { PROPERTY_TYPE_LABELS } from '@/services/properties/propertiesService';
import type { Previa } from '@/services/properties/siteFeedService';

const FORMATO = { vrsync: 'Padrão dos portais', basel: 'Lista combinada' } as const;

export function resumoDaPrevia(p: Previa): string {
  const c = p.counts;
  const partes = [
    c.create && `criar ${numero(c.create)}`,
    c.update && `atualizar ${numero(c.update)}`,
    c.reactivate && `reativar ${numero(c.reactivate)}`,
    c.inactivate && `inativar ${numero(c.inactivate)}`,
    c.skip && `pular ${numero(c.skip)}`,
  ].filter(Boolean) as string[];
  return partes.length ? `Vai ${partes.join(' · ')}` : 'Nada muda: os imóveis já estão iguais ao arquivo';
}

export function fraseDeInativar(n: number): string {
  return n === 1
    ? '1 imóvel que não está no arquivo vai ficar Inativo (a IA para de oferecer). Nada é excluído.'
    : `${numero(n)} imóveis que não estão no arquivo vão ficar Inativos (a IA para de oferecer). Nada é excluído.`;
}

export default function PreviaDaImportacao({ previa, aoConfirmar }: { previa: Previa; aoConfirmar: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {FORMATO[previa.format]}{previa.provider ? ` (${previa.provider})` : ''} · {plural(previa.total, 'imóvel', 'imóveis')} no arquivo
      </p>
      <p className="font-semibold">{resumoDaPrevia(previa)}</p>
      {previa.shrunk && (
        <Aviso tom="atencao">O arquivo tem menos da metade dos imóveis da última leitura. Confira se o site está normal antes de confirmar.</Aviso>
      )}
      {previa.warnings.map(w => <Aviso key={w.key} tom="info">{w.text}</Aviso>)}
      {previa.sample.length > 0 && (
        <ul className="flex flex-col divide-y rounded-md border">
          {previa.sample.map(s => (
            <li key={s.code} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
              <span><span className="text-muted-foreground">{s.code}</span> · <span>{s.title}</span>
                {s.type_label ? <span className="text-muted-foreground"> · {PROPERTY_TYPE_LABELS[s.type_label] ?? s.type_label}</span> : null}</span>
              <span className="text-muted-foreground">
                {[s.price_label, s.city, plural(s.photos, 'foto', 'fotos')].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div><Button type="button" onClick={aoConfirmar}>Confirmar e importar</Button></div>
    </div>
  );
}
