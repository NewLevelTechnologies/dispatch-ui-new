import { describe, it, expect } from 'vitest';
import { pluralize, PRESETS, getPreset, ENTITY_GROUP, GROUP_ORDER } from './terminologyPresets';

describe('pluralize', () => {
  it('returns empty for empty input', () => {
    expect(pluralize('')).toBe('');
  });

  it('adds s by default', () => {
    expect(pluralize('Job')).toBe('Jobs');
    expect(pluralize('Cleaner')).toBe('Cleaners');
  });

  it('handles consonant + y → ies', () => {
    expect(pluralize('Property')).toBe('Properties');
    expect(pluralize('City')).toBe('Cities');
  });

  it('keeps vowel + y as -ys', () => {
    expect(pluralize('Day')).toBe('Days');
    expect(pluralize('Key')).toBe('Keys');
  });

  it('adds es after sibilants', () => {
    expect(pluralize('Dispatch')).toBe('Dispatches');
    expect(pluralize('Fix')).toBe('Fixes');
    expect(pluralize('Boss')).toBe('Bosses');
    expect(pluralize('Brush')).toBe('Brushes');
  });

  it('does not pluralize mass nouns', () => {
    expect(pluralize('Equipment')).toBe('Equipment');
    expect(pluralize('Gear')).toBe('Gear');
  });
});

describe('PRESETS', () => {
  it('has 9 presets', () => {
    expect(PRESETS).toHaveLength(9);
  });

  it('HVAC is a no-op preset', () => {
    const hvac = getPreset('hvac');
    expect(hvac.overrides).toEqual({});
  });

  it('Plumbing has the 5 spec-listed overrides', () => {
    const p = getPreset('plumbing');
    expect(p.overrides.work_order).toEqual({ singular: 'Job', plural: 'Jobs' });
    expect(p.overrides.technician).toEqual({ singular: 'Plumber', plural: 'Plumbers' });
    expect(p.overrides.service_location).toEqual({ singular: 'Property', plural: 'Properties' });
    expect(p.overrides.equipment).toEqual({ singular: 'Fixture', plural: 'Fixtures' });
    expect(p.overrides.dispatch).toEqual({ singular: 'Service Call', plural: 'Service Calls' });
  });

  // Two distinct entities sharing a name within one preset (e.g. Work
  // Order and Dispatch both "Visit") is confusing — guard against it.
  it('no two entities collide on a name within a single preset', () => {
    for (const p of PRESETS) {
      const singulars = Object.values(p.overrides).map((o) => o.singular);
      const plurals = Object.values(p.overrides).map((o) => o.plural);
      expect(new Set(singulars).size, `${p.id} has duplicate singular overrides`).toBe(
        singulars.length
      );
      expect(new Set(plurals).size, `${p.id} has duplicate plural overrides`).toBe(
        plurals.length
      );
    }
  });
});

describe('entity grouping', () => {
  it('has all 14 known entities mapped to a group', () => {
    const keys = Object.keys(ENTITY_GROUP);
    expect(keys).toHaveLength(14);
    expect(keys).toContain('equipment_component');
    expect(keys).not.toContain('user');
    expect(keys).not.toContain('role');
  });

  it('every mapped group is in GROUP_ORDER', () => {
    for (const g of Object.values(ENTITY_GROUP)) {
      expect(GROUP_ORDER).toContain(g);
    }
  });
});
