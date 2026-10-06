import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Inbox, Search, TriangleAlert, Users } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { Alert, EmptyState, PageHeader, PageLoader, Pill, StatusPill, formatDate } from '../../components/ui';
import ReasonDialog from '../../components/ReasonDialog';
import { availableActions } from '../../lib/projectActions';

// Proposal status list plus Similarity Flagged.
const TABS = [
  ['pending_review', 'Pending Review'],
  ['similarity_flagged', 'Similarity Flagged'],
  ['revision_required', 'Revision Required'],
  ['approved', 'Approved and Seeking Investment'],
  ['funded', 'Fully Funded'],
  ['investor_limit_reached', 'Investor Limit Reached'],
  ['rejected', 'Rejected'],
  ['archived', 'Archived'],
];

export default function ProjectQueue() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'pending_review';
  const [search, setSearch] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => {
    setData(null);
    api
      .get(`/admin/projects${qs({ status, q: params.get('q') })}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [status, params]);

  useEffect(() => {
    document.title = 'Project verification queue · ALU Ventures';
    load();
  }, [load]);

  const setTab = (s) => setParams({ status: s, ...(params.get('q') ? { q: params.get('q') } : {}) });

  return (
    <>
      <PageHeader
        title="Project Verification Queue"
        description="Review RDB pre-checks, similarity flags and evidence. Every decision is recorded with your name, the time and your reason."
      />
      {notice && <Alert type="success" className="mb-4">{notice}</Alert>}
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <div className="mb-3 overflow-x-auto border-b border-line">
        <div className="flex min-w-max gap-1" role="tablist">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={status === key}
              onClick={() => setTab(key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${status === key ? 'border-accent font-medium' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {label}
              {data?.counts && <span className="rounded-full bg-subtle px-1.5 text-xs tabular-nums text-muted ring-1 ring-line">{data.counts[key] ?? 0}</span>}
            </button>
          ))}
        </div>
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ status, ...(search ? { q: search } : {}) });
        }}
      >
        <input className="input max-w-sm" placeholder="Search title, code or company…" aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-secondary">
          <Search className="h-4 w-4" aria-hidden="true" /> Search
        </button>
      </form>

      {status === 'similarity_flagged' && data?.projects.length > 0 && (
        <Alert type="warning" className="mb-4" title="Similarity flags are review signals, not findings">
          Approve or clear a flag only after reading the graduate’s clarification. Otherwise request a revision or reject.
        </Alert>
      )}

      {!data ? (
        <PageLoader />
      ) : data.projects.length === 0 ? (
        <div className="card">
          <EmptyState icon={Inbox} title="No projects in this queue" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Project code</th>
                <th className="px-4 py-2 font-medium">RDB check</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Submitted</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.projects.map((p) => (
                <tr key={p.id} className={p.rdbFlag === 'suspicious' ? 'bg-red-50/60 dark:bg-red-500/5' : 'hover:bg-subtle'}>
                  <td className="px-4 py-3">
                    <Link to={`/app/admin/projects/${p.id}`} className="font-medium text-accent hover:underline">
                      {p.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted">
                      {p.owner?.name} · {p.sector} · <StatusPill status={p.type} />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.projectCode}</td>
                  <td className="px-4 py-3">
                    {p.rdbFlag ? <StatusPill status={p.rdbFlag} /> : <span className="text-xs text-muted">Idea — no RDB</span>}
                    {p.similarityStatus !== 'none' && (
                      <div className="mt-1">
                        <Pill tone="purple">
                          <TriangleAlert className="h-3 w-3" aria-hidden="true" /> {p.similarityStatus} {p.similarityScore ? `· ${Math.round(p.similarityScore * 100)}%` : ''}
                        </Pill>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <StatusPill status={p.status} />
                      {/* "One Investor" is a badge on an approved project, not a status. */}
                      {p.status === 'approved' && p.confirmedInvestors === 1 && (
                        <Pill tone="blue">
                          <Users className="h-3 w-3" aria-hidden="true" /> One Investor
                        </Pill>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(p.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link to={`/app/admin/projects/${p.id}`} className="btn-secondary px-2 py-1 text-xs">
                        View
                      </Link>
                      {availableActions(p).map(([key, a, disabled]) => (
                        <button
                          key={key}
                          type="button"
                          title={disabled || undefined}
                          disabled={Boolean(disabled)}
                          onClick={() => setDialog({ key, action: a, project: p })}
                          className={`${a.tone === 'danger' ? 'btn-danger' : 'btn-secondary'} px-2 py-1 text-xs`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReasonDialog
        open={Boolean(dialog)}
        title={dialog?.action.title}
        description={dialog ? `${dialog.project.title} (${dialog.project.projectCode}) — ${dialog.action.description}` : ''}
        warning={dialog?.key === 'approve' && dialog.project.rdbFlag === 'suspicious' ? 'The RDB pre-check flagged this certificate as Suspicious. Record why you are approving.' : undefined}
        reason={dialog?.key === 'approve' && dialog.project.rdbFlag === 'suspicious' ? 'required' : dialog?.action.reason}
        reasonLabel={dialog?.action.reasonLabel}
        confirmLabel={dialog?.action.label}
        tone={dialog?.action.tone}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api.post(`/admin/projects/${dialog.project.id}/${dialog.key}`, { reason });
          setNotice(`${dialog.action.label}: ${dialog.project.title} — recorded.`);
          load();
        }}
      />
    </>
  );
}
