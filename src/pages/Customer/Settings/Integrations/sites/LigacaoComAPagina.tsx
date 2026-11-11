// Coluna da direita da janela (só depois de criada): o endereço, o que a página manda, os últimos envios e o lead de teste.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui/ds';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import Aviso from '@/components/base/Aviso';
import { externalLeadPagesService, type EnvioDaPagina, type PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';
import EnviosDaPagina from './EnviosDaPagina';

export const FRASE_DO_TESTE = 'Vem preenchido com o seu. O teste entra de verdade, no funil e na roleta desta página, mesmo que esse número já tenha corretor. Leva a etiqueta "teste" e fica fora da contagem desta página. Apague o card depois.';

export const mensagemDoErro = (e: unknown, padrao: string): string => {
  const d = (e as { response?: { data?: { message?: unknown; error?: { message?: unknown } | string } } })?.response?.data;
  const doErro = typeof d?.error === 'object' && d.error ? d.error.message : typeof d?.error === 'string' ? d.error : undefined;
  const m = typeof doErro === 'string' && doErro ? doErro : typeof d?.message === 'string' ? d.message : '';
  return m || padrao;
};

export default function LigacaoComAPagina({ pagina, telefoneInicial }: { pagina: PaginaDeSite; telefoneInicial: string }) {
  const [endereco, setEndereco] = useState(pagina.endpoint_url);
  const [confirmando, setConfirmando] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [envios, setEnvios] = useState<EnvioDaPagina[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [telefone, setTelefone] = useState(telefoneInicial);
  const [mandando, setMandando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erroDoTeste, setErroDoTeste] = useState<string | null>(null);
  const textoDoEndereco = useRef<HTMLElement>(null);

  useEffect(() => { setTelefone((t) => t || telefoneInicial); }, [telefoneInicial]);

  const carregar = useCallback(async () => {
    try { setEnvios(await externalLeadPagesService.envios(pagina.id)); setFalhou(false); } catch { setFalhou(true); }
  }, [pagina.id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(endereco);
      toast.success('Endereço copiado.');
    } catch {
      const el = textoDoEndereco.current;
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }
      toast.error('Não deu pra copiar sozinho. O endereço está selecionado: copie com Ctrl+C.');
    }
  };

  const trocar = async () => {
    setTrocando(true);
    try {
      const r = await externalLeadPagesService.trocarEndereco(pagina.id);
      setEndereco(r.endpoint_url);
      setConfirmando(false);
      toast.success('Endereço novo gerado. Cole na página.');
    } catch (e) {
      toast.error(mensagemDoErro(e, 'Não deu pra trocar o endereço. Tente de novo.'));
    } finally { setTrocando(false); }
  };

  const mandarTeste = async () => {
    setMandando(true); setErroDoTeste(null);
    try {
      const r = await externalLeadPagesService.mandarTeste(pagina.id, telefone.trim());
      setResultado(r.summary);
      await carregar();
    } catch (e) {
      setErroDoTeste(mensagemDoErro(e, 'Não deu pra mandar o teste agora. Tente de novo em instantes.'));
    } finally { setMandando(false); }
  };

  return (
    <>
      <GrupoDaJanela titulo="Endereço pra colar na página">
        <p className="break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs"><code ref={textoDoEndereco}>{endereco}</code></p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void copiar()}>Copiar</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(true)} disabled={confirmando}>Trocar endereço</Button>
        </div>
        {confirmando && (
          <Aviso tom="atencao" compacto acao={
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => void trocar()} disabled={trocando}>{trocando ? 'Trocando...' : 'Trocar agora'}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmando(false)} disabled={trocando}>Voltar</Button>
            </div>
          }>O endereço antigo para de funcionar agora. Cole o novo na página.</Aviso>
        )}
      </GrupoDaJanela>

      <GrupoDaJanela titulo="O que a página precisa mandar">
        <ul className="grid gap-1 text-sm">
          <li><strong>Nome</strong> (<code>nome</code> ou <code>name</code>)</li>
          <li><strong>WhatsApp</strong> (<code>whatsapp</code>, <code>telefone</code> ou <code>phone</code>), com DDD</li>
          <li><strong>E-mail</strong> (<code>email</code>), opcional</li>
        </ul>
        <p className="text-xs text-muted-foreground">Qualquer outro campo vira resposta no card do lead. Aceita formulário comum ou JSON, vindo direto do navegador do visitante.</p>
      </GrupoDaJanela>

      <GrupoDaJanela titulo="Últimos envios">
        <EnviosDaPagina itens={envios} falhou={falhou} resultadoDoTeste={resultado} />
      </GrupoDaJanela>

      <GrupoDaJanela titulo="Mandar lead de teste">
        <CampoDaJanela rotulo="WhatsApp que vai receber o teste" htmlFor="telefone_do_teste" ajuda={FRASE_DO_TESTE}>
          <Input id="telefone_do_teste" value={telefone} inputMode="tel" onChange={(e) => setTelefone(e.target.value)} />
        </CampoDaJanela>
        {erroDoTeste && <p role="alert" className="text-xs text-destructive">{erroDoTeste}</p>}
        <div><Button type="button" variant="outline" onClick={() => void mandarTeste()} disabled={mandando || !telefone.trim()}>{mandando ? 'Mandando...' : 'Mandar lead de teste'}</Button></div>
      </GrupoDaJanela>
    </>
  );
}
