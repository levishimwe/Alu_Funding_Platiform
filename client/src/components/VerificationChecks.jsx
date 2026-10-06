import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { StatusPill } from './ui';

const METHOD = { 'pdf-text': 'PDF text', 'pdf-ocr': 'Scanned PDF (OCR)', 'image-ocr': 'Image (OCR)' };

// Shows an automated document pre-check to an administrator. The flag is a
// review aid only; the administrator decides.
export default function VerificationChecks({ document, title }) {
  if (!document) return <p className="text-sm text-muted">No document uploaded.</p>;
  const pending = !document.flag && document.status === 'processing';
  return (
    <div className="rounded-md border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <StatusPill status={pending ? 'processing' : document.flag} />
        </div>
        <a href={`/api/documents/${document.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          View document <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
      {pending ? (
        <p className="p-3 text-sm text-muted">The automated check is still running.</p>
      ) : (
        <div className="space-y-2 p-3">
          <ul className="space-y-1.5">
            {document.checks.map((c) => (
              <li key={c.id} className="flex gap-2 text-sm">
                {c.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Passed" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Needs attention" />
                )}
                <span>
                  {c.label}
                  {c.detail && <span className="block text-xs text-muted">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line pt-2 text-xs text-muted">
            {document.originalName} · read via {METHOD[document.method] || 'n/a'}
            {document.ocrConfidence != null && ` · OCR confidence ${document.ocrConfidence}%`}. Automated checks support review; they never approve on their own.
          </p>
        </div>
      )}
    </div>
  );
}
