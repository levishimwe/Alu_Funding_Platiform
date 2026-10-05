import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Copy, ExternalLink, FileText, Pencil, TriangleAlert, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert, Field, PageHeader, PageLoader, Pill, StatusPill, formatDate } from '../../components/ui';

const KIND_LABEL = {
  rdb_certificate: 'RDB certificate',
  revenue_document: 'Revenue document',
  rra_certificate: 'RRA certificate',
  supporting_document: 'Supporting document',
};

const STATUS_HELP = {
  pending_review: 'An administrator is reviewing your submission and evidence.',
  revision_required: 'An administrator asked for changes. Revise the project and resubmit.',
  similarity_flagged: 'Your project is similar to an approved project. Explain the distinction below — it stays unavailable for approval until an administrator reviews it.',
  approved: 'Approved and visible to investors. Editing sends it back for review.',
  funded: 'Marked as funded. It no longer appears in active investor discovery.',
  investor_limit_reached: 'Two investors have confirmed investment, so the project has left active discovery.',
  rejected: 'This submission was not approved.',
  archived: 'This project is archived.',
};

function ClarificationForm({ project, onSaved }) {
  const [text, setText] = useState(project.clarificationText || '');
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState('supporting_document');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      data.append('clarification', text);
      data.append('documentKind', kind);
      if (file) data.append('supportingDocument', file);
      const res = await api.upload(`/projects/${project.id}/clarification`, data);
      onSaved(res.project);
    } catch (err) {
      setError(err.fields?.clarification || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <Field label="What makes your venture distinct?" htmlFor="clarification" help="For example: different market, model, location, customers, stage or team.">
        <textarea id="clarification" rows={5} className="input" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Document type" htmlFor="docKind">
          <select id="docKind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="supporting_document">Supporting document</option>
            <option value="rra_certificate">RRA registration certificate</option>
          </select>
        </Field>
        <Field label="Supporting document (optional)" htmlFor="clarDoc" help="PDF, PNG or JPEG. Private to administrators.">
          <input id="clarDoc" type="file" accept=".pdf,.png,.jpg,.jpeg" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>
      </div>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Sending…' : project.clarificationSubmittedAt ? 'Update clarification' : 'Send clarification'}
      </button>
    </form>
  );
}

function UploadEvidence({ project, onSaved }) {
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState('supporting_document');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      data.append('kind', kind);
      data.append('document', file);
      const res = await api.upload(`/projects/${project.id}/documents`, data);
      onSaved(res.project);
      setFile(null);
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-2 border-t border-line pt-4">
      <p className="text-sm font-medium">Add a document requested by an administrator</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className="input sm:w-56" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Document type">
          <option value="supporting_document">Supporting document</option>
          <option value="rra_certificate">RRA certificate</option>
          <option value="revenue_document">Revenue document</option>
        </select>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="input" aria-label="Document file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button type="submit" className="btn-secondary" disabled={!file || busy}>
          <Upload className="h-4 w-4" aria-hidden="true" /> Upload
        </button>
      </div>
    </form>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get(`/projects/${id}`)
      .then((d) => {
        setProject(d.project);
        document.title = `${d.project.title} · ALU Ventures`;
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!project) return <PageLoader />;

  const editable = ['pending_review', 'revision_required', 'approved'].includes(project.status);
  const isPublic = ['approved', 'funded', 'investor_limit_reached'].includes(project.status) && project.publicationConsent;
  const copy = async () => {
    await navigator.clipboard?.writeText(project.projectCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2 font-mono normal-case tracking-normal">
            {project.projectCode}
            <button type="button" onClick={copy} className="text-muted hover:text-ink" aria-label="Copy project code">
              <Copy className="h-3.5 w-3.5" />
            </button>
            {copied && <span className="text-green-600">Copied</span>}
          </span>
        }
        title={project.title}
        description={project.summary}
        actions={
          <>
            {isPublic && (
              <Link to={`/verify?code=${project.projectCode}`} className="btn-secondary">
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Public profile
              </Link>
            )}
            {editable && (
              <Link to={`/app/projects/${project.id}/edit`} className="btn-primary">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Revise
              </Link>
            )}
          </>
        }
      />

      {location.state?.created && (
        <Alert type="success" className="mb-4" title="Project submitted">
          Your verification code is <strong className="font-mono">{project.projectCode}</strong>. It stays the same through
          revisions. We emailed you a copy.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={project.status} />
              <StatusPill status={project.type} />
            </div>
            <p className="mt-2 text-sm text-muted">{STATUS_HELP[project.status]}</p>
            {project.reviewNote && ['revision_required', 'rejected'].includes(project.status) && (
              <Alert type={project.status === 'rejected' ? 'error' : 'info'} className="mt-3" title="Administrator note">
                {project.reviewNote}
              </Alert>
            )}
          </div>

          {project.status === 'similarity_flagged' && (
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <TriangleAlert className="h-4 w-4 text-purple-600" aria-hidden="true" /> Project Clarification Request
              </h2>
              <p className="mt-1 text-sm text-muted">
                Your project scored above the similarity threshold against these approved projects. This is a review
                signal, not a finding of copying or fraud.
              </p>
              <ul className="my-4 space-y-1.5">
                {project.similarityMatches.map((m) => (
                  <li key={m.projectCode} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.title}</span>
                      <span className="font-mono text-xs text-muted">{m.projectCode}</span>
                    </span>
                    <Pill tone="purple">{Math.round(m.score * 100)}% similar</Pill>
                  </li>
                ))}
              </ul>
              {project.clarificationSubmittedAt && (
                <Alert type="success" className="mb-4">
                  Clarification sent on {formatDate(project.clarificationSubmittedAt, true)}. An administrator will review it.
                </Alert>
              )}
              <ClarificationForm project={project} onSaved={setProject} />
            </div>
          )}

          <div className="card p-5">
            <h2 className="font-semibold">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{project.description}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ['Sector', project.sector + (project.suggestedSector && project.suggestedSector !== project.sector ? ` (suggested: ${project.suggestedSector})` : '')],
                ['Stage', project.stage],
                ['Funding sought', project.fundingSought || '—'],
                ...(project.type === 'company'
                  ? [
                      ['Company', project.companyName],
                      ['RDB code', project.companyNumber],
                      ['Your role', project.relationshipToCompany],
                    ]
                  : []),
                ['Public listing', project.publicationConsent ? 'Consented' : 'Not published'],
                ['Submitted', formatDate(project.submittedAt, true)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold">Private documents</h2>
            {project.documents.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No documents uploaded.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {project.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="min-w-0 truncate text-accent hover:underline">
                      {d.originalName}
                    </a>
                    <span className="ml-auto shrink-0 text-xs text-muted">{KIND_LABEL[d.kind]}</span>
                  </li>
                ))}
              </ul>
            )}
            {!['rejected', 'archived'].includes(project.status) && <UploadEvidence project={project} onSaved={setProject} />}
          </div>
        </div>
      </div>
    </>
  );
}
