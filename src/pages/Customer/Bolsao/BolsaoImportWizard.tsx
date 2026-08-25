import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, Download, CheckCircle2 } from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import bolsaoService, { BolsaoBatch } from '@/services/bolsao/bolsaoService';

// Os destinos possíveis para uma coluna da planilha. Os rótulos são o nome que a
// coisa tem NA TELA, não no código — quem confere o mapeamento é o gestor.
const TARGETS: { value: string; label: string }[] = [
  { value: 'ignore', label: 'Não importar' },
  { value: 'name', label: 'Nome' },
  { value: 'phone_number', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'city', label: 'Cidade' },
  { value: 'interest', label: 'Interesse / Empreendimento' },
  { value: 'source_label', label: 'Origem' },
  { value: 'notes', label: 'Observações' },
];

type Step = 'upload' | 'map' | 'importing';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export default function BolsaoImportWizard({ open, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batch, setBatch] = useState<BolsaoBatch | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [listName, setListName] = useState('');

  const headers = batch?.headers ?? [];
  const sampleRows = batch?.sample_rows ?? [];

  const phoneMapped = useMemo(() => Object.values(mapping).includes('phone_number'), [mapping]);

  const reset = () => {
    setStep('upload');
    setBatch(null);
    setMapping({});
    setListName('');
    setProgress(0);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (next: boolean) => {
    if (uploading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    try {
      const created = await bolsaoService.upload(file, listName || undefined, setProgress);
      setBatch(created);
      setMapping(created.mapping ?? {});
      setListName(created.name);
      setStep('map');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não consegui ler essa planilha.'));
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!batch) return;
    if (!phoneMapped) {
      toast.error('Escolha qual coluna é o telefone.');
      return;
    }

    setStep('importing');
    try {
      if (listName && listName !== batch.name) {
        await bolsaoService.updateBatch(batch.id, { name: listName });
      }
      await bolsaoService.confirm(batch.id, mapping);
      toast.success('Importação começou. Os leads aparecem no Bolsão em instantes.');
      onImported();
      handleClose(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não consegui importar.'));
      setStep('map');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nova lista no Bolsão</DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? 'Suba a planilha do jeito que ela veio. Eu descubro as colunas e mostro para você conferir.'
              : 'Confira se cada coluna foi para o lugar certo. Nada entra no Bolsão antes de você confirmar.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="bolsao-list-name">Nome da lista (opcional)</Label>
              <Input
                id="bolsao-list-name"
                className="mt-1"
                placeholder="Ex.: Campanha Setembro — Vila Nova"
                value={listName}
                onChange={e => setListName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Em branco, uso o nome do arquivo. É esse nome que o corretor vê no cartão do lead.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed rounded-lg p-10 text-center hover:border-primary/60 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span>Lendo a planilha… {progress}%</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="font-medium text-foreground">Escolher planilha</span>
                  <span className="text-sm text-muted-foreground">.xlsx ou .csv, até 10 MB</span>
                </div>
              )}
            </button>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.csv"
              className="hidden"
              onChange={handleFile}
            />

            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Não precisa formatar nada: pode ter coluna a mais, coluna vazia e cabeçalho escrito de
                qualquer jeito.{' '}
                {/* O .xls antigo (binário, pré-2007) não é lido — avisar aqui evita o
                    gestor descobrir isso só depois de escolher o arquivo. */}
                Se a sua planilha for <strong>.xls</strong> antigo, abra e salve como .xlsx.
              </p>
            </div>

            <a
              href="/downloads/bolsao-modelo.csv"
              download
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" /> Baixar um modelo pronto
            </a>
          </div>
        )}

        {step === 'map' && batch && (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium text-foreground">
                {batch.total_rows} {batch.total_rows === 1 ? 'linha lida' : 'linhas lidas'} de{' '}
                {batch.file_name}
              </p>
            </div>

            {!phoneMapped && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <p>
                  Escolha qual coluna é o <strong>telefone</strong>. Sem ele o corretor não consegue
                  falar com o lead.
                </p>
              </div>
            )}

            {/* Tabela rola sozinha: planilha com 20 colunas não pode esticar o diálogo. */}
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {headers.map((header, i) => (
                      <th key={`${header}-${i}`} className="p-2 text-left align-top min-w-[180px]">
                        <div className="font-medium text-foreground truncate" title={header}>
                          {header}
                        </div>
                        <Select
                          value={mapping[String(i)] ?? 'ignore'}
                          onValueChange={v => setMapping(prev => ({ ...prev, [String(i)]: v }))}
                        >
                          <SelectTrigger className="mt-1 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGETS.map(t => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, r) => (
                    <tr key={r} className="border-t">
                      {headers.map((_, c) => (
                        <td key={c} className="p-2 text-muted-foreground truncate max-w-[220px]">
                          {row[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Estas são as primeiras linhas da sua planilha, já lidas. Se algo estiver na coluna
              errada, corrija acima.
            </p>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Importando…</p>
          </div>
        )}

        <DialogFooter>
          {step === 'map' && (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={!phoneMapped}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Está certo, importar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
