export type EmailEvent = {
  id: string; recipient_id: string; kind: string; subject_label: string | null;
  status: string; detail: string | null; created_at: string;
};

const KIND: Record<string, string> = {
  "new-job": "New job", "friend-applied": "Nudge", "job-digest": "Digest", "weekly-reminder": "Weekly",
};
const TONE: Record<string, string> = {
  sent: "bg-success text-success-foreground",
  failed: "bg-destructive text-destructive-foreground",
  suppressed: "bg-accent text-accent-foreground",
  skipped: "bg-muted text-muted-foreground",
};

export function DeliveryList({ events, nameFor }: { events: EmailEvent[]; nameFor?: (id: string) => string }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No emails yet.</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {events.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[e.status] ?? "bg-muted"}`}>{e.status}</span>
          <span className="font-semibold">{KIND[e.kind] ?? e.kind}</span>
          {nameFor && <span className="text-muted-foreground">→ {nameFor(e.recipient_id)}</span>}
          <span className="min-w-0 flex-1 truncate">{e.subject_label}</span>
          <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
          {e.detail && <span className="w-full text-xs text-muted-foreground">{e.detail}</span>}
        </li>
      ))}
    </ul>
  );
}
