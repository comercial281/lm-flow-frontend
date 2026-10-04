import { REDES, linkDaRede, type RedeSocial } from '@/features/siteBuilder/socialLinks';
import { Secao, Secoes } from '../ui/Secao';
import { CampoTexto } from '../ui/Campo';
import type { FormProps } from './tipos';

export default function TelaRedes({ siteForm, setF }: FormProps) {
  const links = siteForm.social_links ?? {};

  // Enquanto digita, o valor cru já vai pro formulário (a barra de Salvar
  // aparece na hora); ao sair do campo, vira link.
  const digitar = (rede: RedeSocial, valor: string) => setF({ social_links: { ...links, [rede]: valor } });

  const confirmar = (rede: RedeSocial, valor: string) => {
    const link = linkDaRede(rede, valor) ?? undefined;
    if (links[rede] === link) return;
    const proximo = { ...links };
    if (link) proximo[rede] = link; else delete proximo[rede];
    setF({ social_links: proximo });
  };

  return (
    <Secoes>
      <Secao
        titulo="Links das redes"
        descricao="Os ícones das redes aparecem no topo e no rodapé do site. Pode colar o link inteiro ou só o nome do perfil; rede em branco não aparece."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {REDES.map(r => (
            <CampoTexto key={r.id} id={`rede-${r.id}`} rotulo={r.rotulo} ajuda={`Ex.: ${r.exemplo}`} valor={links[r.id] ?? ''}
              aoMudar={v => digitar(r.id, v)}
              onBlur={e => confirmar(r.id, e.target.value)} />
          ))}
        </div>
      </Secao>
    </Secoes>
  );
}
