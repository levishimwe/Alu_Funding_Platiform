import { History, MailCheck, MailX } from 'lucide-react';
import { formatDate } from './ui';

const LABEL = {
  'opportunity.proposed': 'proposed the opportunity',
  'opportunity.edited': 'edited the opportunity',
  'opportunity.published': 'published the opportunity',
  'opportunity.closed': 'closed applications',
  'opportunity.archived': 'archived the opportunity',
  'application.submitted': 'submitted an application',
  'application.shortlisted': 'shortlisted an application',
  'application.selected': 'selected an application',
  'application.not_selected': 'marked an application not selected',
};

// Audit log strip (FR10): who did what, when, and why.
export default function AuditStrip({ title = 'Audit log', entries }) {
  return (
    <section className="card mt-6" aria-label={title}>
      <h2 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold">
        <History className="h-4 w-4 text-muted" aria-hidden="true" /> {title}
      </h2>
      {!entries ? (
        <p className="px-4 py-3 text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">No recorded actions yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-4 py-2 text-sm sm:flex-row sm:items-start sm:gap-4">
              <span className="w-36 shrink-0 text-xs tabular-nums text-muted">{formatDate(e.at, true)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{e.actor?.name || 'System'}</span>{' '}
                <span className="text-muted">{LABEL[e.action] || e.action}</span>
                {e.reason && <span className="block truncate text-xs text-muted">“{e.reason}”</span>}
              </span>
              {e.notified !== null && e.action.startsWith('application.') && e.action !== 'application.submitted' && (
                <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${e.notified ? 'text-green-700 dark:text-green-400' : 'text-muted'}`}>
                  {e.notified ? <MailCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <MailX className="h-3.5 w-3.5" aria-hidden="true" />}
                  {e.notified ? 'Applicant emailed' : 'Not emailed'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
