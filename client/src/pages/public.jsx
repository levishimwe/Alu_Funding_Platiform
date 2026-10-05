import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Building2, GraduationCap, Info, Lightbulb, Search, ShieldCheck } from 'lucide-react';
import { api, qs } from '../lib/api';
import { SECTORS, STAGES } from '../lib/constants';
import { Alert, EmptyState, PageLoader, Pill, StatusPill, formatDate } from '../components/ui';

// Light content area inside the dark public frame, as in the Figma screens.
function LightPage({ children }) {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
    </div>
  );
}

export function PublicProfileCard({ project, disclaimer }) {
  return (
    <article className="card overflow-hidden">
      <div className="border-b border-line bg-subtle px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="green">
            <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Approved platform record
          </Pill>
          <span className="font-mono text-xs text-muted">{project.projectCode}</span>
          {project.status !== 'approved' && <StatusPill status={project.status} />}
        </div>
        <h2 className="mt-2 text-xl font-semibold">{project.title}</h2>
        <p className="mt-1 text-sm text-muted">{project.summary}</p>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-3">
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold">About the venture</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{project.description}</p>
        </div>
        <dl className="space-y-2 text-sm">
          {[
            ['Sector', project.sector],
            ['Stage', project.stage],
            ['Type', project.type === 'company' ? 'Registered company' : 'Idea stage'],
            ...(project.companyName ? [['Company', project.companyName]] : []),
            ...(project.fundingSought ? [['Funding sought', project.fundingSought]] : []),
            ['Approved', formatDate(project.approvedAt)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
          {project.founder && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-line p-3">
              <GraduationCap className="h-5 w-5 text-accent" aria-hidden="true" />
              <div>
                <p className="font-medium">{project.founder.name}</p>
                <p className="text-xs text-muted">
                  Verified ALU graduate{project.founder.cohortYear ? ` · Class of ${project.founder.cohortYear}` : ''}
                </p>
              </div>
            </div>
          )}
        </dl>
      </div>
      {disclaimer && (
        <p className="flex gap-2 border-t border-line px-5 py-3 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {disclaimer}
        </p>
      )}
    </article>
  );
}

// FR14: exact project-code lookup.
export function VerifyProject() {
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lookup = async (value) => {
    const c = value.trim();
    if (!c) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.get(`/public/verify/${encodeURIComponent(c)}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    document.title = 'Verify a Project · ALU Ventures';
    if (params.get('code')) lookup(params.get('code'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LightPage>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-accent" aria-hidden="true" />
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Verify a Project</h1>
          <p className="mt-2 text-sm text-muted">
            Enter a project verification code (for example ALU-2026-7KQ4M) to confirm that a venture has an approved record
            on ALU Ventures.
          </p>
        </div>
        <form
          className="card flex flex-col gap-2 p-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setParams(code ? { code: code.trim() } : {});
            lookup(code);
          }}
        >
          <label htmlFor="code" className="sr-only">
            Project code
          </label>
          <input
            id="code"
            className="input font-mono uppercase"
            placeholder="ALU-2026-XXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="btn-primary px-5" disabled={busy}>
            <Search className="h-4 w-4" aria-hidden="true" /> {busy ? 'Checking…' : 'Verify'}
          </button>
        </form>
        <div className="mt-6">
          {busy && <PageLoader />}
          {error && <Alert type="warning">{error}</Alert>}
          {result && <PublicProfileCard project={result.project} disclaimer={result.disclaimer} />}
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ['Reviewed records', 'Every published project is reviewed by an administrator before approval.'],
            ['Private evidence', 'Certificates and supporting documents are never shown publicly.'],
            ['Not an endorsement', 'A match confirms a platform record only — always do your own due diligence.'],
          ].map(([t, b]) => (
            <div key={t} className="card p-4">
              <p className="text-sm font-semibold">{t}</p>
              <p className="mt-1 text-xs text-muted">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </LightPage>
  );
}

export function VentureCard({ project, to }) {
  const Icon = project.type === 'company' ? Building2 : Lightbulb;
  return (
    <Link to={to} className="card flex flex-col p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <Pill tone="slate">{project.sector}</Pill>
      </div>
      <h3 className="mt-3 font-semibold">{project.title}</h3>
      <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{project.summary}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{project.stage}</span>
        <span className="font-mono">{project.projectCode}</span>
      </div>
    </Link>
  );
}

// FR06: public catalogue of approved, consented projects.
export function Ventures() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const filters = { sector: params.get('sector') || '', type: params.get('type') || '', stage: params.get('stage') || '', q: params.get('q') || '' };
  const [search, setSearch] = useState(filters.q);

  useEffect(() => {
    document.title = 'Ventures · ALU Ventures';
    setData(null);
    api
      .get(`/public/projects${qs({ ...filters, page: params.get('page') || 1 })}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (k, v) => {
    const next = { ...filters, [k]: v };
    setParams(Object.fromEntries(Object.entries(next).filter(([, val]) => val)));
  };

  return (
    <LightPage>
      <h1 className="text-3xl font-semibold tracking-tight">ALU graduate ventures</h1>
      <p className="mt-2 text-sm text-muted">Approved projects whose founders have consented to publication.</p>
      <form
        className="card mt-6 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          update('q', search);
        }}
      >
        <input className="input" placeholder="Search ventures…" aria-label="Search ventures" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" aria-label="Sector" value={filters.sector} onChange={(e) => update('sector', e.target.value)}>
          <option value="">All sectors</option>
          {SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" aria-label="Stage" value={filters.stage} onChange={(e) => update('stage', e.target.value)}>
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" aria-label="Type" value={filters.type} onChange={(e) => update('type', e.target.value)}>
          <option value="">All types</option>
          <option value="company">Registered companies</option>
          <option value="idea">Ideas</option>
        </select>
      </form>
      <div className="mt-6">
        {error && <Alert type="error">{error}</Alert>}
        {!data && !error && <PageLoader />}
        {data && data.projects.length === 0 && (
          <div className="card">
            <EmptyState icon={Search} title="No ventures match these filters">
              Try a different sector or clear the search.
            </EmptyState>
          </div>
        )}
        {data && data.projects.length > 0 && (
          <>
            <p className="mb-3 text-xs text-muted">{data.total} approved venture(s)</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.projects.map((p) => (
                <VentureCard key={p.projectCode} project={p} to={`/ventures/${p.projectCode}`} />
              ))}
            </div>
            {data.total > data.pageSize && (
              <div className="mt-6 flex justify-center gap-2">
                <button type="button" className="btn-secondary" disabled={data.page <= 1} onClick={() => update('page', String(data.page - 1))}>
                  Previous
                </button>
                <button type="button" className="btn-secondary" disabled={data.page * data.pageSize >= data.total} onClick={() => update('page', String(data.page + 1))}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </LightPage>
  );
}

export function PublicProject() {
  const { code } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get(`/public/verify/${encodeURIComponent(code)}`)
      .then((r) => {
        setResult(r);
        document.title = `${r.project.title} · ALU Ventures`;
      })
      .catch((e) => setError(e.message));
  }, [code]);
  return (
    <LightPage>
      <Link to="/ventures" className="text-sm text-accent hover:underline">
        ← All ventures
      </Link>
      <div className="mt-4">
        {error && <Alert type="warning">{error}</Alert>}
        {!result && !error && <PageLoader />}
        {result && <PublicProfileCard project={result.project} disclaimer={result.disclaimer} />}
        {result && (
          <p className="mt-4 text-sm text-muted">
            Investor or sponsor?{' '}
            <Link to="/register?role=investor" className="text-accent hover:underline">
              Request investor access
            </Link>{' '}
            to ask the founder for an introduction.
          </p>
        )}
      </div>
    </LightPage>
  );
}
