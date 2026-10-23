import { MessageCircle, Smartphone } from 'lucide-react';
import { Card } from '@/components/ui/ds';
import { cn } from '@/lib/utils';

export type CaminhoOficial = 'coexistence' | 'new_number';

interface EscolhaCaminhoOficialProps {
  value: CaminhoOficial | null;
  onChange: (caminho: CaminhoOficial) => void;
  disabled?: boolean;
}

const OPCOES: { id: CaminhoOficial; titulo: string; texto: string; Icone: typeof Smartphone }[] = [
  {
    id: 'coexistence',
    titulo: 'Já uso esse número no app WhatsApp Business',
    texto: 'Continua usando o app no celular. As conversas novas aparecem aqui.',
    Icone: Smartphone,
  },
  {
    id: 'new_number',
    titulo: 'Chip novo, só pra API oficial',
    texto: 'O número fica só no LM Flow. Ele não pode estar no WhatsApp do celular.',
    Icone: MessageCircle,
  },
];

export const EscolhaCaminhoOficial = ({ value, onChange, disabled }: EscolhaCaminhoOficialProps) => (
  <div role="radiogroup" aria-label="Como o número é usado hoje" className="grid gap-3 sm:grid-cols-2">
    {OPCOES.map(({ id, titulo, texto, Icone }) => {
      const marcado = value === id;
      return (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={marcado}
          disabled={disabled}
          onClick={() => onChange(id)}
          className="text-left disabled:opacity-50"
        >
          <Card className={cn('h-full p-4 transition-colors', marcado ? 'border-primary' : 'hover:border-primary/50')}>
            <Icone className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-medium">{titulo}</p>
            <p className="mt-1 text-xs text-muted-foreground">{texto}</p>
          </Card>
        </button>
      );
    })}
  </div>
);
