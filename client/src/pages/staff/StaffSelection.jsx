import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Inbox, TriangleAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert, EmptyState, Field, PageHeader, PageLoader, StatCard, StatusPill, formatDate } from '../../components/ui';
import ReasonDialog from '../../components/ReasonDialog';
import { CriteriaSummary } from '../../components/OpportunityForm';

const NEXT = { submitted: ['shortlisted', 'selected', 'not_selected'], shortlisted: ['selected', 'not_selected'] };
const LABEL = { shortlisted: 'Shortlist', selected: 'Select', not_selected: 'Not selected' };

// FR09: the designated ALU authority records shortlist / selected / not
// selected decisions with reasons (Figma "Staff Selection & Evaluation").
export default function StaffSelection() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [decision, setDecision] = useState('shortlisted');
  const [filter, setFilter] = useState('all');

  const load = useCallback(
    () =>
      api
        .get(`/staff/opportunities/${id}`)
        .then((d) => {
          setData(d);
          document.title = `Selection: ${d.opportunity.title} · ALU Ventures`;
        })
        .catch((e) => setError(e.message)),
    [id]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return <PageLoader />;
  const { opportunity, applications } = data;
  const count = (s) => applications.filter((a) => a.status === s).length;
  const shown = filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  return (
    <>
      <Link to="/app/staff" className="mb-3 inline-flex items-center gap-1 text-sm text-accent hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All opportunities
      </Link>
      <PageHeader
        eyebrow={`${opportunity.type} · deadline ${formatDate(opportunity.deadline, true)}`}
        title={`Staff Selection & Evaluation: ${opportunity.title}`}
        description={opportunity.organiser || undefined}
      />
      <div className="mb-4">
        <CriteriaSummary criteria={opportunity.criteria} />
      </div>
      {notice && <Alert type="success" className="mb-4">{notice}</Alert>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={applications.length} />
        <StatCard label="Awaiting decision" value={count('submitted')} tone="amber" />
        <StatCard label="Shortlisted" value={count('shortlisted')} tone="purple" />
        <StatCard label="Selected" value={count('selected')} tone="green" />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {['all', 'submitted', 'shortlisted', 'selected', 'not_selected'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === s ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'}`}
          >
            {s === 'all' ? 'All' : s === 'submitted' ? 'Awaiting decision' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card">
          <EmptyState icon={Inbox} title="No applications here" />
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{a.project.title}</h2>
                    <span className="font-mono text-xs text-muted">{a.project.projectCode}</span>
                    <StatusPill status={a.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.applicant.name} · {a.applicant.program} {a.applicant.cohortYear} · {a.project.sector} · {a.project.stage} · applied {formatDate(a.submittedAt)}
                  </p>
                  <p className="mt-2 text-sm">{a.project.summary}</p>
                  <p className="mt-2 rounded-md bg-subtle p-2 text-sm">
                    <span className="font-medium">Motivation: </span>
                    {a.motivation}
                  </p>
                  {a.eligibilityIssues.length > 0 && (
                    <p className="mt-2 flex gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Eligibility changed since applying: {a.eligibilityIssues.join(' ')}
                    </p>
                  )}
                  {a.decisionNote && (
                    <p className="mt-2 text-xs text-muted">
                      Decision note by {a.decidedBy} ({formatDate(a.decidedAt, true)}): “{a.decisionNote}”
                    </p>
                  )}
                </div>
                {NEXT[a.status] && (
                  <div className="flex flex-wrap gap-2">
                    {NEXT[a.status].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={d === 'selected' ? 'btn-cta' : d === 'not_selected' ? 'btn-danger' : 'btn-secondary'}
                        onClick={() => {
                          setDecision(d);
                          setDialog(a);
                        }}
                      >
                        {LABEL[d]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ReasonDialog
        open={Boolean(dialog)}
        title={`Record decision for “${dialog?.project.title}”`}
        description="The applicant is emailed after the decision is saved. Selected and not-selected decisions are final."
        reason="required"
        reasonLabel="Reason (shared with the applicant)"
        confirmLabel="Save decision"
        tone={decision === 'not_selected' ? 'danger' : decision === 'selected' ? 'success' : 'primary'}
        onClose={() => setDialog(null)}
        onConfirm={async (note) => {
          await api.post(`/staff/applications/${dialog.id}/decision`, { decision, note });
          setNotice(`${LABEL[decision]}: ${dialog.project.title}. The applicant has been emailed.`);
          await load();
        }}
      >
        <Field label="Decision" htmlFor="decision">
          <select id="decision" className="input" value={decision} onChange={(e) => setDecision(e.target.value)}>
            {(NEXT[dialog?.status] || []).map((d) => (
              <option key={d} value={d}>
                {LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
      </ReasonDialog>
    </>
  );
}
