import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';
import {
  HOME_FABRICA, LIMITES_SECOES, TITULO_PASSOS_FABRICA, type Atendimento, type HomeConfig, type Passo,
} from '@/features/siteBuilder/public/homeConfig';
import { Secao, Secoes } from '../ui/Secao';
import { CLASSE_DO_CAMPO, CampoTexto, CampoTextoLongo } from '../ui/Campo';
import EnvioDeImagem from '../ui/EnvioDeImagem';
import type { FormProps } from './tipos';

const LINK_VALIDO = /^https?:\/\/\S+$/i;
const ERRO_LINK = 'Use um endereço que comece com https://';
const PASSO_NOVO: Passo = { title: '', text: '' };

// Texto em branco volta a null: o servidor guarda "sem texto" e a seção usa o que sobrou.
const texto = (v: string) => (v.trim() === '' ? null : v);

// Passos (até 4) e Atendimento: duas seções opcionais da página inicial, desligadas de fábrica.
export default function TelaSecoes({ siteForm, setF }: FormProps) {
  const home: HomeConfig = siteForm.home ?? HOME_FABRICA;
  const passos = home.steps;
  const a = home.about;
  // Sempre o objeto `home` inteiro: o servidor troca cada bloco recebido por completo.
  const mudarPassos = (parte: Partial<HomeConfig['steps']>) => setF({ home: { ...home, steps: { ...passos, ...parte } } });
  const mudarAtendimento = (parte: Partial<Atendimento>) => setF({ home: { ...home, about: { ...a, ...parte } } });
  const mudarPasso = (i: number, parte: Partial<Passo>) =>
    mudarPassos({ items: passos.items.map((p, k) => (k === i ? { ...p, ...parte } : p)) });

  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const removerPasso = async (i: number) => {
    const ok = await confirmar({
      titulo: 'Remover passo',
      descricao: `O passo "${passos.items[i].title.trim() || `Passo ${i + 1}`}" sai da página inicial quando você salvar.`,
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    });
    if (ok) mudarPassos({ items: passos.items.filter((_, k) => k !== i) });
  };

  // "Um link" sem endereço ainda não existe no `home` (button_link null): a escolha mora aqui.
  const [escolheuLink, setEscolheuLink] = useState(!!a.button_link && a.button_link !== '#contato');
  const destino = a.button_link === '#contato' ? '#contato' : a.button_link || escolheuLink ? 'url' : '';

  const enviarFoto = async (arquivo: File) => {
    const { url } = await siteBuilderService.uploadAsset(arquivo);
    mudarAtendimento({ photo_url: url });
  };

  return (
    <Secoes>
      <Secao
        titulo="Como funciona"
        descricao="O passo a passo de como comprar, numerado, logo abaixo das vitrines da página inicial. Aparece quando está ligado e tem pelo menos 1 passo com título."
      >
        <div className="flex items-center gap-3">
          <Checkbox id="passos-ativo" checked={passos.enabled} onCheckedChange={v => mudarPassos({ enabled: v === true })} />
          <UILabel htmlFor="passos-ativo" className="cursor-pointer text-base font-normal">Mostrar Como funciona</UILabel>
        </div>
        {(
          <>
            <CampoTexto id="passos-titulo" rotulo="Título da seção" maxLength={LIMITES_SECOES.tituloSecao} valor={passos.title}
              placeholder={TITULO_PASSOS_FABRICA} aoMudar={v => mudarPassos({ title: v })} />
            {passos.items.map((p, i) => (
              <fieldset key={i} className="space-y-4 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-medium">Passo {i + 1}</legend>
                <CampoTexto id={`passo-${i}-titulo`} rotulo={`Título do passo ${i + 1}`} maxLength={LIMITES_SECOES.tituloPasso}
                  valor={p.title} aoMudar={v => mudarPasso(i, { title: v })}
                  aviso={p.title.trim() === '' ? 'Sem título, o passo não é salvo.' : undefined} />
                <CampoTexto id={`passo-${i}-texto`} rotulo={`Texto do passo ${i + 1}`} maxLength={LIMITES_SECOES.textoPasso}
                  valor={p.text} aoMudar={v => mudarPasso(i, { text: v })} />
                <Button type="button" variant="ghost" size="sm" aria-label={`Remover passo ${i + 1}`} onClick={() => removerPasso(i)}>
                  <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Remover
                </Button>
              </fieldset>
            ))}
            {passos.items.length < LIMITES_SECOES.passos && (
              <Button type="button" variant="outline" onClick={() => mudarPassos({ items: [...passos.items, { ...PASSO_NOVO }] })}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Novo passo
              </Button>
            )}
          </>
        )}
      </Secao>

      <Secao
        titulo="Atendimento"
        descricao="Quem atende o cliente: foto, texto e um botão, entre as chamadas e os mais buscados. Aparece quando está ligado e tem título ou texto. Sem foto, só o texto, centralizado."
      >
        <div className="flex items-center gap-3">
          <Checkbox id="atendimento-ativo" checked={a.enabled} onCheckedChange={v => mudarAtendimento({ enabled: v === true })} />
          <UILabel htmlFor="atendimento-ativo" className="cursor-pointer text-base font-normal">Mostrar Atendimento</UILabel>
        </div>
        {(
          <>
            <EnvioDeImagem
              rotulo="Foto do atendimento"
              url={a.photo_url}
              enviar={enviarFoto}
              aoRemover={() => mudarAtendimento({ photo_url: null })}
              confirmacao={{ titulo: 'Remover a foto', descricao: 'A seção passa a mostrar só o texto quando você salvar.' }}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoTexto id="atendimento-selo" rotulo="Selo (texto pequeno em cima)" maxLength={LIMITES_SECOES.selo}
                valor={a.eyebrow ?? ''} aoMudar={v => mudarAtendimento({ eyebrow: texto(v) })} />
              <CampoTexto id="atendimento-titulo" rotulo="Título do Atendimento" maxLength={LIMITES_SECOES.tituloAtendimento}
                valor={a.title ?? ''} aoMudar={v => mudarAtendimento({ title: texto(v) })} />
              <CampoTextoLongo id="atendimento-texto" rotulo="Texto do Atendimento" maxLength={LIMITES_SECOES.textoAtendimento} rows={4}
                valor={a.text ?? ''} aoMudar={v => mudarAtendimento({ text: texto(v) })} className="sm:col-span-2" />
              <CampoTexto id="atendimento-botao" rotulo="Texto do botão" maxLength={LIMITES_SECOES.botao}
                valor={a.button_label ?? ''} aoMudar={v => mudarAtendimento({ button_label: texto(v) })} />
              <div className="space-y-2">
                <UILabel htmlFor="atendimento-destino" className="text-sm font-medium">Para onde o botão leva</UILabel>
                <Seletor id="atendimento-destino" className={`w-full ${CLASSE_DO_CAMPO}`} value={destino}
                  onChange={e => {
                    const v = e.target.value;
                    setEscolheuLink(v === 'url');
                    mudarAtendimento({ button_link: v === '#contato' ? '#contato' : null });
                  }}>
                  <option value="">Escolha</option>
                  <option value="#contato">Formulário de contato do site</option>
                  <option value="url">Um link</option>
                </Seletor>
              </div>
              {destino === 'url' && (
                <CampoLink id="atendimento-link" valor={a.button_link} mudar={v => mudarAtendimento({ button_link: v })} />
              )}
            </div>
            {a.button_label?.trim() && !a.button_link && (
              <p className="text-sm text-amber-600">Sem um destino, o botão não aparece.</p>
            )}
          </>
        )}
      </Secao>
      {dialogoDeConfirmacao}
    </Secoes>
  );
}

// Enquanto a pessoa digita "https://" não é erro; endereço que não começa assim é
// avisado na hora e não é gravado (o servidor descartaria em silêncio).
function CampoLink({ id, valor, mudar }: { id: string; valor: string | null; mudar: (v: string | null) => void }) {
  const [digitado, setDigitado] = useState(valor ?? '');
  const [saiu, setSaiu] = useState(false);
  const limpo = digitado.trim();
  const comecando = ['http://', 'https://'].some(p => p.startsWith(limpo.toLowerCase()));
  const erro = limpo !== '' && !LINK_VALIDO.test(limpo) && (saiu || !comecando);

  return (
    <div className="space-y-2">
      <UILabel htmlFor={id} className="text-sm font-medium">Endereço do botão</UILabel>
      <Input id={id} className={CLASSE_DO_CAMPO} inputMode="url" value={digitado} placeholder="https://"
        aria-invalid={erro} aria-describedby={erro ? `${id}-erro` : undefined}
        onBlur={() => setSaiu(true)}
        onChange={e => {
          const v = e.target.value;
          setDigitado(v);
          const novo = LINK_VALIDO.test(v.trim()) ? v.trim() : null;
          if (novo !== valor) mudar(novo);
        }} />
      {erro && <p id={`${id}-erro`} className="text-sm text-destructive">{ERRO_LINK}</p>}
    </div>
  );
}
