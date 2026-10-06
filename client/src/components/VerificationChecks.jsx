import { CheckCircle2, XCircle } from 'lucide-react';
import { StatusPill } from './ui';
import DocumentViewer from './DocumentViewer';

const METHOD = { 'pdf-text': 'PDF text', 'pdf-ocr': 'Scanned PDF (OCR)', 'image-ocr': 'Image (OCR)' };

export const adminFileUrl = (id) => `/api/admin/documents/${id}/file`;

// Administrator review panel: the uploaded document (served only through the
// admin endpoint) beside its automated pre-check. The flag is a review aid;
// the administrator decides.
export default function VerificationChecks({ document, title }) {
  if (!document) return <p className="text-sm text-muted">No document uploaded.</p>;
  const pending = !document.flag && document.status === 'processing';
  return (
    <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
      <DocumentViewer src={adminFileUrl(document.id)} mimeType={document.mimeType} name={document.originalName} />
      <div className="h-fit rounded-md border border-line">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-subtle px-3 py-2">
          <span className="text-sm font-medium">{title}</span>
          <StatusPill status={pending ? 'processing' : document.flag} />
        </div>
        {pending ? (
          <p className="p-3 text-sm text-muted">The automated check is still running.</p>
        ) : (
          <div className="space-y-2 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Automated checks</p>
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
              Read via {METHOD[document.method] || 'n/a'}
              {document.ocrConfidence != null && ` · OCR confidence ${document.ocrConfidence}%`}. Compare the checks with the document
              before deciding — automated checks never approve on their own.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
