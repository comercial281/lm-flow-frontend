// PropertyBookDialog — visualiza e baixa o book (PDF) salvo no imóvel.
// Read-only: o book é gravado automaticamente na importação via book (backend).
// Os campos vêm no próprio objeto Property (book_url/book_file_name), sem novo fetch.
// Compartilhado entre o card de imóveis (Properties) e a aba dedicada "Books".
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { FileText, Download, ExternalLink } from 'lucide-react';
import type { Property } from '@/services/properties/propertiesService';

export default function PropertyBookDialog({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const url = property.book_url ?? null;
  const fileName = property.book_file_name || `book-${property.code}.pdf`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Book — {property.title}
          </DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>

        {url ? (
          <iframe
            src={url}
            title="Book do imóvel"
            className="w-full h-[70vh] rounded-md border border-border bg-muted/20"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <FileText className="h-10 w-10" />
            <p className="text-sm text-center">Este imóvel não tem book salvo.</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {url && (
            <>
              <Button
                variant="outline"
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Abrir em nova aba
              </Button>
              <a href={url} download={fileName} target="_blank" rel="noopener noreferrer">
                <Button>
                  <Download className="h-4 w-4 mr-1.5" />
                  Baixar
                </Button>
              </a>
            </>
          )}
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
