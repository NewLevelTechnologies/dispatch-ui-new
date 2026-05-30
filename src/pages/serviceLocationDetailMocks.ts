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
//   - Equipment health (capacity/age/…/flag) → work-order-service
//   - Upcoming visits                        → scheduling-service
//   - Operational activity feed              → (cross-service feed)
//
// NOTHING IN HERE IS REAL DATA.
// ─────────────────────────────────────────────────────────────────────────

export type MockTone = 'info' | 'warning' | 'success' | 'accent' | 'neutral';

// ── Attention strip detail ──────────────────────────────────────────────────
// Row VISIBILITY is gated on the real location.techOnSite / location.hasOpenJobs
// booleans (see the page). The descriptive detail below — tech name, WO, since,
// open-job counts, PM-overdue, equipment-flagged — still comes from here until
// dispatch / work-order / scheduling services are wired.
export interface MockAttention {
  techOnSite: {
    name: string;
    job: { id: string; title: string };
    since: string;
    eta: string;
  } | null;
  openCritical: number;
  pmOverdueDays: number;
  equipmentFlagged: number;
  equipmentFlaggedDetail: string;
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
  equipmentFlagged: 2,
  equipmentFlaggedDetail:
    'RTU-12 (age 11y, recommend replacement) · AHU-2 (compressor draws 8% over)',
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
  ts: string;
  glyph: string;
  text: string;
  sub: string;
  tone: MockTone;
}
export const mockActivityFeed: MockActivityEvent[] = [
  { ts: '12 min', glyph: '→', text: 'Tech D. Park arrived', sub: 'WO-4203 · RTU-3 no cooling', tone: 'info' },
  { ts: '2 h', glyph: '+', text: 'Critical job opened · WO-4203', sub: 'RTU-3 no cooling', tone: 'warning' },
  { ts: 'Yest', glyph: '◆', text: 'RTU-12 flagged for attention', sub: 'Age 11 y · recommend replacement quote', tone: 'warning' },
  { ts: '3 d', glyph: '✓', text: 'Visit completed · WO-4144', sub: 'AHU-2 compressor diagnostic · 1.5h', tone: 'success' },
  { ts: '6 d', glyph: '★', text: 'Equipment baseline updated', sub: 'AHU-2 draw +8% vs Jun baseline · alert set', tone: 'accent' },
];

// ── Equipment tab: per-unit health columns ──────────────────────────────────
// Backend ask: work-order-service health fields on equipment — capacity, age,
// last service, next PM, warranty, and a derived attention flag. Real equipment
// today carries identity only (name, type, make/model, serial, location-on-site).
export interface MockEquipmentHealth {
  capacity: string;
  ageYrs: number;
  lastSvc: string;
  nextPm: string;
  warranty: string;
  health: 'OK' | 'Attention' | 'In service';
  flag: { tone: 'warning' | 'info'; text: string } | null;
}
const EQUIPMENT_HEALTH_VARIANTS: MockEquipmentHealth[] = [
  { capacity: '5 ton', ageYrs: 6, lastSvc: '2 mo ago', nextPm: 'Sep 22, 2026', warranty: 'Parts thru Mar 2030', health: 'OK', flag: null },
  { capacity: '5 ton', ageYrs: 11, lastSvc: '3 wk ago', nextPm: 'Sep 22, 2026', warranty: 'Expired', health: 'Attention', flag: { tone: 'warning', text: 'Age 11y · recommend replacement quote' } },
  { capacity: '3 ton', ageYrs: 6, lastSvc: '5 mo ago', nextPm: 'Sep 22, 2026', warranty: 'Parts thru Mar 2030', health: 'OK', flag: null },
  { capacity: '199 kBTU', ageYrs: 6, lastSvc: '8 mo ago', nextPm: 'Oct 14, 2026', warranty: 'Tank thru Apr 2032', health: 'OK', flag: null },
  { capacity: '5 ton', ageYrs: 6, lastSvc: '5 mo ago', nextPm: 'Sep 22, 2026', warranty: 'Parts thru Mar 2030', health: 'Attention', flag: { tone: 'warning', text: 'Compressor draws 8% over baseline · investigate' } },
];
// Deterministic by position so a given row is stable across re-renders.
export function mockEquipmentHealth(index: number): MockEquipmentHealth {
  return EQUIPMENT_HEALTH_VARIANTS[index % EQUIPMENT_HEALTH_VARIANTS.length];
}
