import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import {
  CHAVES_EMPREENDIMENTO, CHAVES_REVENDA, FICHA_FABRICA,
  type ChaveEmpreendimento, type ChaveRevenda, type FichaConfigDoAdmin,
} from '@/features/siteBuilder/public/fichaConfig';
import { Secao, Secoes } from '../ui/Secao';
import { CLASSE_DO_CAMPO, descricaoDoCampo } from '../ui/Campo';
import type { FormProps } from './tipos';
import BookPeloSite from './BookPeloSite';

// Página do imóvel (Meu site › Personalizar). O que a tela manda é SEMPRE o
// `property_page` inteiro: o servidor troca o bloco gravado pelo recebido.
// `email_copy` vai sempre como lista (o servidor descarta texto ou null em silêncio).

// Teto e regra do servidor (Sites::PropertyPageConfig, mesma regex do Anuncie).
const MAX_EMAILS_COPIA = 3;
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const emailValido = (e: string) => e.trim().length <= 254 && EMAIL_VALIDO.test(e.trim());

type Tipo = 'resale' | 'development';

interface Opcao { rotulo: string; frase: string }

// Cada frase diz o que aparece no site HOJE (regras em src/pages/Public/ficha/fichaDoImovel.ts).
const OPCOES_REVENDA: Record<ChaveRevenda, Opcao> = {
  map: { rotulo: 'Mapa', frase: 'A seção Localização, com o mapa da região. O endereço exato do imóvel não aparece.' },
  popular_badge: {
    rotulo: 'Selo Muito procurado',
    frase: 'Aparece abaixo do título quando a página do imóvel teve mais de 30 visitas nos últimos 30 dias.',
  },
  values: { rotulo: 'Condomínio, IPTU e valor do m²', frase: 'Aparecem junto do preço, quando estão no cadastro.' },
  similar: { rotulo: 'Você também pode gostar', frase: 'Até 3 outros imóveis do site no fim da página, de preferência da mesma cidade.' },
};

const OPCOES_EMPREENDIMENTO: Record<ChaveEmpreendimento, Opcao> = {
  map: {
    rotulo: 'Mapa',
    frase: 'A seção Localização, com o mapa. Com o ponto marcado no cadastro, mostra o lugar exato do empreendimento.',
  },
  popular_badge: OPCOES_REVENDA.popular_badge,
  stage_and_forecast: {
    rotulo: 'Fase da obra e previsão de entrega',
    frase: 'Por exemplo "Em obra · entrega mar/2027", junto do preço.',
  },
  typologies: {
    rotulo: 'Tipologias disponíveis',
    frase: 'A tabela com as plantas cadastradas no empreendimento.',
  },
  builder: {
    rotulo: 'Construtora',
    frase: 'O nome da construtora em Dados do empreendimento, com link pro site dela quando houver. Telefone, CNPJ e contato nunca aparecem.',
  },
  similar: OPCOES_REVENDA.similar,
};

const ABAS = [
  { chave: 'resale', rotulo: 'Imóveis' },
  { chave: 'development', rotulo: 'Empreendimentos' },
];

const FABRICA_DO_ADMIN: FichaConfigDoAdmin = { ...FICHA_FABRICA, email_copy: [] };

export default function TelaFicha({ site, siteForm, setF, aplicarSemMarcar }: FormProps) {
  const ficha: FichaConfigDoAdmin = siteForm.property_page ?? FABRICA_DO_ADMIN;
  const mudar = (parte: Partial<FichaConfigDoAdmin>) => setF({ property_page: { ...ficha, ...parte } });

  const [tipo, setTipo] = useState<Tipo>('resale');
  const emails = ficha.email_copy;
  const mudarEmails = (lista: string[]) => mudar({ email_copy: lista });

  // Aviso de e-mail inválido só quando a pessoa sai do campo: enquanto digita "joao@" não é erro.
  const [editando, setEditando] = useState<number | null>(null);

  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const removerEmail = async (i: number) => {
    const valor = emails[i].trim();
    // Campo em branco não tem o que perder: sai sem perguntar.
    if (valor) {
      const ok = await confirmar({
        titulo: 'Remover e-mail',
        descricao: `${valor} deixa de receber a cópia dos contatos quando você salvar.`,
        rotuloDaAcao: 'Remover',
        destrutivo: true,
      });
      if (!ok) return;
    }
    setEditando(null);
    mudarEmails(emails.filter((_, k) => k !== i));
  };

  return (
    <Secoes>
      <Secao
        titulo="O que aparece"
        descricao="Escolha o que mostrar na página de cada imóvel do site. Imóveis e empreendimentos têm opções separadas. Item sem dado no cadastro não aparece, mesmo marcado."
      >
        <Abas rotulo="Tipo de imóvel" abas={ABAS} ativa={tipo} aoTrocar={c => setTipo(c as Tipo)} />
        <div role="tabpanel" aria-label={tipo === 'resale' ? 'Imóveis' : 'Empreendimentos'} className="space-y-4">
          {tipo === 'resale'
            ? CHAVES_REVENDA.map(k => (
              <Caixinha key={k} id={`ficha-resale-${k}`} opcao={OPCOES_REVENDA[k]} marcada={ficha.resale[k]}
                aoMudar={v => mudar({ resale: { ...ficha.resale, [k]: v } })} />
            ))
            : CHAVES_EMPREENDIMENTO.map(k => (
              <Caixinha key={k} id={`ficha-development-${k}`} opcao={OPCOES_EMPREENDIMENTO[k]} marcada={ficha.development[k]}
                aoMudar={v => mudar({ development: { ...ficha.development, [k]: v } })} />
            ))}
        </div>
      </Secao>

      {tipo === 'development' && site?.id && (
        <Secao titulo="Receber o book no WhatsApp" id="ficha-book">
          <BookPeloSite siteId={site.id} ligado={ficha.development.book_button}
            aoMudarChave={v => aplicarSemMarcar?.(prev => {
              const atual = prev.property_page ?? FABRICA_DO_ADMIN;
              return { property_page: { ...atual, development: { ...atual.development, book_button: v } } };
            })} />
        </Secao>
      )}

      <Secao titulo="Selos de financiamento" descricao="Valem para imóveis e empreendimentos.">
        <Caixinha
          id="ficha-financing_badges"
          opcao={{
            rotulo: 'Mostrar os selos de financiamento',
            frase: 'Aceita financiamento, Aceita FGTS e Minha Casa Minha Vida aparecem abaixo do título, quando estão marcados no cadastro do imóvel.',
          }}
          marcada={ficha.financing_badges}
          aoMudar={v => mudar({ financing_badges: v })}
        />
      </Secao>

      <Secao
        titulo="Cópia por e-mail"
        descricao="Cada contato feito na página de um imóvel também chega nesses e-mails. Ele continua indo pro funil e pra roleta normalmente."
      >
        {emails.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum e-mail ainda: os contatos chegam só no CRM.</p>
        )}
        {emails.map((email, i) => {
          const id = `ficha-email-${i}`;
          const preenchido = editando !== i && email.trim() !== '';
          const invalido = preenchido && !emailValido(email);
          // O servidor grava em minúsculo e sem repetidos: o 2º igual (sem diferença de maiúscula) avisa.
          const chave = email.trim().toLowerCase();
          const repetido = preenchido && !invalido && emails.findIndex(x => x.trim().toLowerCase() === chave) < i;
          const aviso = invalido
            ? 'Esse e-mail não parece certo e não vai ser salvo. Confira se tem @ e o final, como .com.br.'
            : repetido ? 'Esse e-mail já está na lista; ao salvar fica um só.' : undefined;
          return (
            <div key={i} className="space-y-2">
              <UILabel htmlFor={id} className="text-sm font-medium">E-mail {i + 1}</UILabel>
              <div className="flex items-center gap-2">
                <Input id={id} className={CLASSE_DO_CAMPO} inputMode="email" autoComplete="off" value={email}
                  placeholder="gerente@imobiliaria.com.br"
                  aria-invalid={invalido ? true : undefined}
                  aria-describedby={descricaoDoCampo(id, { aviso })}
                  onFocus={() => setEditando(i)}
                  onBlur={() => setEditando(null)}
                  onChange={e => mudarEmails(emails.map((x, k) => (k === i ? e.target.value : x)))} />
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 flex-none"
                  aria-label={`Remover e-mail ${i + 1}`} title={`Remover e-mail ${i + 1}`} onClick={() => removerEmail(i)}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {aviso && <p id={`${id}-aviso`} className="text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}
            </div>
          );
        })}
        {emails.length < MAX_EMAILS_COPIA && (
          <Button type="button" variant="outline" onClick={() => mudarEmails([...emails, ''])}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Adicionar e-mail
          </Button>
        )}
        <p className="text-sm text-muted-foreground">
          Até {MAX_EMAILS_COPIA} e-mails. Se a mesma pessoa pedir contato do mesmo imóvel de novo em menos de 1 hora, não sai outra cópia, e o site manda no máximo 30 cópias por hora. O contato sempre entra no CRM.
        </p>
      </Secao>
      {dialogoDeConfirmacao}
    </Secoes>
  );
}

function Caixinha({ id, opcao, marcada, aoMudar }: { id: string; opcao: Opcao; marcada: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={marcada} className="mt-1" aria-describedby={`${id}-frase`}
        onCheckedChange={v => aoMudar(v === true)} />
      <div className="space-y-0.5">
        <UILabel htmlFor={id} className="cursor-pointer text-base font-normal">{opcao.rotulo}</UILabel>
        <p id={`${id}-frase`} className="text-sm text-muted-foreground">{opcao.frase}</p>
      </div>
    </div>
  );
}
