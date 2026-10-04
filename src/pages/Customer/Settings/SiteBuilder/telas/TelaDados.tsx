import { useRef, useState } from 'react';
import { BrPhoneInput } from '@/components/shared/BrPhoneInput';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { cn } from '@/lib/utils';
import { Secao, Secoes } from '../ui/Secao';
import { CLASSE_DO_CAMPO, Campo, CampoTexto, CampoTextoLongo, descricaoDoCampo } from '../ui/Campo';
import type { FormProps } from './tipos';

// Formatos gravados (não mudam com a máscara — o site público lê estes valores):
// - WhatsApp: só dígitos com o 55 ("5511987654321"). O site monta o link do
//   botão verde com os dígitos (wa.me/5511…). Número antigo gravado SEM o 55
//   aparece no campo como Brasil, mas NÃO é corrigido sozinho (o campo só grava
//   quando a pessoa digita): a tela avisa e a pessoa confere e salva.
// - Telefone: o texto como aparece no site, "(11) 3333-4444". O rodapé mostra o
//   telefone exatamente como gravado; o "ligar" usa só os dígitos. Telefone
//   gravado que não cabe na máscara (dois números, ramal, 0800) vira campo de
//   texto livre: passar pela máscara cortaria o número.
//
// Regra dos dois campos: abrir a tela nunca grava. Máscara e campo de telefone
// reescrevem o valor carregado e podem avisar uma "mudança" sem ninguém digitar;
// por isso só vale o que chega com o foco dentro do campo.

const PARECE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digitos = (v: string) => v.replace(/\D/g, '');

// Dígitos do telefone sem o 55 da frente ("+55 11 3333-4444" → "1133334444").
function semPais(valor: string): string {
  const d = digitos(valor);
  return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d;
}

/** O telefone gravado cabe na máscara (DDD + 8 ou 9 dígitos, sem letra nem barra)? Vazio cabe. */
export function cabeNaMascara(valor: string): boolean {
  if (valor.trim() === '') return true;
  if (/[^\d\s()+\-.]/.test(valor)) return false;
  const d = semPais(valor);
  return (d.length === 10 || d.length === 11) && d[0] !== '0';
}

/** WhatsApp gravado só com DDD e número, sem o código do país. */
export function faltaCodigoDoPais(valor: string): boolean {
  const d = digitos(valor);
  return d.length === 10 || d.length === 11;
}

const focoDentro = (el: HTMLElement | null) => !!el && !!document.activeElement && el.contains(document.activeElement);

export default function TelaDados({ siteForm, setF }: FormProps) {
  const telefone = siteForm.contact_phone ?? '';
  const whatsapp = siteForm.contact_whatsapp ?? '';
  const email = siteForm.contact_email ?? '';

  const caixaTelefone = useRef<HTMLDivElement>(null);
  const caixaZap = useRef<HTMLDivElement>(null);

  // Telefone fora da máscara vira texto livre. Decide pelo valor CARREGADO e
  // não muda enquanto a pessoa digita (o campo trocaria debaixo do cursor);
  // valor trocado por fora (Descartar, recarga) decide de novo.
  const digitado = useRef<string | null>(null);
  const [livre, setLivre] = useState(() => !cabeNaMascara(telefone));
  const [anterior, setAnterior] = useState(telefone);
  if (telefone !== anterior) {
    setAnterior(telefone);
    if (telefone !== digitado.current) setLivre(!cabeNaMascara(telefone));
  }
  const gravarTelefone = (v: string) => { digitado.current = v; setF({ contact_phone: v }); };

  const avisoEmail = email.trim() !== '' && !PARECE_EMAIL.test(email.trim())
    ? 'Isso não parece um e-mail. Confira se tem o @ e o final (.com, .com.br).'
    : undefined;
  const avisoZap = faltaCodigoDoPais(whatsapp)
    ? 'Falta o código do país (55): o botão do WhatsApp do site pode não funcionar. Digite o número de novo com o 55 na frente e salve.'
    : undefined;

  const ajudaTelefone = 'Aparece no rodapé de todas as páginas e, no computador, na faixa de cima das páginas internas. No celular, quem toca no número já liga.';
  const ajudaZap = 'Para onde vai o botão verde do WhatsApp, no topo, no rodapé e na página de cada imóvel.';

  return (
    <Secoes>
      <Secao
        titulo="Contato"
        descricao="Como o visitante fala com a imobiliária. Estes dados aparecem no rodapé, nos botões do site e, no computador, na faixa de cima das páginas internas."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {livre ? (
            <CampoTexto
              id="dados-telefone"
              rotulo="Telefone"
              ajuda={ajudaTelefone}
              aviso="Esse telefone tem mais de um número ou ramal. Ele aparece no site do jeito que está escrito."
              valor={telefone}
              aoMudar={gravarTelefone}
            />
          ) : (
            <Campo id="dados-telefone" rotulo="Telefone" ajuda={ajudaTelefone}>
              <div ref={caixaTelefone}>
                <BrPhoneInput
                  id="dados-telefone"
                  entrega="mascarado"
                  value={digitos(telefone).length === semPais(telefone).length ? telefone : semPais(telefone)}
                  placeholder="(11) 3333-4444"
                  aria-describedby={descricaoDoCampo('dados-telefone', { ajuda: ajudaTelefone })}
                  onChange={v => {
                    if (!focoDentro(caixaTelefone.current)) return;
                    if (digitos(v) !== semPais(telefone)) gravarTelefone(v);
                  }}
                  className={cn(
                    'flex w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-sm',
                    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    CLASSE_DO_CAMPO,
                  )}
                />
              </div>
            </Campo>
          )}

          <Campo id="dados-whatsapp" rotulo="WhatsApp" ajuda={ajudaZap} aviso={avisoZap}>
            <div ref={caixaZap}>
              <PhoneInput
                id="dados-whatsapp"
                valueFormat="digits"
                value={whatsapp}
                onChange={v => { if (focoDentro(caixaZap.current)) setF({ contact_whatsapp: v }); }}
                placeholder="(11) 98765-4321"
                inputClassName={CLASSE_DO_CAMPO}
                describedBy={descricaoDoCampo('dados-whatsapp', { ajuda: ajudaZap, aviso: avisoZap })}
              />
            </div>
          </Campo>

          <CampoTexto
            id="dados-email"
            rotulo="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="contato@suaimobiliaria.com.br"
            ajuda="Aparece no rodapé de todas as páginas e, no computador, na faixa de cima das páginas internas."
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
