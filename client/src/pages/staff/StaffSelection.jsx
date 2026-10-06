import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Inbox, Search, Star, TriangleAlert, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert, EmptyState, Field, PageLoader, Pill, StatusPill, formatDate } from '../../components/ui';
import { CriteriaSummary } from '../../components/OpportunityForm';
import AuditStrip from '../../components/AuditStrip';
import { Breadcrumb, Stat } from './StaffOpportunities';

const NEXT = { submitted: ['shortlisted', 'selected', 'not_selected'], shortlisted: ['selected', 'not_selected'] };
const DECISIONS = {
  shortlisted: { label: 'Shortlist', body: 'Move forward to the next round.', icon: Star, on: 'border-purple-400 bg-purple-50 dark:bg-purple-500/10' },
  selected: { label: 'Select', body: 'Final. The applicant is invited to the opportunity.', icon: CheckCircle2, on: 'border-green-500 bg-green-50 dark:bg-green-500/10' },
  not_selected: { label: 'Not selected', body: 'Final. Your reason is shared with the applicant.', icon: XCircle, on: 'border-red-400 bg-red-50 dark:bg-red-500/10' },
};
const TABS = [
  ['all', 'All applicants'],
  ['submitted', 'Awaiting decision'],
  ['shortlisted', 'Shortlisted'],
  ['selected', 'Selected'],
  ['not_selected', 'Not selected'],
];

function DecisionPanel({ application, onSaved }) {
  const options = NEXT[application.status] || [];
  const [decision, setDecision] = useState(options[0] || '');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDecision((NEXT[application.status] || [])[0] || '');
    setNote('');
    setNotify(true);
    setError('');
  }, [application.id, application.status]);

  const save = async (e) => {
    e.preventDefault();
    if (note.trim().length < 5) return setError('Give a reason for this decision (at least 5 characters).');
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/staff/applications/${application.id}/decision`, { decision, note: note.trim(), notify });
      onSaved(`${DECISIONS[decision].label}: ${application.project.title}${res.notified ? ' — the applicant has been emailed.' : ' — recorded without emailing the applicant.'}`);
    } catch (err) {
      setError(err.fields?.note || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="border-b border-line bg-subtle px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Selected applicant</p>
        <p className="mt-1 font-semibold">{application.applicant.name}</p>
        <p className="text-sm">{application.project.title}</p>
        <p className="font-mono text-xs text-muted">{application.project.projectCode}</p>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-muted">Motivation</p>
          <p className="mt-0.5">{application.motivation}</p>
        </div>
        <p className="text-xs text-muted">{application.project.summary}</p>
        {application.eligibilityIssues.length > 0 && (
          <Alert type="warning">Eligibility changed since applying: {application.eligibilityIssues.join(' ')}</Alert>
        )}
      </div>

      {options.length === 0 ? (
        <div className="border-t border-line p-4 text-sm">
          <div className="flex items-center gap-2">
            Decision: <StatusPill status={application.status} />
          </div>
          <p className="mt-2 text-xs text-muted">
            By {application.decidedBy} on {formatDate(application.decidedAt, true)}
          </p>
          <p className="mt-1">“{application.decisionNote}”</p>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-3 border-t border-line p-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              Decision <span className="text-red-600">*</span>
            </legend>
            <div className="space-y-2">
              {options.map((key) => {
                const d = DECISIONS[key];
                const Icon = d.icon;
                return (
                  <label key={key} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${decision === key ? d.on : 'border-line hover:bg-subtle'}`}>
                    <input type="radio" name="decision" value={key} checked={decision === key} onChange={() => setDecision(key)} className="mt-1" />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="h-4 w-4" aria-hidden="true" /> {d.label}
                      </span>
                      <span className="block text-xs text-muted">{d.body}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Field label="Reason (shared with the applicant)" htmlFor="decision-note" required error={error}>
            <textarea id="decision-note" rows={4} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>
              Notify the applicant by email
              <span className="block text-xs text-muted">Sent only after the decision is saved.</span>
            </span>
          </label>
          <button type="submit" className="btn-primary w-full" disabled={busy || !decision}>
            {busy ? 'Saving…' : 'Save decision'}
          </button>
        </form>
      )}
    </div>
  );
}

// Staff Selection & Evaluation (Figma). FR09: the designated ALU authority
// records shortlist / selected / not selected decisions with reasons.
export default function StaffSelection() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([api.get(`/staff/opportunities/${id}`), api.get(`/staff/opportunities/${id}/audit`)]);
      setData(d);
      setAudit(a.entries);
      document.title = `Selection: ${d.opportunity.title} · ALU Ventures`;
      setSelectedId((current) => current ?? d.applications.find((x) => NEXT[x.status])?.id ?? d.applications[0]?.id ?? null);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.applications.filter(
      (a) =>
        (tab === 'all' || a.status === tab) &&
        (!term || `${a.applicant.name} ${a.project.title} ${a.project.projectCode}`.toLowerCase().includes(term))
    );
  }, [data, tab, q]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return <PageLoader />;
  const { opportunity, applications } = data;
  const count = (s) => applications.filter((a) => a.status === s).length;
  const decided = count('selected') + count('not_selected');
  const selected = applications.find((a) => a.id === selectedId);
  const rate = applications.length ? `${Math.round((count('selected') / applications.length) * 1000) / 10}%` : '—';

  return (
    <>
      <Breadcrumb items={[['ALU Staff', '/app/staff'], ['Opportunities', '/app/staff'], [opportunity.title, null], ['Applicant selection']]} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Staff Selection &amp; Evaluation: {opportunity.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill tone="blue" className="capitalize">
            {opportunity.type}
          </Pill>
          <StatusPill status={opportunity.status} />
          <span className="text-xs text-muted">
            {opportunity.organiser ? `${opportunity.organiser} · ` : ''}Deadline {formatDate(opportunity.deadline, true)}
          </span>
        </div>
        <div className="mt-2">
          <CriteriaSummary criteria={opportunity.criteria} />
        </div>
      </div>

      {notice && <Alert type="success" className="mb-4">{notice}</Alert>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-muted">Decisions completed</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {decided}
            <span className="text-sm font-normal text-muted"> / {applications.length}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle ring-1 ring-line">
            <div className="h-full bg-green-600" style={{ width: `${applications.length ? (decided / applications.length) * 100 : 0}%` }} />
          </div>
        </div>
        <Stat label="Awaiting decision" value={count('submitted')} hint="Submitted, not yet reviewed" tone="text-amber-600 dark:text-amber-400" />
        <Stat label="Shortlisted" value={count('shortlisted')} hint="Shortlisted for the next round" tone="text-purple-600 dark:text-purple-400" />
        <Stat label="Selection rate" value={rate} hint={`${count('selected')} selected of ${applications.length}`} tone="text-green-700 dark:text-green-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="mb-3 overflow-x-auto border-b border-line">
            <div className="flex min-w-max gap-1" role="tablist">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-accent font-medium' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {label}
                  <span className="rounded-full bg-subtle px-1.5 text-xs tabular-nums text-muted ring-1 ring-line">
                    {key === 'all' ? applications.length : count(key)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <label className="relative mb-3 block">
            <span className="sr-only">Search applicants</span>
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted" aria-hidden="true" />
            <input className="input pl-8" placeholder="Search applicant, project or code…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>

          {applications.length === 0 ? (
            <div className="card">
              <EmptyState icon={Inbox} title="No applications yet">
                Approved graduates can apply until the deadline.
              </EmptyState>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line bg-subtle text-xs text-muted">
                  <tr>
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 font-medium">Applicant &amp; venture</th>
                    <th className="px-3 py-2 font-medium">Eligibility</th>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((a) => {
                    const active = a.id === selectedId;
                    return (
                      <tr key={a.id} onClick={() => setSelectedId(a.id)} className={`cursor-pointer align-top ${active ? 'bg-accent-soft' : 'hover:bg-subtle'}`}>
                        <td className="px-3 py-3">
                          <input type="radio" name="applicant" checked={active} onChange={() => setSelectedId(a.id)} aria-label={`Select ${a.applicant.name}`} />
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{a.applicant.name}</p>
                          <p className="text-xs text-muted">{a.project.title}</p>
                          <p className="font-mono text-xs text-muted">{a.project.projectCode}</p>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {a.eligibilityIssues.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Meets criteria
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> Check eligibility
                            </span>
                          )}
                          <span className="block text-muted">
                            {a.applicant.program} · {a.applicant.cohortYear}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {a.project.sector}
                          <span className="block text-muted">
                            {a.project.stage} · applied {formatDate(a.submittedAt)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill status={a.status} label={a.status === 'submitted' ? 'Awaiting decision' : undefined} />
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">
                        No applicants in this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="border-t border-line bg-subtle px-3 py-2 text-xs text-muted">
                Showing {shown.length} of {applications.length} applicants
              </p>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          {selected ? (
            <DecisionPanel
              application={selected}
              onSaved={async (message) => {
                setNotice(message);
                await load();
              }}
            />
          ) : (
            <div className="card p-4 text-sm text-muted">Select an applicant to record a decision.</div>
          )}
        </aside>
      </div>

      <AuditStrip title="Selection audit log" entries={audit} />
    </>
  );
}
