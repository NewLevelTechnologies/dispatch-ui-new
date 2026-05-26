// ─────────────────────────────────────────────────────────────────
// terminologyPresets.ts
//
// Industry preset registry for the Terminology settings page.
//
// Presets are static, FE-only. Applying one merges its `overrides` map
// into the page's form state; we never send a preset id to the server
// and never store "tenant.currentPreset". The user can switch presets
// later or hand-tweak any field — see handoff/terminology-redesign.md
// §3 for the rationale.
//
// Backend reconciliation: 13/14 entity keys match the FE display name.
// The "Unit" entity uses wire key `equipment_component` (see backend
// handoff §3). Keys here MUST stay in sync with `EntityCode.kt`.
// ─────────────────────────────────────────────────────────────────
import type { ComponentType, SVGProps } from 'react';
import {
  FireIcon,
  WrenchIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  SunIcon,
  BugAntIcon,
  SparklesIcon,
  ComputerDesktopIcon,
  HomeModernIcon,
} from '@heroicons/react/24/outline';

export type PresetOverride = { singular: string; plural: string };

export type PresetId =
  | 'hvac'
  | 'plumbing'
  | 'electrical'
  | 'appliance'
  | 'landscaping'
  | 'pest'
  | 'cleaning'
  | 'it'
  | 'property';

export interface Preset {
  id: PresetId;
  label: string;
  blurb: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  overrides: Record<string, PresetOverride>;
}

// HVAC is the system default — applying it is a no-op (overrides: {}).
// Kept as a selectable chip so the row "feels" complete and so a tenant
// who has drifted onto another preset can snap back to default with one
// confirm.
export const PRESETS: Preset[] = [
  {
    id: 'hvac',
    label: 'HVAC',
    blurb: 'Service-call vocabulary with equipment-centric language. Matches the system defaults.',
    Icon: FireIcon,
    overrides: {},
  },
  {
    id: 'plumbing',
    label: 'Plumbing',
    blurb: 'Job-based vocabulary with fixtures instead of equipment.',
    Icon: WrenchIcon,
    overrides: {
      work_order: { singular: 'Job', plural: 'Jobs' },
      technician: { singular: 'Plumber', plural: 'Plumbers' },
      service_location: { singular: 'Property', plural: 'Properties' },
      equipment: { singular: 'Fixture', plural: 'Fixtures' },
      dispatch: { singular: 'Service Call', plural: 'Service Calls' },
    },
  },
  {
    id: 'electrical',
    label: 'Electrical',
    blurb: 'Job-based vocabulary tuned for electrical contractors and panel work.',
    Icon: BoltIcon,
    overrides: {
      work_order: { singular: 'Job', plural: 'Jobs' },
      technician: { singular: 'Electrician', plural: 'Electricians' },
      service_location: { singular: 'Site', plural: 'Sites' },
      equipment: { singular: 'Panel', plural: 'Panels' },
      dispatch: { singular: 'Service Call', plural: 'Service Calls' },
    },
  },
  {
    id: 'appliance',
    label: 'Appliance Repair',
    blurb: 'Repair-centric vocabulary for whole-goods service shops.',
    Icon: WrenchScrewdriverIcon,
    overrides: {
      work_order: { singular: 'Repair', plural: 'Repairs' },
      service_location: { singular: 'Home', plural: 'Homes' },
      equipment: { singular: 'Appliance', plural: 'Appliances' },
      dispatch: { singular: 'Service Call', plural: 'Service Calls' },
    },
  },
  {
    id: 'landscaping',
    label: 'Landscaping',
    blurb: 'Visit-based vocabulary for recurring outdoor service crews.',
    Icon: SunIcon,
    overrides: {
      work_order: { singular: 'Visit', plural: 'Visits' },
      technician: { singular: 'Crew Member', plural: 'Crew Members' },
      service_location: { singular: 'Property', plural: 'Properties' },
      dispatch: { singular: 'Visit', plural: 'Visits' },
    },
  },
  {
    id: 'pest',
    label: 'Pest Control',
    blurb: 'Treatment-based vocabulary with account-style customer relationships.',
    Icon: BugAntIcon,
    overrides: {
      customer: { singular: 'Account', plural: 'Accounts' },
      work_order: { singular: 'Treatment', plural: 'Treatments' },
      technician: { singular: 'Specialist', plural: 'Specialists' },
      equipment: { singular: 'Bait Station', plural: 'Bait Stations' },
    },
  },
  {
    id: 'cleaning',
    label: 'Cleaning',
    blurb: 'Cleaning-visit vocabulary for residential and commercial crews.',
    Icon: SparklesIcon,
    overrides: {
      work_order: { singular: 'Cleaning', plural: 'Cleanings' },
      technician: { singular: 'Cleaner', plural: 'Cleaners' },
      service_location: { singular: 'Property', plural: 'Properties' },
      dispatch: { singular: 'Visit', plural: 'Visits' },
    },
  },
  {
    id: 'it',
    label: 'IT Services',
    blurb: 'Ticket-based vocabulary for managed service providers and IT firms.',
    Icon: ComputerDesktopIcon,
    overrides: {
      work_order: { singular: 'Ticket', plural: 'Tickets' },
      technician: { singular: 'Engineer', plural: 'Engineers' },
      service_location: { singular: 'Site', plural: 'Sites' },
      equipment: { singular: 'Device', plural: 'Devices' },
    },
  },
  {
    id: 'property',
    label: 'Property Maintenance',
    blurb: 'Task-based vocabulary for in-house maintenance teams across a property portfolio.',
    Icon: HomeModernIcon,
    overrides: {
      work_order: { singular: 'Task', plural: 'Tasks' },
      technician: { singular: 'Maintenance Tech', plural: 'Maintenance Techs' },
      service_location: { singular: 'Property', plural: 'Properties' },
      equipment: { singular: 'Asset', plural: 'Assets' },
    },
  },
];

export function getPreset(id: PresetId): Preset {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset: ${id}`);
  return p;
}

// English pluralization — covers the common rules used in trade-vocab
// presets. Not exhaustive; the admin always has the override path if our
// guess is wrong. Returns '' on empty input so the placeholder logic can
// fall back to the system default.
export function pluralize(s: string): string {
  if (!s) return '';
  const lower = s.toLowerCase();
  if (['equipment', 'gear', 'staff', 'feedback'].some((w) => lower.endsWith(w))) return s;
  if (s.endsWith('y') && !/[aeiou]y$/i.test(s)) return s.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(s)) return s + 'es';
  return s + 's';
}

// Entity-code → group bucket. Used by the page to render six grouped
// cards instead of one long flat list. The eyebrow labels live in i18n.
export type GroupId = 'customer' | 'work' | 'people' | 'equipment' | 'operations' | 'money';

export const GROUP_ORDER: GroupId[] = [
  'customer',
  'work',
  'people',
  'equipment',
  'operations',
  'money',
];

export const ENTITY_GROUP: Record<string, GroupId> = {
  customer: 'customer',
  service_location: 'customer',
  work_order: 'work',
  work_item: 'work',
  dispatch: 'work',
  schedule: 'work',
  route: 'work',
  technician: 'people',
  equipment: 'equipment',
  equipment_component: 'equipment',
  division: 'operations',
  invoice: 'money',
  quote: 'money',
  payment: 'money',
};
