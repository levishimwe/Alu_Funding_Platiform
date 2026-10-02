import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileCheck2, MailCheck, PlusCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert, PageHeader, StatusPill } from '../components/ui';

function Step({ done, current, icon: Icon, title, children }) {
  return (
    <li className="flex gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          done ? 'border-green-500 bg-green-50 text-green-600 dark:bg-green-500/15' : current ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted">{children}</p>
      </div>
    </li>
  );
}

// Graduate dashboard. While the account awaits approval, it explains where the
// account is in the review process; project features unlock after approval.
export default function GraduateOverview() {
  const { user, refresh } = useAuth();
  const status = user.graduateProfile?.verificationStatus;

  useEffect(() => {
    document.title = 'Overview · ALU Ventures';
    refresh();
  }, [refresh]);

  return (
    <>
      <PageHeader
        title="Graduate Founder Dashboard"
        description={`Welcome, ${user.fullName.split(' ')[0]}.`}
        actions={
          user.approved && (
            <Link to="/app/projects/new" className="btn-primary">
              <PlusCircle className="h-4 w-4" aria-hidden="true" /> Submit a project
            </Link>
          )
        }
      />

      {!user.approved && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Account verification</h2>
              <StatusPill status={status === 'rejected' ? 'rejected' : 'pending_review'} />
            </div>
            <p className="mt-1 text-sm text-muted">
              An ALU Ventures administrator reviews every graduate account against the uploaded degree evidence. You can
              submit projects once your account is approved.
            </p>
            <ol className="mt-5 space-y-4">
              <Step done icon={MailCheck} title="Alumni email confirmed">
                {user.email}
              </Step>
              <Step done icon={FileCheck2} title="Degree certificate received">
                Stored privately. Automated checks help the administrator but never decide on their own.
              </Step>
              <Step current icon={Clock} title="Administrator review">
                You will receive an email as soon as a decision is recorded.
              </Step>
              <Step icon={ShieldCheck} title="Verified graduate">
                Submit ventures, receive investor introductions and apply to funding opportunities.
              </Step>
            </ol>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Your profile</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Programme</dt>
                <dd>{user.graduateProfile?.program || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Graduation year</dt>
                <dd>{user.graduateProfile?.cohortYear || '—'}</dd>
              </div>
            </dl>
            <Alert type="info" className="mt-4">
              While you wait, you can browse public ventures and open funding opportunities.
            </Alert>
          </div>
        </div>
      )}

      {user.approved && (
        <Alert type="success" title="Your graduate account is verified">
          You can now submit ventures for review.
        </Alert>
      )}
    </>
  );
}
