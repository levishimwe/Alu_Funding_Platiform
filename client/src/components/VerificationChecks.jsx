import { useEffect, useState } from 'react';
import { CheckCircle2, MinusCircle, RefreshCw, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { StatusPill } from './ui';
import DocumentViewer from './DocumentViewer';

const METHOD = {
  'pdf-text+ocr': 'PDF text layer + OCR',
  'pdf-text': 'PDF text',
  'pdf-ocr': 'Scanned PDF (OCR)',
  'image-ocr': 'Image (OCR)',
};

export const adminFileUrl = (id) => `/api/admin/documents/${id}/file`;

function CheckIcon({ check }) {
  if (check.neutral) return <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-label="Note" />;
  if (check.passed) return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Passed" />;
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Needs attention" />;
}

// Administrator review panel: the uploaded document (served only through the
// admin endpoint) beside its automated pre-check. The flag is a review aid;
// the administrator decides.
export default function VerificationChecks({ document: initial, title }) {
  const [document, setDocument] = useState(initial);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setDocument(initial), [initial]);

  if (!document) return <p className="text-sm text-muted">No document uploaded.</p>;
  const pending = !document.flag && document.status === 'processing';

  const rerun = async () => {
    setRerunning(true);
    setError('');
    try {
      const res = await api.post(`/admin/documents/${document.id}/reverify`);
      setDocument((d) => ({ ...d, ...res.document }));
    } catch (e) {
      setError(e.message);
    } finally {
      setRerunning(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
      <DocumentViewer src={adminFileUrl(document.id)} mimeType={document.mimeType} name={document.originalName} />
      <div className="h-fit rounded-md border border-line">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-subtle px-3 py-2">
          <span className="text-sm font-medium">{title}</span>
          <StatusPill status={pending || rerunning ? 'processing' : document.flag} />
        </div>
        {pending ? (
          <p className="p-3 text-sm text-muted">The automated check is still running.</p>
        ) : (
          <div className="space-y-2 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Automated checks</p>
            <ul className="space-y-1.5">
              {document.checks.map((c) => (
                <li key={c.id} className="flex gap-2 text-sm">
                  <CheckIcon check={c} />
                  <span className="min-w-0 break-words">
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
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={rerun} disabled={rerunning}>
              <RefreshCw className={`h-4 w-4 ${rerunning ? 'animate-spin' : ''}`} aria-hidden="true" />
              {rerunning ? 'Re-running checks…' : 'Re-run checks'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
