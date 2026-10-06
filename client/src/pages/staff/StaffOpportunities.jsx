import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Briefcase, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert, EmptyState, PageHeader, PageLoader, Pill, StatCard, StatusPill, formatDate } from '../../components/ui';
import OpportunityForm, { CriteriaSummary } from '../../components/OpportunityForm';

// Staff opportunity management (Figma "Staff Opportunity Management").
export default function StaffOpportunities() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Staff opportunities · ALU Ventures';
    api.get('/staff/opportunities').then((d) => setRows(d.opportunities)).catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!rows) return <PageLoader />;
  const sum = (k) => rows.reduce((n, o) => n + (k === 'all' ? o.applicationCount : o.tally[k]), 0);

  return (
    <>
      <PageHeader
        title="Staff Opportunity Management"
        description="Propose hackathons, grants and competitions for publication, then review applicants and record selection decisions."
        actions={
          <Link to="/app/staff/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Propose opportunity
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open opportunities" value={rows.filter((o) => o.status === 'published').length} />
        <StatCard label="Applications to review" value={sum('submitted')} tone="amber" />
        <StatCard label="Shortlisted" value={sum('shortlisted')} tone="purple" />
        <StatCard label="Selected" value={sum('selected')} tone="green" />
      </div>
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={Briefcase} title="No opportunities yet" action={<Link to="/app/staff/new" className="btn-primary">Propose the first one</Link>}>
            Proposals are reviewed and published by the platform administrator.
          </EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Opportunity</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Deadline</th>
                <th className="px-4 py-2 font-medium">Applicants</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.title}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Pill tone="blue">{o.type}</Pill>
                      {o.mine && <span className="text-xs text-muted">Proposed by you</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={o.status} label={o.status === 'pending_review' ? 'Awaiting admin' : undefined} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(o.deadline, true)}</td>
                  <td className="px-4 py-3 text-xs">
                    {o.applicationCount} total · {o.tally.submitted} new · {o.tally.shortlisted} shortlisted · {o.tally.selected} selected
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status === 'pending_review' ? (
                      o.mine && (
                        <Link to={`/app/staff/${o.id}/edit`} className="btn-secondary">
                          Edit
                        </Link>
                      )
                    ) : (
                      <Link to={`/app/staff/${o.id}`} className="btn-primary">
                        Review applicants
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      <PageHeader title={id ? 'Edit proposal' : 'Propose an opportunity'} description="The administrator reviews and publishes proposals. You will review applicants once it is published." />
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

export { CriteriaSummary };
