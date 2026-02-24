/**
 * Comprehensive tests for Kosztorys Import Parsers
 * Tests ATH, JSON, XML parsers and Gemini response converter
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parseAthFile,
  parseJsonFile,
  parseXmlFile,
  convertGeminiResponseToEstimate,
} from '../kosztorysImportParsers';

// =====================================================
// ATH PARSER TESTS — Real file
// =====================================================
describe('parseAthFile — real ATH file', () => {
  const athPath = resolve(__dirname, '../../docs/przedmiar/Kosztorys ślepy.ath');
  const buffer = readFileSync(athPath).buffer;
  const data = parseAthFile(buffer);

  it('returns valid KosztorysCostEstimateData structure', () => {
    expect(data).toHaveProperty('root');
    expect(data).toHaveProperty('sections');
    expect(data).toHaveProperty('positions');
    expect(data.root).toHaveProperty('sectionIds');
    expect(data.root).toHaveProperty('positionIds');
    expect(data.root).toHaveProperty('factors');
    expect(data.root).toHaveProperty('overheads');
  });

  it('parses multiple top-level sections (ELEMENT 1)', () => {
    const sectionCount = data.root.sectionIds.length;
    expect(sectionCount).toBeGreaterThanOrEqual(2);
    console.log(`  Top-level sections: ${sectionCount}`);

    // Log section names for manual verification
    data.root.sectionIds.forEach((id, i) => {
      const sec = data.sections[id];
      console.log(`    [${i + 1}] ${sec.ordinalNumber}. ${sec.name} (${sec.positionIds.length} pos, ${sec.subsectionIds.length} sub)`);
    });
  });

  it('parses subsections (ELEMENT 2) under their parent sections', () => {
    let totalSubs = 0;
    for (const secId of data.root.sectionIds) {
      const sec = data.sections[secId];
      totalSubs += sec.subsectionIds.length;
      for (const subId of sec.subsectionIds) {
        const sub = data.sections[subId];
        expect(sub).toBeDefined();
        expect(sub.name).toBeTruthy();
        expect(sub.ordinalNumber).toContain('.');
      }
    }
    console.log(`  Total subsections: ${totalSubs}`);
    expect(totalSubs).toBeGreaterThan(0);
  });

  it('parses a substantial number of positions', () => {
    const posCount = Object.keys(data.positions).length;
    console.log(`  Total positions: ${posCount}`);
    // The ATH file has ~200+ positions
    expect(posCount).toBeGreaterThanOrEqual(50);
  });

  it('all sections referenced in root exist in sections map', () => {
    for (const id of data.root.sectionIds) {
      expect(data.sections[id]).toBeDefined();
    }
  });

  it('all positions referenced in sections exist in positions map', () => {
    let orphanCount = 0;
    const checkSection = (secId: string) => {
      const sec = data.sections[secId];
      if (!sec) return;
      for (const posId of sec.positionIds) {
        if (!data.positions[posId]) orphanCount++;
        expect(data.positions[posId]).toBeDefined();
      }
      for (const subId of sec.subsectionIds) {
        checkSection(subId);
      }
    };
    data.root.sectionIds.forEach(checkSection);
    expect(orphanCount).toBe(0);
  });

  it('positions have base (KNR) codes', () => {
    const positions = Object.values(data.positions);
    const withBase = positions.filter(p => p.base && p.base.length > 0);
    console.log(`  Positions with KNR base: ${withBase.length}/${positions.length}`);
    // Most positions should have a KNR base
    expect(withBase.length).toBeGreaterThan(positions.length * 0.8);
  });

  it('positions have names', () => {
    const positions = Object.values(data.positions);
    for (const pos of positions) {
      expect(pos.name).toBeTruthy();
      expect(pos.name).not.toBe('Pozycja'); // should not be the default fallback
    }
  });

  it('positions have units', () => {
    const positions = Object.values(data.positions);
    const units = new Set(positions.map(p => p.unit.label));
    console.log(`  Distinct units: ${[...units].join(', ')}`);
    expect(units.size).toBeGreaterThan(0);
  });

  it('positions have measurements (PRZEDMIAR)', () => {
    const positions = Object.values(data.positions);
    const withMeasurements = positions.filter(p => p.measurements.rootIds.length > 0);
    console.log(`  Positions with measurements: ${withMeasurements.length}/${positions.length}`);
    expect(withMeasurements.length).toBeGreaterThan(positions.length * 0.8);
  });

  it('positions have resources (RMS)', () => {
    const positions = Object.values(data.positions);
    const withResources = positions.filter(p => p.resources.length > 0);
    console.log(`  Positions with resources: ${withResources.length}/${positions.length}`);
    expect(withResources.length).toBeGreaterThan(positions.length * 0.5);
  });

  it('resources have correct types (labor/material/equipment)', () => {
    const validTypes = new Set(['labor', 'material', 'equipment']);
    let laborCount = 0, materialCount = 0, equipmentCount = 0;

    for (const pos of Object.values(data.positions)) {
      for (const res of pos.resources) {
        expect(validTypes.has(res.type)).toBe(true);
        if (res.type === 'labor') laborCount++;
        else if (res.type === 'material') materialCount++;
        else if (res.type === 'equipment') equipmentCount++;
      }
    }
    console.log(`  Resources — labor: ${laborCount}, material: ${materialCount}, equipment: ${equipmentCount}`);
    expect(laborCount).toBeGreaterThan(0);
    expect(materialCount).toBeGreaterThan(0);
  });

  it('resources have index for price lookup', () => {
    let withIndex = 0;
    let totalResources = 0;
    for (const pos of Object.values(data.positions)) {
      for (const res of pos.resources) {
        totalResources++;
        if (res.index && res.index.length > 0) withIndex++;
      }
    }
    console.log(`  Resources with price index: ${withIndex}/${totalResources}`);
    // Most resources should have an index from RMS ZEST id field
    expect(withIndex).toBeGreaterThan(totalResources * 0.8);
  });

  it('resources have originIndex set to knr type', () => {
    for (const pos of Object.values(data.positions)) {
      for (const res of pos.resources) {
        if (res.index) {
          expect(res.originIndex.type).toBe('knr');
          expect(res.originIndex.index).toBe(res.index);
        }
      }
    }
  });

  it('resources have norm values', () => {
    let zeroNorms = 0;
    let totalResources = 0;
    for (const pos of Object.values(data.positions)) {
      for (const res of pos.resources) {
        totalResources++;
        if (res.norm.value === 0) zeroNorms++;
      }
    }
    console.log(`  Resources with zero norm: ${zeroNorms}/${totalResources}`);
    // Most resources should have non-zero norms
    expect(zeroNorms).toBeLessThan(totalResources * 0.1);
  });

  it('first section first position matches expected ATH data', () => {
    // From ATH: first ELEMENT 1 has empty name, first POZYCJA is KNR 4-03 0313-10
    const firstSectionId = data.root.sectionIds[0];
    const firstSection = data.sections[firstSectionId];
    expect(firstSection).toBeDefined();

    if (firstSection.positionIds.length > 0) {
      const firstPosId = firstSection.positionIds[0];
      const firstPos = data.positions[firstPosId];
      expect(firstPos).toBeDefined();
      expect(firstPos.base).toContain('KNR');
      console.log(`  First position: ${firstPos.base} — ${firstPos.name}`);
    }
  });

  it('second section (INSTALACJA ELEKTRYCZNA) is parsed correctly', () => {
    // From ATH line 900: na=INSTALACJA ELEKTRYCZNA
    const secNames = data.root.sectionIds.map(id => data.sections[id].name);
    const elecIdx = secNames.findIndex(n => n.includes('ELEKTRYCZN'));
    expect(elecIdx).toBeGreaterThanOrEqual(0);
    console.log(`  Found "INSTALACJA ELEKTRYCZNA" at section index: ${elecIdx + 1}`);

    const elecSection = data.sections[data.root.sectionIds[elecIdx]];
    // Should have subsections (KLATKA I - PIWNICA, etc.)
    console.log(`  Subsections: ${elecSection.subsectionIds.length}`);
    expect(elecSection.subsectionIds.length).toBeGreaterThan(0);

    // Check first subsection
    const firstSub = data.sections[elecSection.subsectionIds[0]];
    expect(firstSub).toBeDefined();
    console.log(`  First subsection: ${firstSub.name}`);
  });

  it('default overheads are set correctly', () => {
    expect(data.root.overheads).toHaveLength(3);
    expect(data.root.overheads[0].name).toContain('pośrednie');
    expect(data.root.overheads[0].value).toBe(65);
    expect(data.root.overheads[1].name).toContain('Zysk');
    expect(data.root.overheads[1].value).toBe(10);
    expect(data.root.overheads[2].name).toContain('zakupu');
    expect(data.root.overheads[2].value).toBe(5);
  });

  it('all IDs are unique', () => {
    const allIds = new Set<string>();
    for (const id of Object.keys(data.sections)) {
      expect(allIds.has(id)).toBe(false);
      allIds.add(id);
    }
    for (const id of Object.keys(data.positions)) {
      expect(allIds.has(id)).toBe(false);
      allIds.add(id);
    }
  });
});

// =====================================================
// ATH PARSER — Synthetic small test
// =====================================================
describe('parseAthFile — synthetic data', () => {
  function makeAthBuffer(content: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(content).buffer;
  }

  it('parses a minimal ATH with one section and one position', () => {
    // Note: synthetic tests use ASCII only since TextEncoder produces UTF-8
    // but parseAthFile decodes as windows-1250. Real ATH files work correctly.
    const ath = `[KOSZTORYS ATHENASOFT]
co=test

[RMS ZEST 1]
ty=R
na=robotnicy\t0
id=999\t1
jm=r-g\t149

[ELEMENT 1]
id=1
na=Sekcja testowa

[POZYCJA]
id=2
pd=\tKNR 1-01 0101-01
na=Pozycja testowa
jm=szt.\t020

[PRZEDMIAR]
wo=5.00\t1\t5

[RMS 1]
nz=0,5\t0\t0,5
`;

    const data = parseAthFile(makeAthBuffer(ath));
    expect(data.root.sectionIds).toHaveLength(1);

    const sec = data.sections[data.root.sectionIds[0]];
    expect(sec.name).toBe('Sekcja testowa');
    expect(sec.positionIds).toHaveLength(1);

    const pos = data.positions[sec.positionIds[0]];
    expect(pos.base).toBe('KNR 1-01 0101-01');
    expect(pos.name).toBe('Pozycja testowa');
    expect(pos.unit.label).toBe('szt.');
    expect(pos.measurements.rootIds).toHaveLength(1);

    // Check measurement value
    const measId = pos.measurements.rootIds[0];
    expect(pos.measurements.entries[measId].expression).toBe('5.00');

    // Check resource
    expect(pos.resources).toHaveLength(1);
    expect(pos.resources[0].type).toBe('labor');
    expect(pos.resources[0].name).toBe('robotnicy');
    expect(pos.resources[0].norm.value).toBeCloseTo(0.5);
  });

  it('handles ELEMENT 2 subsections correctly', () => {
    const ath = `[KOSZTORYS ATHENASOFT]
co=test

[ELEMENT 1]
id=1
na=Sekcja A

[ELEMENT 2]
id=2
na=Podsekcja B

[POZYCJA]
id=3
pd=\tKNR 1-01 0101-01
na=Pozycja w podsekcji
jm=m\t040

[PRZEDMIAR]
wo=10.00\t1\t10
`;

    const data = parseAthFile(makeAthBuffer(ath));
    const mainSection = data.sections[data.root.sectionIds[0]];
    expect(mainSection.name).toBe('Sekcja A');
    expect(mainSection.subsectionIds).toHaveLength(1);

    const sub = data.sections[mainSection.subsectionIds[0]];
    expect(sub.name).toBe('Podsekcja B');
    expect(sub.ordinalNumber).toBe('1.1');
    expect(sub.positionIds).toHaveLength(1);

    const pos = data.positions[sub.positionIds[0]];
    expect(pos.name).toBe('Pozycja w podsekcji');
  });

  it('handles positions without section (root-level)', () => {
    const ath = `[KOSZTORYS ATHENASOFT]
co=test

[POZYCJA]
id=1
pd=\tKNR 1-01 0101-01
na=Pozycja bez dzialu
jm=szt.\t020

[PRZEDMIAR]
wo=1.00\t1\t1
`;

    const data = parseAthFile(makeAthBuffer(ath));
    expect(data.root.positionIds).toHaveLength(1);
    expect(data.root.sectionIds).toHaveLength(0);
  });

  it('handles Polish number format with commas', () => {
    const ath = `[KOSZTORYS ATHENASOFT]
co=test

[RMS ZEST 1]
ty=M
na=materiał\t0
id=123\t1
jm=kg\t034
il=1216,63007

[ELEMENT 1]
id=1
na=Test

[POZYCJA]
id=2
pd=\tKNR 1-01 0101-01
na=Test pozycja
jm=m2\t030

[PRZEDMIAR]
wo=12,50\t1\t12,5

[RMS 1]
nz=0,798\t0\t0,798
`;

    const data = parseAthFile(makeAthBuffer(ath));
    const sec = data.sections[data.root.sectionIds[0]];
    const pos = data.positions[sec.positionIds[0]];

    // Measurement should parse comma-formatted numbers
    const measId = pos.measurements.rootIds[0];
    expect(pos.measurements.entries[measId].expression).toBe('12.50');

    // Resource norm should parse comma-formatted numbers
    expect(pos.resources[0].norm.value).toBeCloseTo(0.798);
  });

  it('handles MNOŻNIKI RMS factors', () => {
    const ath = `[KOSZTORYS ATHENASOFT]
co=test

[RMS ZEST 1]
ty=R
na=robotnicy\t0
id=999\t1
jm=r-g\t149

[ELEMENT 1]
id=1
na=Test

[MNOŻNIKI RMS]
wr=0,955\t\t
wm=1\t\t
ws=1\t\t

[POZYCJA]
id=2
pd=\tKNR 1-01 0101-01
na=Test pozycja
jm=szt.\t020

[RMS 1]
nz=1,00\t0\t1,00
`;

    const data = parseAthFile(makeAthBuffer(ath));
    const sec = data.sections[data.root.sectionIds[0]];
    const pos = data.positions[sec.positionIds[0]];

    // Resource should have factor 0.955 from MNOŻNIKI RMS
    expect(pos.resources[0].factor).toBeCloseTo(0.955);
  });

  it('handles np=1 percentage resources correctly', () => {
    const ath = `[KOSZTORYS ATHENASOFT]
co=test

[RMS ZEST 1]
ty=M
na=materiały pomocnicze\t0
id=000\t1
jm=%\t147

[ELEMENT 1]
id=1
na=Test

[POZYCJA]
id=2
pd=\tKNR 1-01 0101-01
na=Test
jm=szt.\t020

[RMS 1]
nz=4\t0\t4
np=1
op=
`;

    const data = parseAthFile(makeAthBuffer(ath));
    const sec = data.sections[data.root.sectionIds[0]];
    const pos = data.positions[sec.positionIds[0]];

    expect(pos.resources[0].norm.type).toBe('relative');
    expect(pos.resources[0].norm.value).toBe(4);
  });
});

// =====================================================
// JSON PARSER TESTS
// =====================================================
describe('parseJsonFile', () => {
  it('parses valid JSON with full structure', () => {
    const json = JSON.stringify({
      root: {
        sectionIds: ['s1'],
        positionIds: [],
        factors: { labor: 1, material: 1, equipment: 1 },
        overheads: [],
      },
      sections: {
        s1: {
          id: 's1',
          name: 'Dział 1',
          ordinalNumber: '1',
          positionIds: ['p1'],
          subsectionIds: [],
        },
      },
      positions: {
        p1: {
          id: 'p1',
          base: 'KNR 1-01',
          name: 'Pozycja testowa',
          unit: { label: 'szt.', unitIndex: '020' },
          resources: [],
        },
      },
    });

    const data = parseJsonFile(json);
    expect(data.root.sectionIds).toHaveLength(1);
    expect(data.sections.s1.name).toBe('Dział 1');
    expect(data.positions.p1.name).toBe('Pozycja testowa');
  });

  it('fills defaults for missing fields', () => {
    const json = JSON.stringify({
      root: { sectionIds: ['s1'] },
      sections: {
        s1: { id: 's1', positionIds: ['p1'] },
      },
      positions: {
        p1: { id: 'p1' },
      },
    });

    const data = parseJsonFile(json);
    // Section should have defaults
    expect(data.sections.s1.name).toBe('Dział');
    expect(data.sections.s1.description).toBe('');
    expect(data.sections.s1.subsectionIds).toEqual([]);

    // Position should have defaults
    expect(data.positions.p1.name).toBe('Pozycja');
    expect(data.positions.p1.unit).toEqual({ label: 'szt.', unitIndex: '020' });
    expect(data.positions.p1.multiplicationFactor).toBe(1);
  });

  it('throws on invalid structure (missing root)', () => {
    expect(() => parseJsonFile(JSON.stringify({ sections: {}, positions: {} }))).toThrow();
  });

  it('throws on invalid structure (missing sections)', () => {
    expect(() => parseJsonFile(JSON.stringify({ root: {}, positions: {} }))).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJsonFile('not json')).toThrow();
  });

  it('sets default overheads when not provided', () => {
    const json = JSON.stringify({
      root: { sectionIds: [] },
      sections: {},
      positions: {},
    });

    const data = parseJsonFile(json);
    expect(data.root.overheads).toHaveLength(3);
    expect(data.root.overheads[0].value).toBe(65);
  });
});

// =====================================================
// XML PARSER TESTS
// =====================================================
describe('parseXmlFile', () => {
  it('parses XML with Dzial/Pozycja structure', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Kosztorys>
  <Dzial nazwa="Roboty budowlane" numer="1">
    <Pozycja podstawa="KNR 2-02 0101-01" nazwa="Wykopy" jednostka="m3" ilosc="25.5">
      <Naklad typ="R" nazwa="robotnicy" norma="1.5" />
      <Naklad typ="M" nazwa="cement" norma="0.05" />
    </Pozycja>
    <Pozycja podstawa="KNR 2-02 0102-01" nazwa="Zasypki" jednostka="m3" ilosc="10">
    </Pozycja>
  </Dzial>
  <Dzial nazwa="Instalacje" numer="2">
    <Pozycja podstawa="KNNR 5 0301-01" nazwa="Przewody" jednostka="m" ilosc="100" />
  </Dzial>
</Kosztorys>`;

    const data = parseXmlFile(xml);
    expect(data.root.sectionIds).toHaveLength(2);

    const sec1 = data.sections[data.root.sectionIds[0]];
    expect(sec1.name).toBe('Roboty budowlane');
    expect(sec1.positionIds).toHaveLength(2);

    const pos1 = data.positions[sec1.positionIds[0]];
    expect(pos1.base).toBe('KNR 2-02 0101-01');
    expect(pos1.name).toBe('Wykopy');
    expect(pos1.unit.label).toBe('m3');
    expect(pos1.measurements.rootIds).toHaveLength(1);
    expect(pos1.resources).toHaveLength(2);
    expect(pos1.resources[0].type).toBe('labor');
    expect(pos1.resources[1].type).toBe('material');
  });

  it('parses XML with nested Element structure', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Kosztorys>
  <Element nazwa="Dział główny" numer="1">
    <Pozycja nazwa="Poz 1" jednostka="szt." ilosc="5" />
  </Element>
</Kosztorys>`;

    const data = parseXmlFile(xml);
    expect(data.root.sectionIds).toHaveLength(1);
    const sec = data.sections[data.root.sectionIds[0]];
    expect(sec.name).toBe('Dział główny');
    expect(sec.positionIds).toHaveLength(1);
  });

  it('parses XML with child elements (Nazwa, etc.)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Kosztorys>
  <Dzial>
    <Nazwa>Roboty ziemne</Nazwa>
    <Pozycja>
      <Podstawa>KNR 2-01</Podstawa>
      <Nazwa>Wykop</Nazwa>
      <Jednostka>m3</Jednostka>
      <Ilosc>50</Ilosc>
    </Pozycja>
  </Dzial>
</Kosztorys>`;

    const data = parseXmlFile(xml);
    const sec = data.sections[data.root.sectionIds[0]];
    expect(sec.name).toBe('Roboty ziemne');
    const pos = data.positions[sec.positionIds[0]];
    expect(pos.base).toBe('KNR 2-01');
    expect(pos.name).toBe('Wykop');
  });

  it('throws on invalid XML', () => {
    expect(() => parseXmlFile('not xml at all <>')).toThrow();
  });

  it('throws on XML with no sections or positions', () => {
    const xml = `<?xml version="1.0"?><Root><Something>nothing</Something></Root>`;
    expect(() => parseXmlFile(xml)).toThrow('Nie znaleziono');
  });

  it('handles Polish number format in quantities', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Kosztorys>
  <Dzial nazwa="Test" numer="1">
    <Pozycja nazwa="Test" jednostka="m2" ilosc="12,5" />
  </Dzial>
</Kosztorys>`;

    const data = parseXmlFile(xml);
    const pos = data.positions[Object.keys(data.positions)[0]];
    const measId = pos.measurements.rootIds[0];
    expect(pos.measurements.entries[measId].expression).toBe('12.5');
  });
});

// =====================================================
// GEMINI RESPONSE CONVERTER TESTS
// =====================================================
describe('convertGeminiResponseToEstimate', () => {
  it('converts a full Gemini response with sections, positions, resources', () => {
    const geminiData = {
      title: 'Kosztorys testowy',
      sections: [
        {
          name: 'Roboty budowlane',
          ordinal: '1',
          positions: [
            {
              base: 'KNR 2-02 0101-01',
              name: 'Wykopy',
              unit: 'm3',
              quantity: 25.5,
              resources: [
                { type: 'labor', name: 'robotnicy', norm: 1.5, unit: 'r-g' },
                { type: 'material', name: 'cement', norm: 0.05, unit: 'kg' },
              ],
            },
            {
              base: 'KNR 2-02 0102-01',
              name: 'Zasypki',
              unit: 'm3',
              quantity: 10,
              resources: [],
            },
          ],
        },
        {
          name: 'Instalacje',
          ordinal: '2',
          subsections: [
            {
              name: 'Elektryka',
              ordinal: '2.1',
              positions: [
                {
                  base: 'KNNR 5 0301-01',
                  name: 'Przewody',
                  unit: 'm',
                  quantity: 100,
                  resources: [
                    { type: 'labor', name: 'elektromonterzy', norm: 0.264 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const data = convertGeminiResponseToEstimate(geminiData);

    // Check structure
    expect(data.root.sectionIds).toHaveLength(2);
    expect(Object.keys(data.positions)).toHaveLength(3);

    // Section 1
    const sec1 = data.sections[data.root.sectionIds[0]];
    expect(sec1.name).toBe('Roboty budowlane');
    expect(sec1.positionIds).toHaveLength(2);

    // Position 1 in section 1
    const pos1 = data.positions[sec1.positionIds[0]];
    expect(pos1.base).toBe('KNR 2-02 0101-01');
    expect(pos1.name).toBe('Wykopy');
    expect(pos1.unit.label).toBe('m3');
    expect(pos1.measurements.rootIds).toHaveLength(1);
    expect(pos1.resources).toHaveLength(2);
    expect(pos1.resources[0].type).toBe('labor');
    expect(pos1.resources[0].norm.value).toBeCloseTo(1.5);

    // Section 2 with subsection
    const sec2 = data.sections[data.root.sectionIds[1]];
    expect(sec2.name).toBe('Instalacje');
    expect(sec2.subsectionIds).toHaveLength(1);

    const sub = data.sections[sec2.subsectionIds[0]];
    expect(sub.name).toBe('Elektryka');
    expect(sub.positionIds).toHaveLength(1);
  });

  it('handles empty sections array', () => {
    const data = convertGeminiResponseToEstimate({ sections: [] });
    expect(data.root.sectionIds).toHaveLength(0);
    expect(Object.keys(data.positions)).toHaveLength(0);
  });

  it('handles missing optional fields', () => {
    const data = convertGeminiResponseToEstimate({
      sections: [
        {
          name: 'Test',
          positions: [
            { name: 'Pozycja bez opcji' },
          ],
        },
      ],
    });

    const pos = data.positions[Object.keys(data.positions)[0]];
    expect(pos.name).toBe('Pozycja bez opcji');
    expect(pos.base).toBe('');
    expect(pos.unit.label).toBe('szt.');
    expect(pos.measurements.rootIds).toHaveLength(0); // no quantity
    expect(pos.resources).toHaveLength(0);
  });

  it('maps resource types correctly from various formats', () => {
    const data = convertGeminiResponseToEstimate({
      sections: [
        {
          name: 'Test',
          positions: [
            {
              name: 'Poz',
              quantity: 1,
              resources: [
                { type: 'labor', name: 'R1', norm: 1 },
                { type: 'R', name: 'R2', norm: 1 },
                { type: 'robocizna', name: 'R3', norm: 1 },
                { type: 'material', name: 'M1', norm: 1 },
                { type: 'M', name: 'M2', norm: 1 },
                { type: 'equipment', name: 'S1', norm: 1 },
                { type: 'S', name: 'S2', norm: 1 },
                { type: 'sprzęt', name: 'S3', norm: 1 },
              ],
            },
          ],
        },
      ],
    });

    const pos = data.positions[Object.keys(data.positions)[0]];
    expect(pos.resources[0].type).toBe('labor');
    expect(pos.resources[1].type).toBe('labor');
    expect(pos.resources[2].type).toBe('labor');
    expect(pos.resources[3].type).toBe('material');
    expect(pos.resources[4].type).toBe('material');
    expect(pos.resources[5].type).toBe('equipment');
    expect(pos.resources[6].type).toBe('equipment');
    expect(pos.resources[7].type).toBe('equipment');
  });

  it('sets default overheads', () => {
    const data = convertGeminiResponseToEstimate({ sections: [] });
    expect(data.root.overheads).toHaveLength(3);
  });
});

// =====================================================
// INTEGRATION: Full pipeline simulation
// =====================================================
describe('Integration — full import pipeline', () => {
  it('ATH import produces data compatible with KosztorysEditor state', () => {
    const athPath = resolve(__dirname, '../../docs/przedmiar/Kosztorys ślepy.ath');
    const buffer = readFileSync(athPath).buffer;
    const data = parseAthFile(buffer);

    // Simulate what KosztorysEditor does after import
    const sectionCount = Object.keys(data.sections).length;
    const positionCount = Object.keys(data.positions).length;

    // Must not be empty
    expect(sectionCount).toBeGreaterThan(0);
    expect(positionCount).toBeGreaterThan(0);

    // All section IDs in root must exist
    for (const id of data.root.sectionIds) {
      expect(data.sections[id]).toBeDefined();
    }

    // All subsection IDs must exist
    for (const sec of Object.values(data.sections)) {
      for (const subId of sec.subsectionIds) {
        expect(data.sections[subId]).toBeDefined();
      }
    }

    // All position IDs referenced in sections must exist
    for (const sec of Object.values(data.sections)) {
      for (const posId of sec.positionIds) {
        expect(data.positions[posId]).toBeDefined();
      }
    }

    // Expand all sections (simulate setEditorState)
    const allSectionIds = Object.keys(data.sections);
    const expandedSections = new Set(allSectionIds);
    expect(expandedSections.size).toBe(sectionCount);

    console.log(`\n  FULL IMPORT SUMMARY:`);
    console.log(`  Sections (total): ${sectionCount}`);
    console.log(`  Top-level sections: ${data.root.sectionIds.length}`);
    console.log(`  Positions: ${positionCount}`);
    console.log(`  Root positions (no section): ${data.root.positionIds.length}`);

    // Count resources
    let totalResources = 0;
    let totalMeasurements = 0;
    for (const pos of Object.values(data.positions)) {
      totalResources += pos.resources.length;
      totalMeasurements += pos.measurements.rootIds.length;
    }
    console.log(`  Resources: ${totalResources}`);
    console.log(`  Measurements: ${totalMeasurements}`);
  });

  it('ATH base codes match KNR database format (uzupełnij nakłady compatibility)', () => {
    const athPath = resolve(__dirname, '../../docs/przedmiar/Kosztorys ślepy.ath');
    const buffer = readFileSync(athPath).buffer;
    const data = parseAthFile(buffer);

    // Load KNR positions CSV to validate base code format
    const csvPath = resolve(__dirname, '../../docs/KNR/ALL_positions_20260219_234216.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const dbBasisCodes = new Set(
      csvContent.split('\n').slice(1).map(line => {
        const cols = line.split(',');
        return cols[2]?.trim(); // basis column
      }).filter(Boolean)
    );

    // Check which ATH base codes match database
    const uniqueBases = [...new Set(
      Object.values(data.positions).map(p => p.base?.trim()).filter(Boolean)
    )];

    let matched = 0;
    let unmatched = 0;
    const unmatchedCodes: string[] = [];

    for (const base of uniqueBases) {
      if (dbBasisCodes.has(base)) {
        matched++;
      } else {
        unmatched++;
        unmatchedCodes.push(base);
      }
    }

    console.log(`\n  KNR BASE CODE MATCHING:`);
    console.log(`  Unique base codes: ${uniqueBases.length}`);
    console.log(`  Matched in DB: ${matched}/${uniqueBases.length} (${Math.round(matched / uniqueBases.length * 100)}%)`);
    if (unmatchedCodes.length > 0) {
      console.log(`  Unmatched: ${unmatchedCodes.join(', ')}`);
    }

    // At least 70% should match (some catalogs may not be in the export)
    expect(matched).toBeGreaterThan(uniqueBases.length * 0.7);

    // Base code format validation:
    // Most codes should match KNR pattern, some may be custom ("Analiza własna", etc.)
    let knrFormatCount = 0;
    let customCount = 0;
    for (const base of uniqueBases) {
      expect(base.length).toBeGreaterThan(3);
      if (/^(KNR|KNNR|KNR-W|KSNR|KNP|KNR AL|KNR AT|E-)/.test(base)) {
        knrFormatCount++;
      } else {
        customCount++;
        console.log(`  Custom (non-KNR) base: "${base}"`);
      }
    }
    console.log(`  KNR format: ${knrFormatCount}, Custom: ${customCount}`);
    // Most should be KNR format
    expect(knrFormatCount).toBeGreaterThan(uniqueBases.length * 0.8);
  });

  it('imported positions are compatible with handleUzupelnijNaklady flow', () => {
    const athPath = resolve(__dirname, '../../docs/przedmiar/Kosztorys ślepy.ath');
    const buffer = readFileSync(athPath).buffer;
    const data = parseAthFile(buffer);

    // Simulate handleUzupelnijNaklady logic
    // Step 1: Get positions with base codes
    const positionsWithBase = Object.values(data.positions).filter(
      pos => pos.base && pos.base.trim()
    );
    expect(positionsWithBase.length).toBe(Object.keys(data.positions).length);
    console.log(`\n  UZUPEŁNIJ NAKŁADY SIMULATION:`);
    console.log(`  Positions with KNR base: ${positionsWithBase.length}/${Object.keys(data.positions).length}`);

    // Step 2: Get unique base codes (this is what goes to .in('basis', baseCodes))
    const baseCodes = [...new Set(positionsWithBase.map(p => p.base?.trim()))].filter(Boolean);
    console.log(`  Unique KNR codes to query: ${baseCodes.length}`);

    // Step 3: Simulate matching (in real app this queries knr_positions table)
    // After uzupełnij, each position would get resources with index and originIndex
    // Verify the data structure supports this:
    for (const pos of Object.values(data.positions)) {
      // resources array must exist and be mutable
      expect(Array.isArray(pos.resources)).toBe(true);
      // In replace mode, resources would be cleared and replaced
      // In missing mode, existing resources would be checked by name/type
      for (const res of pos.resources) {
        expect(res.type).toMatch(/^(labor|material|equipment)$/);
        expect(typeof res.name).toBe('string');
        expect(typeof res.norm.value).toBe('number');
      }
    }
  });

  it('imported resources are compatible with handleApplyPrices flow', () => {
    const athPath = resolve(__dirname, '../../docs/przedmiar/Kosztorys ślepy.ath');
    const buffer = readFileSync(athPath).buffer;
    const data = parseAthFile(buffer);

    // Simulate handleApplyPrices logic on imported data
    // After uzupelnij nakłady, resources would have index set.
    // But even WITHOUT uzupelnij, prices can be searched by name (searchByNameWhenNoIndex)
    let resourcesWithIndex = 0;
    let resourcesWithName = 0;
    let resourcesWithUnitPrice = 0;

    for (const pos of Object.values(data.positions)) {
      for (const res of pos.resources) {
        // Check structure compatibility
        expect(res.unitPrice).toBeDefined();
        expect(typeof res.unitPrice.value).toBe('number');
        expect(res.unitPrice.currency).toBe('PLN');

        if (res.index || res.originIndex?.index) resourcesWithIndex++;
        if (res.name && res.name.length > 0) resourcesWithName++;
        if (res.unitPrice.value > 0) resourcesWithUnitPrice++;
      }
    }

    console.log(`\n  WSTAW CENY COMPATIBILITY:`);
    console.log(`  Resources with index (direct price lookup): ${resourcesWithIndex}`);
    console.log(`  Resources with name (name-based lookup): ${resourcesWithName}`);
    console.log(`  Resources with pre-set prices: ${resourcesWithUnitPrice}`);
    console.log(`  → After "Uzupełnij nakłady" from KNR DB, all resources will get index for price lookup`);
    console.log(`  → "Wstaw ceny" can also search by name for ATH resources (enable searchByNameWhenNoIndex)`);

    // All resources should have names for fallback name-based price search
    const totalResources = Object.values(data.positions).reduce((sum, p) => sum + p.resources.length, 0);
    expect(resourcesWithName).toBe(totalResources);
  });

  it('imported data supports full calculate flow', () => {
    const athPath = resolve(__dirname, '../../docs/przedmiar/Kosztorys ślepy.ath');
    const buffer = readFileSync(athPath).buffer;
    const data = parseAthFile(buffer);

    // Verify all positions can be calculated
    for (const pos of Object.values(data.positions)) {
      // Must have valid measurements for quantity calculation
      expect(pos.measurements).toBeDefined();
      expect(pos.measurements.rootIds).toBeDefined();
      expect(pos.measurements.entries).toBeDefined();

      for (const measId of pos.measurements.rootIds) {
        const entry = pos.measurements.entries[measId];
        expect(entry).toBeDefined();
        expect(entry.expression).toBeTruthy();
        // Expression should be a valid number
        const val = parseFloat(entry.expression);
        expect(isNaN(val)).toBe(false);
        expect(val).toBeGreaterThan(0);
      }

      // Must have multiplicationFactor
      expect(typeof pos.multiplicationFactor).toBe('number');
      expect(pos.multiplicationFactor).toBe(1); // default from import

      // Must have factors
      expect(pos.factors).toBeDefined();

      // Must have overheads array
      expect(Array.isArray(pos.overheads)).toBe(true);
    }
  });
});

// =====================================================
// NEW ATH FILES — Full import pipeline tests
// =====================================================

/**
 * Helper: run full import verification on parsed data
 */
function verifyImportedData(
  data: ReturnType<typeof parseAthFile>,
  label: string,
  expectations: {
    minSections: number;
    minPositions: number;
    minResources: number;
    minMeasurements: number;
    checkKnrCodes?: boolean;
  }
) {
  const sectionCount = Object.keys(data.sections).length;
  const positionCount = Object.keys(data.positions).length;
  let totalResources = 0;
  let totalMeasurements = 0;
  const uniqueBases = new Set<string>();

  for (const pos of Object.values(data.positions)) {
    totalResources += pos.resources.length;
    totalMeasurements += pos.measurements.rootIds.length;
    if (pos.base && pos.base.trim()) uniqueBases.add(pos.base.trim());
  }

  console.log(`\n  ${label}:`);
  console.log(`    Sections: ${sectionCount} (top: ${data.root.sectionIds.length})`);
  console.log(`    Positions: ${positionCount}`);
  console.log(`    Resources: ${totalResources}`);
  console.log(`    Measurements: ${totalMeasurements}`);
  console.log(`    Unique base codes: ${uniqueBases.size}`);
  if (uniqueBases.size > 0) {
    console.log(`    Sample bases: ${[...uniqueBases].slice(0, 5).join(', ')}`);
  }

  return { sectionCount, positionCount, totalResources, totalMeasurements, uniqueBases };
}

describe('parseAthFile — kosztorys budowlany.ath (new format, KNR/KNR-W in separate field)', () => {
  const athPath = resolve(__dirname, '../../docs/przedmiar/new/kosztorys budowlany.ath');
  const buffer = readFileSync(athPath).buffer;
  const data = parseAthFile(buffer);

  it('parses valid structure with sections and positions', () => {
    const result = verifyImportedData(data, 'kosztorys budowlany.ath', {
      minSections: 4,
      minPositions: 100,
      minResources: 100,
      minMeasurements: 100,
    });
    expect(result.sectionCount).toBeGreaterThanOrEqual(4);
    expect(result.positionCount).toBeGreaterThanOrEqual(100);
    expect(result.totalResources).toBeGreaterThan(100);
    expect(result.totalMeasurements).toBeGreaterThan(100);
  });

  it('has 4 top-level sections and 18 subsections', () => {
    expect(data.root.sectionIds.length).toBe(4);
    let totalSubs = 0;
    for (const secId of data.root.sectionIds) {
      totalSubs += data.sections[secId].subsectionIds.length;
    }
    expect(totalSubs).toBe(18);
  });

  it('has 169 positions', () => {
    expect(Object.keys(data.positions).length).toBe(169);
  });

  it('correctly parses KNR base codes from new pd= format (type+number in separate fields)', () => {
    const positions = Object.values(data.positions);
    const baseCodes = positions.map(p => p.base).filter(Boolean);

    // Check format: should be "KNR X-XX XXXX-XX", "KNR-W X-XX", "NNRNKB XXX" etc.
    const knrPattern = /^(KNR|KNR-W|KNNR|KSNR|NNRNKB) /;
    const withKnr = baseCodes.filter(b => knrPattern.test(b));
    console.log(`    KNR/catalog format codes: ${withKnr.length}/${baseCodes.length}`);
    // Some positions may have special bases like "działu" (1-2 entries)
    expect(withKnr.length).toBeGreaterThanOrEqual(baseCodes.length - 2);

    // Should NOT contain source text like "ORGBUD" in base
    for (const base of baseCodes) {
      expect(base).not.toContain('ORGBUD');
      expect(base).not.toContain('WACETOB');
      expect(base).not.toContain('wyd.');
    }
  });

  it('base codes match KNR database for uzupełnij nakłady', () => {
    const csvPath = resolve(__dirname, '../../docs/KNR/ALL_positions_20260219_234216.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const dbBasisCodes = new Set(
      csvContent.split('\n').slice(1).map(line => line.split(',')[2]?.trim()).filter(Boolean)
    );

    const uniqueBases = [...new Set(
      Object.values(data.positions).map(p => p.base?.trim()).filter(Boolean)
    )];

    let matched = 0;
    const unmatched: string[] = [];
    for (const base of uniqueBases) {
      if (dbBasisCodes.has(base)) matched++;
      else unmatched.push(base);
    }

    console.log(`    DB match: ${matched}/${uniqueBases.length} (${Math.round(matched / uniqueBases.length * 100)}%)`);
    if (unmatched.length > 0) console.log(`    Unmatched: ${unmatched.join(', ')}`);

    // Expect high match rate for standard KNR 2-01, 2-02 codes
    expect(matched).toBeGreaterThan(uniqueBases.length * 0.7);
  });

  it('resources have correct types and norms', () => {
    let laborCount = 0, materialCount = 0, equipmentCount = 0;
    for (const pos of Object.values(data.positions)) {
      for (const res of pos.resources) {
        expect(['labor', 'material', 'equipment']).toContain(res.type);
        if (res.type === 'labor') laborCount++;
        else if (res.type === 'material') materialCount++;
        else equipmentCount++;
      }
    }
    console.log(`    R: ${laborCount}, M: ${materialCount}, S: ${equipmentCount}`);
    expect(laborCount).toBeGreaterThan(0);
    expect(materialCount).toBeGreaterThan(0);
  });

  it('data structure is compatible with editor state', () => {
    // All referenced IDs exist
    for (const secId of data.root.sectionIds) {
      expect(data.sections[secId]).toBeDefined();
      for (const subId of data.sections[secId].subsectionIds) {
        expect(data.sections[subId]).toBeDefined();
      }
    }
    for (const sec of Object.values(data.sections)) {
      for (const posId of sec.positionIds) {
        expect(data.positions[posId]).toBeDefined();
      }
    }
    // Overheads and factors present
    expect(data.root.overheads).toHaveLength(3);
    expect(data.root.factors).toBeDefined();
  });
});

describe('parseAthFile — przedm_elektr.ath (simple numeric base codes)', () => {
  const athPath = resolve(__dirname, '../../docs/przedmiar/new/przedm_elektr.ath');
  const buffer = readFileSync(athPath).buffer;
  const data = parseAthFile(buffer);

  it('parses valid structure', () => {
    const result = verifyImportedData(data, 'przedm_elektr.ath', {
      minSections: 1,
      minPositions: 10,
      minResources: 0,
      minMeasurements: 10,
    });
    expect(result.sectionCount).toBeGreaterThanOrEqual(1);
    expect(result.positionCount).toBeGreaterThan(10);
  });

  it('has 6 top-level sections', () => {
    expect(data.root.sectionIds.length).toBe(6);
  });

  it('has 36 positions', () => {
    expect(Object.keys(data.positions).length).toBe(36);
  });

  it('base codes are simple numeric (not KNR format)', () => {
    const bases = Object.values(data.positions).map(p => p.base).filter(Boolean);
    // Should have simple numbering like "1.1", "2.3" etc.
    const simpleNumeric = bases.filter(b => /^\d+\.\d+$/.test(b));
    console.log(`    Simple numeric bases: ${simpleNumeric.length}/${bases.length}`);
    console.log(`    Sample: ${bases.slice(0, 5).join(', ')}`);
    expect(simpleNumeric.length).toBe(bases.length);
    // Should NOT contain "ORGBUD" or duplicate numbers
    for (const base of bases) {
      expect(base).not.toContain(' ');
    }
  });

  it('has resources parsed from RMS sections', () => {
    const withResources = Object.values(data.positions).filter(p => p.resources.length > 0);
    console.log(`    Positions with resources: ${withResources.length}/${Object.keys(data.positions).length}`);
    expect(withResources.length).toBeGreaterThan(0);
  });

  it('positions have measurements', () => {
    const withMeasurements = Object.values(data.positions).filter(p => p.measurements.rootIds.length > 0);
    expect(withMeasurements.length).toBeGreaterThan(Object.keys(data.positions).length * 0.8);
  });
});

describe('parseAthFile — Przedmiar przyłącza.ath (KNR-W codes, compound codes)', () => {
  const athPath = resolve(__dirname, '../../docs/przedmiar/new/Przedmiar - przyłącza (1).ath');
  const buffer = readFileSync(athPath).buffer;
  const data = parseAthFile(buffer);

  it('parses valid structure', () => {
    const result = verifyImportedData(data, 'Przedmiar - przyłącza (1).ath', {
      minSections: 3,
      minPositions: 30,
      minResources: 50,
      minMeasurements: 30,
    });
    expect(result.sectionCount).toBeGreaterThanOrEqual(3);
    expect(result.positionCount).toBe(34);
  });

  it('has 3 top-level sections', () => {
    expect(data.root.sectionIds.length).toBe(3);
  });

  it('correctly parses KNR and KNR-W base codes', () => {
    const bases = Object.values(data.positions).map(p => p.base).filter(Boolean);
    const knrBases = bases.filter(b => /^(KNR|KNR-W)/.test(b));
    console.log(`    KNR/KNR-W bases: ${knrBases.length}/${bases.length}`);
    console.log(`    Sample: ${knrBases.slice(0, 5).join(', ')}`);
    expect(knrBases.length).toBe(bases.length);

    // Should NOT contain source descriptions
    for (const base of bases) {
      expect(base).not.toContain('ORGBUD');
      expect(base).not.toContain('WACETOB');
    }

    // Should have both KNR and KNR-W
    const knr = bases.filter(b => b.startsWith('KNR '));
    const knrW = bases.filter(b => b.startsWith('KNR-W'));
    console.log(`    KNR: ${knr.length}, KNR-W: ${knrW.length}`);
    expect(knr.length).toBeGreaterThan(0);
    expect(knrW.length).toBeGreaterThan(0);
  });

  it('base codes match KNR database', () => {
    const csvPath = resolve(__dirname, '../../docs/KNR/ALL_positions_20260219_234216.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const dbBasisCodes = new Set(
      csvContent.split('\n').slice(1).map(line => line.split(',')[2]?.trim()).filter(Boolean)
    );

    const uniqueBases = [...new Set(
      Object.values(data.positions).map(p => p.base?.trim()).filter(Boolean)
    )];

    let matched = 0;
    const unmatched: string[] = [];
    for (const base of uniqueBases) {
      if (dbBasisCodes.has(base)) matched++;
      else unmatched.push(base);
    }

    console.log(`    DB match: ${matched}/${uniqueBases.length}`);
    if (unmatched.length > 0) console.log(`    Unmatched: ${unmatched.join(', ')}`);
    // Some compound codes (0212-05 0214-04) won't match, that's expected
    expect(matched).toBeGreaterThan(uniqueBases.length * 0.5);
  });

  it('has resources with types and norms', () => {
    const totalResources = Object.values(data.positions).reduce((sum, p) => sum + p.resources.length, 0);
    expect(totalResources).toBeGreaterThan(50);
    for (const pos of Object.values(data.positions)) {
      for (const res of pos.resources) {
        expect(['labor', 'material', 'equipment']).toContain(res.type);
        expect(res.unitPrice.currency).toBe('PLN');
      }
    }
  });
});

describe('parseAthFile — sieć cieplna Przedmiar Narbutta 85.ATH (no standalone RMS, KNR-W codes)', () => {
  const athPath = resolve(__dirname, '../../docs/przedmiar/new/sieć cieplna Przedmiar Narbutta 85.ATH');
  const buffer = readFileSync(athPath).buffer;
  const data = parseAthFile(buffer);

  it('parses valid structure', () => {
    const result = verifyImportedData(data, 'sieć cieplna Przedmiar Narbutta 85.ATH', {
      minSections: 7,
      minPositions: 50,
      minResources: 0, // No RMS standalone sections → 0 resources from file
      minMeasurements: 40,
    });
    expect(result.sectionCount).toBeGreaterThanOrEqual(7);
    expect(result.positionCount).toBe(54);
  });

  it('has 7 top-level sections', () => {
    expect(data.root.sectionIds.length).toBe(7);
  });

  it('correctly parses KNR-W base codes', () => {
    const bases = Object.values(data.positions).map(p => p.base).filter(Boolean);
    const knrBases = bases.filter(b => /^(KNR|KNR-W)/.test(b));
    console.log(`    KNR-W bases: ${knrBases.length}/${bases.length}`);
    console.log(`    Sample: ${knrBases.slice(0, 5).join(', ')}`);
    // Some positions may have empty base
    expect(knrBases.length).toBeGreaterThan(bases.length * 0.8);

    // Should NOT contain source descriptions
    for (const base of bases) {
      expect(base).not.toContain('WACETOB');
      expect(base).not.toContain('Miastoprojekt');
    }
  });

  it('has zero resources (no standalone RMS sections — resources come from uzupełnij nakłady)', () => {
    const totalResources = Object.values(data.positions).reduce((sum, p) => sum + p.resources.length, 0);
    console.log(`    Resources from file: ${totalResources} (expected 0 — no [RMS N] sections)`);
    expect(totalResources).toBe(0);
  });

  it('base codes match KNR database for uzupełnij nakłady', () => {
    const csvPath = resolve(__dirname, '../../docs/KNR/ALL_positions_20260219_234216.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const dbBasisCodes = new Set(
      csvContent.split('\n').slice(1).map(line => line.split(',')[2]?.trim()).filter(Boolean)
    );

    const uniqueBases = [...new Set(
      Object.values(data.positions).map(p => p.base?.trim()).filter(Boolean)
    )];

    let matched = 0;
    const unmatched: string[] = [];
    for (const base of uniqueBases) {
      if (dbBasisCodes.has(base)) matched++;
      else unmatched.push(base);
    }

    console.log(`    DB match: ${matched}/${uniqueBases.length}`);
    if (unmatched.length > 0) console.log(`    Unmatched: ${unmatched.join(', ')}`);
    expect(matched).toBeGreaterThan(uniqueBases.length * 0.5);
  });

  it('handles empty pd= gracefully', () => {
    const emptyBases = Object.values(data.positions).filter(p => !p.base || p.base.trim() === '');
    console.log(`    Empty base positions: ${emptyBases.length}`);
    // Should handle empty pd= without crashing
    expect(emptyBases.length).toBeGreaterThanOrEqual(0);
  });

  it('positions have measurements', () => {
    const withMeasurements = Object.values(data.positions).filter(p => p.measurements.rootIds.length > 0);
    console.log(`    Positions with measurements: ${withMeasurements.length}/${Object.keys(data.positions).length}`);
    expect(withMeasurements.length).toBeGreaterThan(40);
  });
});

// =====================================================
// CROSS-FILE: Full pipeline simulation
// =====================================================
describe('Full pipeline — all new ATH files: import → uzupełnij nakłady → wstaw ceny', () => {
  const files = [
    { name: 'kosztorys budowlany.ath', expectedPos: 169 },
    { name: 'przedm_elektr.ath', expectedPos: 36 },
    { name: 'Przedmiar - przyłącza (1).ath', expectedPos: 34 },
    { name: 'sieć cieplna Przedmiar Narbutta 85.ATH', expectedPos: 54 },
  ];

  const csvPath = resolve(__dirname, '../../docs/KNR/ALL_positions_20260219_234216.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const dbBasisCodes = new Set(
    csvContent.split('\n').slice(1).map(line => line.split(',')[2]?.trim()).filter(Boolean)
  );

  for (const file of files) {
    it(`${file.name}: parses correct position count and has valid structure`, () => {
      const athPath = resolve(__dirname, `../../docs/przedmiar/new/${file.name}`);
      const buffer = readFileSync(athPath).buffer;
      const data = parseAthFile(buffer);

      expect(Object.keys(data.positions).length).toBe(file.expectedPos);

      // All section/position references valid
      for (const secId of data.root.sectionIds) {
        expect(data.sections[secId]).toBeDefined();
      }
      for (const sec of Object.values(data.sections)) {
        for (const posId of sec.positionIds) {
          expect(data.positions[posId]).toBeDefined();
        }
      }

      // Every position has required fields for editor
      for (const pos of Object.values(data.positions)) {
        expect(pos.id).toBeTruthy();
        expect(pos.name).toBeTruthy();
        expect(pos.unit).toBeDefined();
        expect(pos.measurements).toBeDefined();
        expect(Array.isArray(pos.resources)).toBe(true);
        expect(pos.factors).toBeDefined();
        expect(Array.isArray(pos.overheads)).toBe(true);
        expect(pos.unitPrice).toBeDefined();
        expect(pos.unitPrice.currency).toBe('PLN');
      }
    });

    it(`${file.name}: base codes don't contain source text (ORGBUD, WACETOB etc.)`, () => {
      const athPath = resolve(__dirname, `../../docs/przedmiar/new/${file.name}`);
      const buffer = readFileSync(athPath).buffer;
      const data = parseAthFile(buffer);

      for (const pos of Object.values(data.positions)) {
        if (pos.base) {
          expect(pos.base).not.toContain('ORGBUD');
          expect(pos.base).not.toContain('WACETOB');
          expect(pos.base).not.toContain('Miastoprojekt');
          expect(pos.base).not.toContain('biuletyny');
          expect(pos.base).not.toContain('wyd.');
        }
      }
    });

    it(`${file.name}: uzupełnij nakłady — base codes match KNR DB format`, () => {
      const athPath = resolve(__dirname, `../../docs/przedmiar/new/${file.name}`);
      const buffer = readFileSync(athPath).buffer;
      const data = parseAthFile(buffer);

      const uniqueBases = [...new Set(
        Object.values(data.positions).map(p => p.base?.trim()).filter(Boolean)
      )];

      if (uniqueBases.length === 0) return; // e.g., file with only empty bases

      // Check if KNR-formatted codes match DB
      const knrBases = uniqueBases.filter(b => /^(KNR|KNR-W|KNNR|KSNR)/.test(b));
      let matched = 0;
      for (const base of knrBases) {
        if (dbBasisCodes.has(base)) matched++;
      }

      console.log(`    ${file.name}: ${matched}/${knrBases.length} KNR codes match DB`);
      if (knrBases.length > 0) {
        expect(matched).toBeGreaterThan(0);
      }
    });

    it(`${file.name}: wstaw ceny — resources are price-compatible`, () => {
      const athPath = resolve(__dirname, `../../docs/przedmiar/new/${file.name}`);
      const buffer = readFileSync(athPath).buffer;
      const data = parseAthFile(buffer);

      for (const pos of Object.values(data.positions)) {
        for (const res of pos.resources) {
          // Must have type, name, norm, unitPrice for price filling
          expect(['labor', 'material', 'equipment']).toContain(res.type);
          expect(typeof res.name).toBe('string');
          expect(res.name.length).toBeGreaterThan(0);
          expect(typeof res.norm.value).toBe('number');
          expect(res.unitPrice).toBeDefined();
          expect(typeof res.unitPrice.value).toBe('number');
        }
      }
    });
  }
});
