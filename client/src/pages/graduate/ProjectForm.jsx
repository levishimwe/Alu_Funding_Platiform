import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, FileText, Lightbulb, Sparkles, TriangleAlert, Upload, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { RELATIONSHIPS, SECTORS, STAGES } from '../../lib/constants';
import { Alert, Field, PageHeader, PageLoader, Pill } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const EMPTY = {
  title: '',
  type: 'company',
  sector: '',
  stage: '',
  summary: '',
  description: '',
  fundingSought: '',
  companyName: '',
  companyNumber: '',
  relationshipToCompany: '',
  ideaDeclaration: false,
  publicationConsent: true,
};

function Section({ number, title, description, children }) {
  return (
    <section className="card">
      <header className="border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold">
          <span className="mr-2 text-muted">{number}.</span>
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function FilePicker({ id, label, files, onChange, multiple = false, help, error }) {
  const list = files ? (Array.isArray(files) ? files : [files]) : [];
  return (
    <Field label={label} htmlFor={id} help={help} error={error}>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line bg-subtle px-3 py-3 text-sm text-muted hover:border-accent"
      >
        <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{multiple ? 'Add PDF, PNG or JPEG files' : 'Choose a PDF, PNG or JPEG file'} (max 10 MB)</span>
      </label>
      <input
        id={id}
        type="file"
        className="sr-only"
        multiple={multiple}
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          const picked = [...(e.target.files || [])];
          onChange(multiple ? [...list, ...picked].slice(0, 3) : picked[0] || null);
          e.target.value = '';
        }}
      />
      {list.length > 0 && (
        <ul className="mt-2 space-y-1">
          {list.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-line px-2 py-1 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="truncate">{f.name}</span>
              </span>
              <button
                type="button"
                className="rounded p-1 text-muted hover:text-red-600"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(multiple ? list.filter((_, j) => j !== i) : null)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}

// Submission and revision form (FR04). Sector suggestions and similarity
// warnings are assistive: the graduate confirms or overrides, then responds.
export default function ProjectForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [values, setValues] = useState(EMPTY);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [sectors, setSectors] = useState(SECTORS);
  const [suggestion, setSuggestion] = useState(null);
  const [rdb, setRdb] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [matches, setMatches] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sectorTouched = useRef(false);

  useEffect(() => {
    document.title = `${editing ? 'Revise' : 'Submit'} project · ALU Ventures`;
    api.get('/public/sectors').then((d) => d.sectors?.length && setSectors(d.sectors)).catch(() => {});
    if (!editing) return;
    api
      .get(`/projects/${id}`)
      .then(({ project }) => {
        setExisting(project);
        sectorTouched.current = true;
        setValues({
          ...EMPTY,
          ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, project[k] ?? EMPTY[k]])),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [editing, id]);

  // Live rule-based sector suggestion (FR15), debounced.
  const text = `${values.title} ${values.summary} ${values.description}`;
  useEffect(() => {
    if (text.trim().length < 12) return undefined;
    const t = setTimeout(() => {
      api
        .post('/projects/suggest-sector', { title: values.title, summary: values.summary, description: values.description })
        .then((s) => {
          setSuggestion(s);
          if (s.sector && !sectorTouched.current) setValues((v) => ({ ...v, sector: s.sector }));
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any change to title/description invalidates an earlier similarity check.
  useEffect(() => {
    setMatches(null);
    setAcknowledged(false);
  }, [values.title, values.description]);

  const set = (name) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    if (name === 'sector') sectorTouched.current = true;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  const hasExistingRdb = existing?.documents?.some((d) => d.kind === 'rdb_certificate');
  const sectorOverridden = suggestion?.sector && values.sector && suggestion.sector !== values.sector;

  const runSimilarityCheck = async () => {
    const res = await api.post('/projects/similarity-check', {
      title: values.title,
      description: values.description,
      projectId: editing ? Number(id) : undefined,
    });
    setMatches(res.matches);
    return res.matches;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      // FR04: the graduate must see and respond to any similarity warning first.
      const found = matches ?? (await runSimilarityCheck());
      if (found.length && !acknowledged) {
        setError('Your project is similar to existing approved projects. Review the matches below and confirm to continue.');
        document.getElementById('similarity')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      const data = new FormData();
      Object.entries(values).forEach(([k, v]) => data.append(k, typeof v === 'boolean' ? String(v) : v ?? ''));
      data.append('similarityAcknowledged', String(acknowledged));
      if (rdb && values.type === 'company') data.append('rdbCertificate', rdb);
      revenue.forEach((f) => data.append('revenueDocuments', f));
      const { project } = editing
        ? await api.upload(`/projects/${id}`, data, 'PATCH')
        : await api.upload('/projects', data);
      navigate(`/app/projects/${project.id}`, { state: { created: !editing } });
    } catch (err) {
      if (err instanceof ApiError && err.details?.code === 'SIMILARITY_WARNING') {
        setMatches(err.details.matches);
      }
      setError(err.message);
      setErrors(err.fields || {});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  const typeCards = useMemo(
    () => [
      { value: 'company', icon: Building2, title: 'Registered company', body: 'Registered with RDB. Upload the RDB certificate as evidence.' },
      { value: 'idea', icon: Lightbulb, title: 'Business idea', body: 'Not yet registered. Submit with an idea-stage declaration — no RDB certificate.' },
    ],
    []
  );

  if (!user.approved) {
    return (
      <Alert type="warning" title="Your account is still under review">
        You can submit projects once an administrator approves your graduate account.{' '}
        <Link to="/app" className="underline">
          View status
        </Link>
      </Alert>
    );
  }
  if (loading) return <PageLoader />;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <PageHeader
        eyebrow={editing ? existing?.projectCode : 'New submission'}
        title={editing ? 'Revise project' : 'Submit a graduate project'}
        description={
          editing
            ? 'Saving changes sends the project back for administrator review. Your project code stays the same.'
            : 'Your project receives a unique verification code at submission. An administrator reviews every project before it is published.'
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {existing?.reviewNote && existing.status === 'revision_required' && (
        <Alert type="info" title="Administrator's revision request">
          {existing.reviewNote}
        </Alert>
      )}

      <Section number={1} title="Project type">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Project type">
          {typeCards.map(({ value, icon: Icon, title, body }) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-md border p-4 ${values.type === value ? 'border-accent bg-accent-soft' : 'border-line hover:bg-subtle'}`}
            >
              <input type="radio" name="type" value={value} checked={values.type === value} onChange={set('type')} className="sr-only" />
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${values.type === value ? 'text-accent' : 'text-muted'}`} aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted">{body}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section number={2} title="About the venture">
        <Field label="Project title" htmlFor="title" required error={errors.title}>
          <input id="title" className="input" value={values.title} onChange={set('title')} maxLength={200} />
        </Field>
        <Field label="One-line summary" htmlFor="summary" required error={errors.summary} help="Shown on your public profile and in investor search results.">
          <input id="summary" className="input" value={values.summary} onChange={set('summary')} maxLength={500} />
        </Field>
        <Field label="Description" htmlFor="description" required error={errors.description} help="The problem, your solution, customers, traction and team. At least 80 characters.">
          <textarea id="description" rows={7} className="input" value={values.description} onChange={set('description')} maxLength={6000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stage" htmlFor="stage" required error={errors.stage}>
            <select id="stage" className="input" value={values.stage} onChange={set('stage')}>
              <option value="">Select stage</option>
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Funding sought (optional)" htmlFor="fundingSought" error={errors.fundingSought} help="e.g. RWF 15,000,000 seed or USD 20,000 grant">
            <input id="fundingSought" className="input" value={values.fundingSought || ''} onChange={set('fundingSought')} maxLength={120} />
          </Field>
        </div>
      </Section>

      <Section number={3} title="Sector" description="We suggest a sector from keywords in your description. You decide the final sector.">
        {suggestion?.sector ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-300 bg-accent-soft p-3 text-sm dark:border-blue-500/40">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
            <span>
              Suggested: <strong>{suggestion.sector}</strong>
            </span>
            <span className="text-muted">matched</span>
            {suggestion.matched.map((m) => (
              <Pill key={m} tone="blue">
                {m}
              </Pill>
            ))}
            {sectorOverridden && (
              <button type="button" className="ml-auto text-xs font-medium text-accent hover:underline" onClick={() => set('sector')(suggestion.sector)}>
                Use suggestion
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Start describing your venture to get a sector suggestion.</p>
        )}
        <Field label="Confirmed sector" htmlFor="sector" required error={errors.sector} help={sectorOverridden ? `You chose ${values.sector} instead of the suggestion — that's fine.` : undefined}>
          <select id="sector" className="input" value={values.sector} onChange={set('sector')}>
            <option value="">Select sector</option>
            {sectors.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </Section>

      {values.type === 'company' ? (
        <Section number={4} title="Company registration evidence" description="Required for registered companies. Documents are private and only seen by administrators.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registered company name" htmlFor="companyName" required error={errors.companyName}>
              <input id="companyName" className="input" value={values.companyName || ''} onChange={set('companyName')} />
            </Field>
            <Field label="RDB company code" htmlFor="companyNumber" required error={errors.companyNumber}>
              <input id="companyNumber" className="input" value={values.companyNumber || ''} onChange={set('companyNumber')} />
            </Field>
          </div>
          <Field label="Your relationship to the company" htmlFor="relationshipToCompany" required error={errors.relationshipToCompany}>
            <select id="relationshipToCompany" className="input" value={values.relationshipToCompany || ''} onChange={set('relationshipToCompany')}>
              <option value="">Select relationship</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <FilePicker
            id="rdbCertificate"
            label={hasExistingRdb ? 'Replace RDB certificate (optional)' : 'RDB registration certificate'}
            files={rdb}
            onChange={setRdb}
            error={errors.rdbCertificate}
            help="We read the certificate to pre-check the registration details and director name. An administrator always makes the final decision."
          />
        </Section>
      ) : (
        <Section number={4} title="Idea-stage declaration">
          <label className="flex gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={values.ideaDeclaration} onChange={set('ideaDeclaration')} />
            <span>
              I declare that this venture is at the idea stage and is not yet a registered company. I will update this
              project with RDB evidence once it is registered.
            </span>
          </label>
          {errors.ideaDeclaration && <p className="text-xs text-red-600">{errors.ideaDeclaration}</p>}
        </Section>
      )}

      <Section number={5} title="Revenue documents (optional)" description="Up to three files, such as statements or invoices. Private to administrators.">
        <FilePicker id="revenueDocuments" label="Revenue evidence" files={revenue} onChange={setRevenue} multiple />
      </Section>

      <Section number={6} title="Similarity check" description="We compare your title and description with approved projects before you submit.">
        <div id="similarity" className="space-y-3">
          {matches === null && (
            <button type="button" className="btn-secondary" onClick={() => runSimilarityCheck().catch((e) => setError(e.message))}>
              Run similarity check
            </button>
          )}
          {matches?.length === 0 && <Alert type="success">No similar approved projects found.</Alert>}
          {matches?.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
              <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                <TriangleAlert className="h-4 w-4" aria-hidden="true" /> Similar approved projects found
              </p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
                This is a review signal, not an accusation. If you continue, the project is marked “Similarity Flagged”
                and you will be asked to explain what makes it distinct.
              </p>
              <ul className="mt-3 space-y-1.5">
                {matches.map((m) => (
                  <li key={m.projectCode} className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-surface px-3 py-2 dark:border-amber-500/30">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.title}</span>
                      <span className="text-xs text-muted">
                        {m.projectCode} · {m.sector}
                      </span>
                    </span>
                    <Pill tone="amber">{Math.round(m.score * 100)}% similar</Pill>
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex gap-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                <span>I have reviewed these matches and want to submit for administrator review.</span>
              </label>
            </div>
          )}
        </div>
      </Section>

      <Section number={7} title="Publication">
        <label className="flex gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={values.publicationConsent} onChange={set('publicationConsent')} />
          <span>
            Once approved, publish a public summary of this project (title, sector, stage, summary and my name). Private
            documents are never published. Without consent the project is still reviewed but not publicly listed.
          </span>
        </label>
      </Section>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Link to={editing ? `/app/projects/${id}` : '/app/projects'} className="btn-secondary">
          Cancel
        </Link>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Submitting…' : editing ? 'Save and resubmit for review' : 'Submit for review'}
        </button>
      </div>
    </form>
  );
}
