// ─────────────────────────────────────────────────────────────────────────
// serviceLocationDetailMocks.ts
//
// PLACEHOLDER DATA for the Location detail page. Everything here stands in for
// data that no built/wired service supplies yet. As each backend lands, delete
// the mock and read the live value — the call sites are the only change.
//
// Already retired (now wired to real data, no longer here):
//   region, parent-customer standing/terms, tags, and the techOnSite /
//   hasOpenJobs gating booleans — all on GET /service-locations/:id now.
//
// Dropped from the design (never coming): agreementCoverage — there is no
// agreement service in the platform.
//
// Deferred to the Add/Edit Location pass (no writer yet, would be null
// forever): sq ft, operating hours, dispatch priority tier, structured
// arrival.facts[]. The page renders only populated fields, so it omits these.
//
// Still mocked here, pending per-service follow-ups:
//   - Live-tech detail (name / WO / since)  → dispatch / scheduling-service
//   - Open-job counts                        → work-order-service
//   - PM-overdue                             → scheduling-service
//   - Upcoming / forward visits (count + "Next scheduled" strip)
//                                            → scheduling-service (AG-2)
//   - Operational activity feed              → (cross-service feed)
//
// NOTHING IN HERE IS REAL DATA.
// ─────────────────────────────────────────────────────────────────────────

export type MockTone = 'info' | 'warning' | 'success' | 'accent' | 'neutral';

// ── Attention strip detail ──────────────────────────────────────────────────
// Row VISIBILITY is gated on the real location.techOnSite / location.hasOpenJobs
// booleans (see the page). The descriptive detail below — tech name, WO, since,
// open-job counts, PM-overdue — still comes from here until dispatch /
// work-order / scheduling services are wired.
//
// There is deliberately NO equipment-flagged rule: the redesign removed
// equipment flagging entirely. A unit's only live state is whether it has an
// open work order, which surfaces in the work-order list, not a flag layer.
export interface MockAttention {
  techOnSite: {
    name: string;
    job: { id: string; title: string };
    since: string;
    eta: string;
  } | null;
  openCritical: number;
  pmOverdueDays: number;
}
export const mockAttention: MockAttention = {
  techOnSite: {
    name: 'D. Park',
    job: { id: 'WO-4203', title: 'RTU-3 no cooling — critical' },
    since: '2h 14m ago',
    eta: '~30m remaining',
  },
  openCritical: 1,
  pmOverdueDays: 0,
};

// ── Overview: upcoming visits / PM schedule ─────────────────────────────────
// Backend ask: scheduling-service — scheduled visits for this location.
export interface MockVisit {
  date: string;
  time: string;
  kind: string;
  tech: string;
  job: string;
  tone: MockTone;
  live?: boolean;
}
export const mockUpcomingVisits: MockVisit[] = [
  { date: 'Today', time: '10:30a', kind: 'In progress', tech: 'D. Park', job: 'WO-4203 · RTU-3 no cooling', tone: 'info', live: true },
  { date: 'Sep 22', time: '7:00a', kind: 'Quarterly PM', tech: 'B. Halvorsen', job: 'WO-4180 · 4 RTUs · CT-1', tone: 'success' },
  { date: 'Oct 14', time: '9:00a', kind: 'Annual PM', tech: 'TBD', job: 'Water heaters', tone: 'success' },
  { date: 'Oct 30', time: '8:00a', kind: 'Annual PM', tech: 'TBD', job: 'Boiler · BLR-1', tone: 'success' },
];

// ── Overview: operational activity feed ─────────────────────────────────────
// Backend ask: a location-scoped operational activity feed (tech arrived, job
// opened, equipment flagged…). Distinct from the real NotificationLogsList on
// the Activity tab (notifications, not operations).
export interface MockActivityEvent {
  at: string; // ISO timestamp — rendered via the shared formatTimestamp helper
  glyph: string;
  text: string;
  sub: string;
  tone: MockTone;
}
// Offsets from load so the teaser exercises the hybrid timestamp rule (relative
// under 7 days). The real feed will carry server ISO timestamps in this shape.
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
export const mockActivityFeed: MockActivityEvent[] = [
  { at: ago(12 * MIN), glyph: '→', text: 'Tech D. Park arrived', sub: 'WO-4203 · RTU-3 no cooling', tone: 'info' },
  { at: ago(2 * HOUR), glyph: '+', text: 'Critical job opened · WO-4203', sub: 'RTU-3 no cooling', tone: 'warning' },
  { at: ago(3 * DAY), glyph: '✓', text: 'Visit completed · WO-4144', sub: 'AHU-2 compressor diagnostic · 1.5h', tone: 'success' },
  { at: ago(6 * DAY), glyph: '★', text: 'Equipment baseline updated', sub: 'AHU-2 draw +8% vs Jun baseline · alert set', tone: 'accent' },
];
