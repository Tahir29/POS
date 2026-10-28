import { FileText, X } from 'lucide-react';

export default function TicketFileThumb({ file, onRemove }) {
  const isPdf = file.type === 'application/pdf';
  return (
    <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="block size-full" title={file.file_name}>
        {isPdf ? (
          <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground">
            <FileText size={24} aria-hidden="true" />
            <span className="w-full truncate text-center text-[10px]">{file.file_name}</span>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own file route, not a configured remote host
          <img src={file.url} alt={file.file_name} className="size-full object-cover" loading="lazy" />
        )}
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.file_name}`}
          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
