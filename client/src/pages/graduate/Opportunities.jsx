import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Trophy, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Alert, EmptyState, Field, PageHeader, PageLoader, Pill, StatusPill, formatDate } from '../../components/ui';
import { CriteriaSummary } from '../../components/OpportunityForm';
import ReasonDialog from '../../components/ReasonDialog';

// Graduate view (Figma "Funding Opportunities & Hackathons"): open
// opportunities, per-project eligibility before applying, and decisions.
export default function Opportunities() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [applying, setApplying] = useState(null);
  const [projectId, setProjectId] = useState('');

  const load = useCallback(() => {
    Promise.all([api.get('/opportunities'), api.get('/opportunities/applications')])
      .then(([o, a]) => {
        setData(o.opportunities);
        setApplications(a.applications);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    document.title = 'Funding opportunities · ALU Ventures';
    load();
  }, [load]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return <PageLoader />;

  return (
    <>
      <PageHeader title="Funding Opportunities & Hackathons" description="Apply with an approved project. Eligibility is checked before you submit, and ALU staff record every decision." />
      {!user.approved && (
        <Alert type="info" className="mb-4">
          You can apply once your graduate account and a project are approved.
        </Alert>
      )}
      {notice && <Alert type="success" className="mb-4">{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {data.length === 0 ? (
            <div className="card">
              <EmptyState icon={Trophy} title="No open opportunities right now">
                New hackathons, grants and competitions appear here as ALU staff publish them.
              </EmptyState>
            </div>
          ) : (
            data.map((o) => {
              const eligible = o.projects.filter((p) => !p.applied && p.issues.length === 0);
              return (
                <article key={o.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="blue">{o.type}</Pill>
                    {o.prize && <Pill tone="green">{o.prize}</Pill>}
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Closes {formatDate(o.deadline, true)}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">{o.title}</h2>
                  {o.organiser && <p className="text-xs text-muted">{o.organiser}</p>}
                  <p className="mt-2 text-sm">{o.description}</p>
                  <div className="mt-2">
                    <CriteriaSummary criteria={o.criteria} />
                  </div>
                  {o.projects.length > 0 && (
                    <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
                      {o.projects.map((p) => (
                        <li key={p.id} className="flex gap-2 text-sm">
                          {p.applied ? (
                            <StatusPill status={p.applied} />
                          ) : p.issues.length === 0 ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Eligible" />
                          ) : (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-label="Not eligible" />
                          )}
                          <span>
                            {p.title}
                            {!p.applied && p.issues.length > 0 && <span className="block text-xs text-muted">{p.issues.join(' ')}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!user.approved || eligible.length === 0}
                      onClick={() => {
                        setProjectId(String(eligible[0]?.id || ''));
                        setApplying(o);
                      }}
                    >
                      Apply
                    </button>
                    {user.approved && eligible.length === 0 && <span className="ml-3 text-xs text-muted">No eligible project to apply with.</span>}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <aside className="card h-fit p-5">
          <h2 className="font-semibold">My applications</h2>
          {applications.length === 0 ? (
            <p className="mt-2 text-sm text-muted">You have not applied to anything yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {applications.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{a.opportunity?.title}</span>
                    <StatusPill status={a.status} />
                  </div>
                  <p className="text-xs text-muted">{a.project?.title} · applied {formatDate(a.submittedAt)}</p>
                  {a.decisionNote && <p className="mt-1 text-xs">“{a.decisionNote}”</p>}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <ReasonDialog
        open={Boolean(applying)}
        title={`Apply to ${applying?.title}`}
        description="ALU staff review applications against the published criteria."
        reason="required"
        reasonLabel="Why is your project a good fit?"
        confirmLabel="Submit application"
        onClose={() => setApplying(null)}
        onConfirm={async (motivation) => {
          try {
            await api.post(`/opportunities/${applying.id}/apply`, { projectId: Number(projectId), motivation });
          } catch (err) {
            if (err.details?.issues) err.message = err.details.issues.join(' ');
            if (err.fields?.motivation) err.fields = { reason: err.fields.motivation };
            throw err;
          }
          setNotice(`Application submitted to ${applying.title}.`);
          load();
        }}
      >
        <Field label="Project" htmlFor="apply-project">
          <select id="apply-project" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {applying?.projects
              .filter((p) => !p.applied && p.issues.length === 0)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.projectCode})
                </option>
              ))}
          </select>
        </Field>
      </ReasonDialog>
    </>
  );
}
