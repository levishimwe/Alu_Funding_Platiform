import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderPlus, PlusCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Alert, EmptyState, PageHeader, PageLoader, StatusPill, formatDate } from '../../components/ui';

export function useMyProjects() {
  const [state, setState] = useState({ projects: null, error: '' });
  useEffect(() => {
    api
      .get('/projects/mine')
      .then((d) => setState({ projects: d.projects, error: '' }))
      .catch((e) => setState({ projects: [], error: e.message }));
  }, []);
  return state;
}

export function ProjectsTable({ projects }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-subtle text-xs text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Project</th>
            <th className="px-4 py-2 font-medium">Code</th>
            <th className="px-4 py-2 font-medium">Sector</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {projects.map((p) => (
            <tr key={p.id} className="hover:bg-subtle">
              <td className="px-4 py-3">
                <Link to={`/app/projects/${p.id}`} className="font-medium text-accent hover:underline">
                  {p.title}
                </Link>
                <div className="mt-0.5">
                  <StatusPill status={p.type} />
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{p.projectCode}</td>
              <td className="px-4 py-3">{p.sector}</td>
              <td className="px-4 py-3">
                <StatusPill status={p.status} />
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(p.submittedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MyProjects() {
  const { user } = useAuth();
  const { projects, error } = useMyProjects();

  useEffect(() => {
    document.title = 'My projects · ALU Ventures';
  }, []);

  return (
    <>
      <PageHeader
        title="My Projects"
        description="Track review status, respond to clarification requests and revise your submissions."
        actions={
          user.approved && (
            <Link to="/app/projects/new" className="btn-primary">
              <PlusCircle className="h-4 w-4" aria-hidden="true" /> New project
            </Link>
          )
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {!projects ? (
        <PageLoader />
      ) : projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderPlus}
            title="No projects submitted yet"
            action={
              user.approved ? (
                <Link to="/app/projects/new" className="btn-primary">
                  Submit your first project
                </Link>
              ) : null
            }
          >
            {user.approved
              ? 'Submit a registered company with its RDB certificate, or a business idea with an idea-stage declaration.'
              : 'You can submit projects once an administrator approves your graduate account.'}
          </EmptyState>
          <div className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
            {[
              ['1. Prepare RDB evidence', 'Registered companies upload the RDB certificate; ideas use a declaration.'],
              ['2. Admin verification', 'An administrator reviews the evidence and any automated flags.'],
              ['3. Unlock opportunities', 'Approved projects can receive introductions and apply to opportunities.'],
            ].map(([title, body]) => (
              <div key={title} className="bg-surface p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ProjectsTable projects={projects} />
        </div>
      )}
    </>
  );
}
