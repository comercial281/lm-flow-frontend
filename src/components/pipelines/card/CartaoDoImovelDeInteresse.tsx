// Cartão de um imóvel de interesse do lead (janela do card): capa, código,
// situação, título, lugar, preço, preço/m² e características. Funciona com o
// servidor antigo: campo ausente simplesmente não aparece.
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, CalendarPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@evoapi/design-system/dropdown-menu';
import { Button, Card } from '@/components/ui/ds';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import { dinheiro } from '@/lib/formato';
import { cn } from '@/lib/utils';
import {
  INTEREST_STAGE_COLORS,
  INTEREST_STAGE_LABELS,
  type PropertyInterest,
} from '@/services/propertyInterests/propertyInterestsService';
import { linkDoImovel } from './linkDoImovel';

type Etapa = PropertyInterest['interest_stage'];

interface Props {
  interesse: PropertyInterest;
  podeEditar: boolean;
  aoAgendarVisita: (imovel: { id: string; title: string; code: string }) => void;
  aoMudarSituacao: (id: string, etapa: Etapa) => void;
  aoRemover: (id: string) => void;
  removendo?: boolean;
}

const positivo = (n: number | null | undefined): n is number => typeof n === 'number' && n > 0;

function caracteristicas(p: NonNullable<PropertyInterest['property']>): string[] {
  const itens: string[] = [];
  if (positivo(p.bedrooms)) itens.push(`${p.bedrooms} ${p.bedrooms === 1 ? 'dorm' : 'dorms'}`);
  if (positivo(p.suites)) itens.push(`${p.suites} ${p.suites === 1 ? 'suíte' : 'suítes'}`);
  if (positivo(p.parking_spaces)) itens.push(`${p.parking_spaces} ${p.parking_spaces === 1 ? 'vaga' : 'vagas'}`);
  if (positivo(p.useful_area_m2)) itens.push(`${p.useful_area_m2} m²`);
  return itens;
}

export default function CartaoDoImovelDeInteresse({
  interesse, podeEditar, aoAgendarVisita, aoMudarSituacao, aoRemover, removendo,
}: Props) {
  const imovel = interesse.property;
  if (!imovel) return <></>;

  const capa = imovel.cover_photo_url;
  const fotos = imovel.photos_count ?? 0;
  const lugar = [imovel.neighborhood, imovel.city].filter(Boolean).join(' · ');
  const itens = caracteristicas(imovel);
  const etapa = interesse.interest_stage;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative h-28 bg-muted">
        {capa ? (
          <img src={capa} alt={`Foto de capa de ${imovel.title}`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <Building2 className="h-5 w-5" aria-hidden />
            <span className="text-xs">Sem foto</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-white px-1.5 py-0.5 text-xs font-medium text-foreground shadow-sm">
          {imovel.code}
        </span>
        {capa && fotos > 0 && (
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
            {fotos} {fotos === 1 ? 'foto' : 'fotos'}
          </span>
        )}
      </div>

      <div className="grid gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', INTEREST_STAGE_COLORS[etapa])}>
            {INTEREST_STAGE_LABELS[etapa] ?? etapa}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <BotaoMaisAcoes compacto aria-label="Mais ações do imóvel" disabled={removendo} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Mudar situação</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {Object.entries(INTEREST_STAGE_LABELS).map(([valor, rotulo]) => (
                    <DropdownMenuItem
                      key={valor}
                      disabled={valor === etapa}
                      onSelect={() => aoMudarSituacao(interesse.id, valor as Etapa)}
                    >
                      {rotulo}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => aoRemover(interesse.id)}>
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="truncate font-semibold">{imovel.title}</p>
        {lugar && <p className="truncate text-sm text-muted-foreground">{lugar}</p>}
        <p className="flex items-baseline gap-2">
          <span className="font-semibold text-primary">{imovel.display_price}</span>
          {positivo(imovel.price_per_m2) && (
            <span className="text-xs text-muted-foreground">{dinheiro(imovel.price_per_m2, { centavos: false })}/m²</span>
          )}
        </p>
        {itens.length > 0 && <p className="text-sm text-muted-foreground">{itens.join(' · ')}</p>}
      </div>

      <div className="flex gap-2 border-t p-3">
        <Button variant="outline" size="sm" asChild>
          <Link to={linkDoImovel(imovel, podeEditar)}>
            <ArrowUpRight className="h-4 w-4" aria-hidden />
            Abrir
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => aoAgendarVisita({ id: imovel.id, title: imovel.title, code: imovel.code })}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Agendar visita
        </Button>
      </div>
    </Card>
  );
}
