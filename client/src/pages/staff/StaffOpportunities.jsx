import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Briefcase, ChevronRight, ExternalLink, Eye, Pencil, Plus, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert, EmptyState, PageLoader, Pill, StatusPill, formatDate } from '../../components/ui';
import OpportunityForm, { CriteriaSummary } from '../../components/OpportunityForm';
import AuditStrip from '../../components/AuditStrip';

const TYPES = [
  ['', 'All types'],
  ['hackathon', 'Hackathon'],
  ['grant', 'Grant'],
  ['competition', 'Competition'],
  ['other', 'Other'],
];
const STATUS_FILTERS = [
  ['', 'All statuses'],
  ['pending_review', 'Awaiting admin'],
  ['published', 'Published'],
  ['closed', 'Closed'],
];

function Breadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
      {items.map(([label, to], i) => (
        <span key={label} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
          {to ? (
            <Link to={to} className="hover:text-accent hover:underline">
              {label}
            </Link>
          ) : (
            <span className="text-ink">{label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function Stat({ label, value, hint, tone = '' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function daysLeft(deadline) {
  const days = Math.ceil((new Date(deadline) - Date.now()) / 86400000);
  if (days < 0) return { text: 'Deadline passed', tone: 'text-muted' };
  if (days === 0) return { text: 'Closes today', tone: 'text-amber-600 dark:text-amber-400' };
  return { text: `${days} day${days === 1 ? '' : 's'} left`, tone: days <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400' };
}

// Staff Opportunity Management (Figma). Fields and actions are limited to the
// proposal: staff propose opportunities (FR08) and review applicants (FR09).
export default function StaffOpportunities() {
  const [rows, setRows] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    document.title = 'Staff opportunities · ALU Ventures';
    api.get('/staff/opportunities').then((d) => setRows(d.opportunities)).catch((e) => setError(e.message));
    api.get('/staff/activity').then((d) => setActivity(d.entries)).catch(() => setActivity([]));
  }, []);

  const shown = useMemo(() => {
    if (!rows) return [];
    const term = q.trim().toLowerCase();
    return rows.filter(
      (o) =>
        (!type || o.type === type) &&
        (!status || o.status === status) &&
        (!term || `${o.title} ${o.organiser || ''}`.toLowerCase().includes(term))
    );
  }, [rows, q, type, status]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!rows) return <PageLoader />;
  const sum = (k) => rows.reduce((n, o) => n + (k === 'all' ? o.applicationCount : o.tally[k]), 0);
  const published = rows.filter((o) => o.status === 'published').length;
  const awaitingAdmin = rows.filter((o) => o.status === 'pending_review').length;

  return (
    <>
      <Breadcrumb items={[['ALU Staff', '/app/staff'], ['Opportunities']]} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Staff Opportunity Management</h1>
          <p className="mt-1 text-sm text-muted">
            Propose hackathons, grants and competitions for administrator review and publication, then review eligible
            applicants and record selection decisions with reasons.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to="/opportunities" target="_blank" className="btn-secondary">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Public listing
          </Link>
          <Link to="/app/staff/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Propose opportunity
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Published opportunities" value={published} hint={`${awaitingAdmin} awaiting administrator review`} />
        <Stat label="Applications received" value={sum('all')} hint="Across all opportunities" tone="text-accent" />
        <Stat label="Awaiting decision" value={sum('submitted')} hint={`${sum('shortlisted')} shortlisted`} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="Selected" value={sum('selected')} hint={`${sum('not_selected')} not selected`} tone="text-green-700 dark:text-green-400" />
      </div>

      {/* Filter bar */}
      <div className="card mb-3 flex flex-col gap-2 p-2 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search opportunities</span>
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted" aria-hidden="true" />
          <input className="input pl-8" placeholder="Search by title or organiser…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by type">
          {TYPES.map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={type === value}
              onClick={() => setType(value)}
              className={`rounded-md border px-2.5 py-1 text-xs ${type === value ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line bg-surface text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <select className="input lg:w-44" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map(([value, label]) => (
            <option key={label} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={Briefcase} title="No opportunities yet" action={<Link to="/app/staff/new" className="btn-primary">Propose the first one</Link>}>
            Proposals are reviewed and published by the platform administrator.
          </EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Opportunity</th>
                <th className="px-4 py-2 font-medium">Proposed by</th>
                <th className="px-4 py-2 font-medium">Eligibility</th>
                <th className="px-4 py-2 font-medium">Applicants</th>
                <th className="px-4 py-2 font-medium">Deadline</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((o) => {
                const left = daysLeft(o.deadline);
                const reviewable = o.status !== 'pending_review';
                return (
                  <tr key={o.id} className="align-top hover:bg-subtle">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{o.title}</p>
                          <p className="text-xs text-muted">{o.organiser || '—'}</p>
                        </div>
                        <Pill tone="blue" className="capitalize">
                          {o.type}
                        </Pill>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {o.createdBy?.name}
                      {o.mine && <span className="block text-muted">You</span>}
                    </td>
                    <td className="max-w-56 px-4 py-3">
                      <CriteriaSummary criteria={o.criteria} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-sm font-semibold tabular-nums">{o.applicationCount}</span>
                      <span className="block text-muted">{o.tally.submitted} new · {o.tally.shortlisted} shortlisted</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {formatDate(o.deadline)}
                      <span className={`block ${left.tone}`}>{left.text}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.status} label={o.status === 'pending_review' ? 'Awaiting admin' : undefined} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {reviewable && (
                          <Link to={`/app/staff/${o.id}`} className="rounded-md p-1.5 text-accent hover:bg-accent-soft" title="Review applicants" aria-label={`Review applicants for ${o.title}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        )}
                        {o.mine && o.status === 'pending_review' && (
                          <Link to={`/app/staff/${o.id}/edit`} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink" title="Edit proposal" aria-label={`Edit ${o.title}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        )}
                        {reviewable && (
                          <Link to={`/app/staff/${o.id}`} className="btn-primary ml-1 px-2 py-1 text-xs">
                            Applicants
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                    No opportunities match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="border-t border-line bg-subtle px-4 py-2 text-xs text-muted">
            Showing {shown.length} of {rows.length} opportunities
          </p>
        </div>
      )}

      <AuditStrip title="Recent opportunity and selection activity" entries={activity} />
    </>
  );
}

export function StaffOpportunityForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(id ? null : undefined);
  useEffect(() => {
    if (id) api.get(`/staff/opportunities/${id}`).then((d) => setInitial(d.opportunity));
  }, [id]);
  if (initial === null) return <PageLoader />;
  return (
    <>
      <Breadcrumb items={[['ALU Staff', '/app/staff'], ['Opportunities', '/app/staff'], [id ? 'Edit proposal' : 'Propose']]} />
      <h1 className="text-2xl font-semibold tracking-tight">{id ? 'Edit proposal' : 'Propose an opportunity'}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">The administrator reviews and publishes proposals. You review applicants once it is published.</p>
      <div className="card p-5">
        <OpportunityForm
          initial={initial}
          submitLabel={id ? 'Save proposal' : 'Submit for publication'}
          onCancel={() => navigate('/app/staff')}
          onSubmit={async (data) => {
            if (id) await api.patch(`/staff/opportunities/${id}`, data);
            else await api.post('/staff/opportunities', data);
            navigate('/app/staff');
          }}
        />
      </div>
    </>
  );
}

export { Breadcrumb, Stat };
