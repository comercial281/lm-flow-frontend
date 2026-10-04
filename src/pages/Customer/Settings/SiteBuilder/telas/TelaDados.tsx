import { BrPhoneInput } from '@/components/shared/BrPhoneInput';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { cn } from '@/lib/utils';
import { Secao, Secoes } from '../ui/Secao';
import { CLASSE_DO_CAMPO, Campo, CampoTexto, CampoTextoLongo, descricaoDoCampo } from '../ui/Campo';
import type { FormProps } from './tipos';

// Formatos gravados (não mudam com a máscara — o site público lê estes valores):
// - WhatsApp: só dígitos com o 55 ("5511987654321"). O site monta o link do
//   botão verde com os dígitos (wa.me/5511…); número antigo sem o 55 aparece
//   como Brasil e ganha o 55 no próximo Salvar, como no resto do app.
// - Telefone: o texto como aparece no site, "(11) 3333-4444". O topo e o rodapé
//   mostram o telefone exatamente como gravado; o "ligar" usa só os dígitos.

const PARECE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digitos = (v: string) => v.replace(/\D/g, '');

// Telefone antigo gravado com o 55 ("+55 11 3333-4444") entra na máscara sem ele.
function paraMascara(valor: string): string {
  const d = digitos(valor);
  return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : valor;
}

export default function TelaDados({ siteForm, setF }: FormProps) {
  const telefone = siteForm.contact_phone ?? '';
  const telefoneNaMascara = paraMascara(telefone);
  const email = siteForm.contact_email ?? '';
  const avisoEmail = email.trim() !== '' && !PARECE_EMAIL.test(email.trim())
    ? 'Isso não parece um e-mail. Confira se tem o @ e o final (.com, .com.br).'
    : undefined;

  const ajudaTelefone = 'Aparece no topo e no rodapé do site. No celular, quem toca no número já liga.';
  const ajudaZap = 'Para onde vai o botão verde do WhatsApp, no topo, no rodapé e na página de cada imóvel.';

  return (
    <Secoes>
      <Secao
        titulo="Contato"
        descricao="Como o visitante fala com a imobiliária. Estes dados aparecem no topo, no rodapé e nos botões do site."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Campo id="dados-telefone" rotulo="Telefone" ajuda={ajudaTelefone}>
            <BrPhoneInput
              id="dados-telefone"
              entrega="mascarado"
              value={telefoneNaMascara}
              placeholder="(11) 3333-4444"
              aria-describedby={descricaoDoCampo('dados-telefone', { ajuda: ajudaTelefone })}
              // A máscara reescreve o valor carregado (ex.: tira o 55): isso não é
              // alteração de quem usa, então só grava quando os números mudam.
              onChange={v => { if (digitos(v) !== digitos(telefoneNaMascara)) setF({ contact_phone: v }); }}
              className={cn(
                'flex w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-sm',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                CLASSE_DO_CAMPO,
              )}
            />
          </Campo>

          <Campo id="dados-whatsapp" rotulo="WhatsApp" ajuda={ajudaZap}>
            <PhoneInput
              id="dados-whatsapp"
              valueFormat="digits"
              value={siteForm.contact_whatsapp ?? ''}
              onChange={v => setF({ contact_whatsapp: v })}
              placeholder="(11) 98765-4321"
              inputClassName={CLASSE_DO_CAMPO}
            />
          </Campo>

          <CampoTexto
            id="dados-email"
            rotulo="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="contato@suaimobiliaria.com.br"
            ajuda="Aparece no topo e no rodapé do site."
            aviso={avisoEmail}
            valor={email}
            aoMudar={v => setF({ contact_email: v })}
          />

          <CampoTextoLongo
            id="dados-endereco"
            rotulo="Endereço"
            rows={2}
            placeholder="Rua, número, bairro, cidade"
            ajuda="Aparece no rodapé do site. Pode usar duas linhas."
            classeDoControle="resize-none"
            valor={siteForm.contact_address ?? ''}
            aoMudar={v => setF({ contact_address: v })}
            className="md:col-span-2"
          />
        </div>
      </Secao>
    </Secoes>
  );
}
