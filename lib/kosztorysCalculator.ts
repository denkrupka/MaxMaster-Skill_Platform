/**
 * Kosztorys Calculator Service
 * Full calculation engine based on eKosztorysowanie.pl formulas
 */

import type {
  KosztorysCostEstimate,
  KosztorysCostEstimateData,
  KosztorysPosition,
  KosztorysSection,
  KosztorysResource,
  KosztorysFactors,
  KosztorysOverhead,
  KosztorysMeasurements,
  KosztorysPrecisionSettings,
  KosztorysPositionCalculationResult,
  KosztorysCostEstimateCalculationResult,
} from '../types';

// Default precision settings
const DEFAULT_PRECISION: KosztorysPrecisionSettings = {
  norms: 6,
  resources: 2,
  measurements: 2,
  unitValues: 2,
  positionBase: 2,
  costEstimateBase: 2,
  roundingMethod: 'default',
};

// Default factors
const DEFAULT_FACTORS: KosztorysFactors = {
  labor: 1,
  material: 1,
  equipment: 1,
  waste: 0,
};

/**
 * Round number to specified precision
 */
export function roundToPrecision(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

/**
 * Safe math expression evaluator for measurements
 * Supports: +, -, *, /, (, ), numbers, decimals
 */
export function evaluateMeasurementExpression(expression: string): number {
  if (!expression || expression.trim() === '') return 0;

  // Sanitize: only allow numbers, operators, parentheses, spaces, dots, commas
  const sanitized = expression
    .replace(/,/g, '.')
    .replace(/[^0-9+\-*/().e\s]/gi, '');

  if (!sanitized.trim()) return 0;

  try {
    // Use Function constructor for safe evaluation
    const result = new Function(`return (${sanitized})`)();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch {
    return 0;
  }
}

/**
 * Calculate total quantity from measurements
 */
export function calculateMeasurements(
  measurements: KosztorysMeasurements,
  multiplicationFactor: number = 1,
  precision: number = 2
): number {
  if (!measurements || !measurements.rootIds || measurements.rootIds.length === 0) {
    return 0;
  }

  let total = 0;
  for (const rootId of measurements.rootIds) {
    const entry = measurements.entries[rootId];
    if (entry) {
      const value = evaluateMeasurementExpression(entry.expression);
      total += value;
    }
  }

  return roundToPrecision(total * multiplicationFactor, precision);
}

/**
 * Calculate resource quantity and value
 */
export function calculateResource(
  resource: KosztorysResource,
  positionQuantity: number,
  positionFactors: KosztorysFactors,
  precision: KosztorysPrecisionSettings = DEFAULT_PRECISION
): { calculatedQuantity: number; calculatedValue: number } {
  // Расход = Количество × norm.value × factor
  let calculatedQuantity = positionQuantity * resource.norm.value * resource.factor;
  calculatedQuantity = roundToPrecision(calculatedQuantity, precision.norms);

  // Стоимость = Расход × unitPrice
  let calculatedValue = calculatedQuantity * resource.unitPrice.value;
  calculatedValue = roundToPrecision(calculatedValue, precision.resources);

  return { calculatedQuantity, calculatedValue };
}

/**
 * Calculate position totals
 */
export function calculatePosition(
  position: KosztorysPosition,
  globalFactors: KosztorysFactors = DEFAULT_FACTORS,
  globalOverheads: KosztorysOverhead[] = [],
  precision: KosztorysPrecisionSettings = DEFAULT_PRECISION
): KosztorysPositionCalculationResult {
  // Calculate quantity from measurements
  const quantity = calculateMeasurements(
    position.measurements,
    position.multiplicationFactor,
    precision.measurements
  );

  // Calculate each resource
  const resourceResults: { id: string; calculatedQuantity: number; calculatedValue: number }[] = [];
  let laborTotal = 0;
  let materialTotal = 0;
  let equipmentTotal = 0;

  for (const resource of position.resources) {
    const { calculatedQuantity, calculatedValue } = calculateResource(
      resource,
      quantity,
      position.factors,
      precision
    );

    resourceResults.push({
      id: resource.id,
      calculatedQuantity,
      calculatedValue,
    });

    // Group by type
    switch (resource.type) {
      case 'labor':
        laborTotal += calculatedValue;
        break;
      case 'material':
        materialTotal += calculatedValue;
        break;
      case 'equipment':
        equipmentTotal += calculatedValue;
        break;
    }
  }

  // Apply position factors
  const factors = position.factors || DEFAULT_FACTORS;
  laborTotal = roundToPrecision(laborTotal * factors.labor, precision.positionBase);
  materialTotal = roundToPrecision(
    materialTotal * factors.material * (1 + factors.waste / 100),
    precision.positionBase
  );
  equipmentTotal = roundToPrecision(equipmentTotal * factors.equipment, precision.positionBase);

  // Direct costs (Koszty bezpośrednie)
  const directCostsTotal = roundToPrecision(
    laborTotal + materialTotal + equipmentTotal,
    precision.positionBase
  );

  // Calculate overheads (Narzuty) with proper cumulative calculation
  // Standard Polish cost estimate formula:
  // - Kp (Koszty pośrednie) = R × Kp% - applied to labor
  // - Z (Zysk) = (R + Kp) × Z% - applied to labor + indirect costs
  // - Kz (Koszty zakupu) = M × Kz% - applied to materials
  let overheadsTotal = 0;
  const allOverheads = [...(position.overheads || []), ...globalOverheads];

  // Sort by order to ensure correct cumulative calculation
  const sortedOverheads = [...allOverheads].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Track cumulative values for proper Z calculation
  let kpValue = 0;

  for (const overhead of sortedOverheads) {
    let base = 0;
    const isKp = overhead.name.includes('Kp') || overhead.name.includes('pośrednie');
    const isZ = overhead.name.includes('Zysk') || overhead.name.includes('(Z)');
    const isKz = overhead.name.includes('zakupu') || overhead.name.includes('Kz');

    if (isKp) {
      // Kp applies to labor (R)
      base = laborTotal;
    } else if (isZ) {
      // Z applies to R + Kp (cumulative)
      base = laborTotal + kpValue;
    } else if (isKz) {
      // Kz applies to materials (M)
      base = materialTotal;
    } else {
      // Fallback to original appliesTo logic
      if (overhead.appliesTo.includes('labor')) base += laborTotal;
      if (overhead.appliesTo.includes('material')) base += materialTotal;
      if (overhead.appliesTo.includes('equipment')) base += equipmentTotal;
    }

    let overheadValue = 0;
    if (overhead.type === 'percentage') {
      overheadValue = base * (overhead.value / 100);
    } else {
      overheadValue = overhead.value;
    }

    // Track Kp value for cumulative Z calculation
    if (isKp) {
      kpValue = overheadValue;
    }

    overheadsTotal += overheadValue;
  }
  overheadsTotal = roundToPrecision(overheadsTotal, precision.positionBase);

  // Total with overheads (Razem z narzutami)
  const totalWithOverheads = roundToPrecision(
    directCostsTotal + overheadsTotal,
    precision.positionBase
  );

  // Unit cost (Cena jednostkowa)
  const unitCost = quantity > 0
    ? roundToPrecision(totalWithOverheads / quantity, precision.unitValues)
    : 0;

  return {
    quantity,
    laborTotal,
    materialTotal,
    equipmentTotal,
    directCostsTotal,
    overheadsTotal,
    totalWithOverheads,
    unitCost,
    resources: resourceResults,
  };
}

/**
 * Calculate section totals (including subsections recursively)
 */
export function calculateSection(
  section: KosztorysSection,
  positions: Record<string, KosztorysPosition>,
  allSections: Record<string, KosztorysSection>,
  globalFactors: KosztorysFactors = DEFAULT_FACTORS,
  globalOverheads: KosztorysOverhead[] = [],
  precision: KosztorysPrecisionSettings = DEFAULT_PRECISION
): {
  totalLabor: number;
  totalMaterial: number;
  totalEquipment: number;
  totalValue: number;
  positionResults: Record<string, KosztorysPositionCalculationResult>;
} {
  let totalLabor = 0;
  let totalMaterial = 0;
  let totalEquipment = 0;
  let totalValue = 0;
  const positionResults: Record<string, KosztorysPositionCalculationResult> = {};

  // Calculate positions in this section
  for (const positionId of section.positionIds) {
    const position = positions[positionId];
    if (!position) continue;

    const result = calculatePosition(
      position,
      globalFactors,
      globalOverheads,
      precision
    );

    positionResults[positionId] = result;
    totalLabor += result.laborTotal;
    totalMaterial += result.materialTotal;
    totalEquipment += result.equipmentTotal;
    totalValue += result.totalWithOverheads;
  }

  // Calculate subsections recursively
  for (const subsectionId of section.subsectionIds || []) {
    const subsection = allSections[subsectionId];
    if (!subsection) continue;

    const subsectionResult = calculateSection(
      subsection,
      positions,
      allSections,
      globalFactors,
      globalOverheads,
      precision
    );

    // Merge subsection results
    Object.assign(positionResults, subsectionResult.positionResults);
    totalLabor += subsectionResult.totalLabor;
    totalMaterial += subsectionResult.totalMaterial;
    totalEquipment += subsectionResult.totalEquipment;
  }

  // Apply section factors
  const factors = section.factors || DEFAULT_FACTORS;
  totalLabor = roundToPrecision(totalLabor * factors.labor, precision.costEstimateBase);
  totalMaterial = roundToPrecision(totalMaterial * factors.material, precision.costEstimateBase);
  totalEquipment = roundToPrecision(totalEquipment * factors.equipment, precision.costEstimateBase);

  // Apply section overheads
  let sectionOverheadsTotal = 0;
  for (const overhead of section.overheads || []) {
    let base = 0;
    if (overhead.appliesTo.includes('labor')) base += totalLabor;
    if (overhead.appliesTo.includes('material')) base += totalMaterial;
    if (overhead.appliesTo.includes('equipment')) base += totalEquipment;

    if (overhead.type === 'percentage') {
      sectionOverheadsTotal += base * (overhead.value / 100);
    } else {
      sectionOverheadsTotal += overhead.value;
    }
  }

  totalValue = roundToPrecision(
    totalLabor + totalMaterial + totalEquipment + sectionOverheadsTotal,
    precision.costEstimateBase
  );

  return {
    totalLabor,
    totalMaterial,
    totalEquipment,
    totalValue,
    positionResults,
  };
}

/**
 * Calculate entire cost estimate
 */
export function calculateCostEstimate(
  estimate: KosztorysCostEstimate
): KosztorysCostEstimateCalculationResult {
  const { data, settings } = estimate;
  const precision = settings.precision || DEFAULT_PRECISION;
  const globalFactors = data.root.factors || DEFAULT_FACTORS;
  const globalOverheads = data.root.overheads || [];

  let totalLabor = 0;
  let totalMaterial = 0;
  let totalEquipment = 0;
  let totalDirect = 0;
  let totalOverheads = 0;

  const sectionResults: Record<string, {
    totalLabor: number;
    totalMaterial: number;
    totalEquipment: number;
    totalValue: number;
  }> = {};

  const positionResults: Record<string, KosztorysPositionCalculationResult> = {};

  // Calculate sections
  for (const sectionId of data.root.sectionIds) {
    const section = data.sections[sectionId];
    if (!section) continue;

    const result = calculateSection(
      section,
      data.positions,
      data.sections,
      globalFactors,
      globalOverheads,
      precision
    );

    sectionResults[sectionId] = {
      totalLabor: result.totalLabor,
      totalMaterial: result.totalMaterial,
      totalEquipment: result.totalEquipment,
      totalValue: result.totalValue,
    };

    Object.assign(positionResults, result.positionResults);

    totalLabor += result.totalLabor;
    totalMaterial += result.totalMaterial;
    totalEquipment += result.totalEquipment;
  }

  // Calculate root-level positions (outside sections)
  for (const positionId of data.root.positionIds) {
    const position = data.positions[positionId];
    if (!position) continue;

    const result = calculatePosition(position, globalFactors, globalOverheads, precision);
    positionResults[positionId] = result;

    totalLabor += result.laborTotal;
    totalMaterial += result.materialTotal;
    totalEquipment += result.equipmentTotal;
  }

  totalDirect = roundToPrecision(
    totalLabor + totalMaterial + totalEquipment,
    precision.costEstimateBase
  );

  // Calculate global overheads
  for (const overhead of globalOverheads) {
    let base = 0;
    if (overhead.appliesTo.includes('labor')) base += totalLabor;
    if (overhead.appliesTo.includes('material')) base += totalMaterial;
    if (overhead.appliesTo.includes('equipment')) base += totalEquipment;

    if (overhead.type === 'percentage') {
      totalOverheads += base * (overhead.value / 100);
    } else {
      totalOverheads += overhead.value;
    }
  }
  totalOverheads = roundToPrecision(totalOverheads, precision.costEstimateBase);

  const totalValue = roundToPrecision(
    totalDirect + totalOverheads,
    precision.costEstimateBase
  );

  return {
    totalLabor,
    totalMaterial,
    totalEquipment,
    totalDirect,
    totalOverheads,
    totalValue,
    sections: sectionResults,
    positions: positionResults,
  };
}

/**
 * Format number for display (Polish locale)
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('pl-PL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format currency (PLN)
 */
export function formatCurrency(value: number, currency: string = 'PLN'): string {
  return value.toLocaleString('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Generate ordinal number for position/section
 * e.g., "1", "1.1", "1.1.1"
 */
export function generateOrdinalNumber(
  parentOrdinal: string | null,
  siblingIndex: number
): string {
  const index = siblingIndex + 1;
  if (!parentOrdinal) {
    return String(index);
  }
  return `${parentOrdinal}.${index}`;
}

/**
 * Create default factors
 */
export function createDefaultFactors(): KosztorysFactors {
  return { ...DEFAULT_FACTORS };
}

/**
 * Create default precision settings
 */
export function createDefaultPrecision(): KosztorysPrecisionSettings {
  return { ...DEFAULT_PRECISION };
}

/**
 * Create default overhead (Koszty pośrednie - indirect costs)
 */
export function createDefaultIndirectCostsOverhead(value: number = 65): KosztorysOverhead {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `overhead-${Date.now()}`,
    name: 'Koszty pośrednie (Kp)',
    type: 'percentage',
    value,
    appliesTo: ['labor'],
    order: 1,
  };
}

/**
 * Create default profit overhead
 */
export function createDefaultProfitOverhead(value: number = 10): KosztorysOverhead {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `overhead-${Date.now()}-2`,
    name: 'Zysk (Z)',
    type: 'percentage',
    value,
    appliesTo: ['labor'],
    order: 2,
  };
}

/**
 * Create default purchase costs overhead
 */
export function createDefaultPurchaseCostsOverhead(value: number = 5): KosztorysOverhead {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `overhead-${Date.now()}-3`,
    name: 'Koszty zakupu (Kz)',
    type: 'percentage',
    value,
    appliesTo: ['material'],
    order: 3,
  };
}

/**
 * Create empty measurements
 */
export function createEmptyMeasurements(): KosztorysMeasurements {
  return {
    rootIds: [],
    entries: {},
  };
}

/**
 * Add measurement entry
 */
export function addMeasurementEntry(
  measurements: KosztorysMeasurements,
  expression: string,
  description: string | null = null
): KosztorysMeasurements {
  const id = crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`;
  return {
    rootIds: [...measurements.rootIds, id],
    entries: {
      ...measurements.entries,
      [id]: {
        id,
        type: 'expression',
        expression,
        description,
      },
    },
  };
}

/**
 * Update measurement entry
 */
export function updateMeasurementEntry(
  measurements: KosztorysMeasurements,
  entryId: string,
  expression: string,
  description?: string | null
): KosztorysMeasurements {
  const entry = measurements.entries[entryId];
  if (!entry) return measurements;

  return {
    ...measurements,
    entries: {
      ...measurements.entries,
      [entryId]: {
        ...entry,
        expression,
        description: description !== undefined ? description : entry.description,
      },
    },
  };
}

/**
 * Remove measurement entry
 */
export function removeMeasurementEntry(
  measurements: KosztorysMeasurements,
  entryId: string
): KosztorysMeasurements {
  const { [entryId]: removed, ...remainingEntries } = measurements.entries;
  return {
    rootIds: measurements.rootIds.filter((id) => id !== entryId),
    entries: remainingEntries,
  };
}

/**
 * Create new position
 */
export function createNewPosition(
  base: string = '',
  name: string = 'Nowa pozycja',
  unitLabel: string = 'szt.',
  unitIndex: string = '020'
): KosztorysPosition {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `pos-${Date.now()}`,
    base,
    originBase: base,
    name,
    marker: null,
    unit: { label: unitLabel, unitIndex },
    measurements: createEmptyMeasurements(),
    multiplicationFactor: 1,
    resources: [],
    factors: createDefaultFactors(),
    overheads: [],
    unitPrice: { value: 0, currency: 'PLN' },
  };
}

/**
 * Create new resource
 */
export function createNewResource(
  type: 'labor' | 'material' | 'equipment',
  name: string = '',
  normValue: number = 1,
  unitPrice: number = 0,
  unitLabel: string = 'szt.',
  unitIndex: string = '020'
): KosztorysResource {
  const typeDefaults: Record<string, { unitLabel: string; unitIndex: string; name: string }> = {
    labor: { unitLabel: 'r-g', unitIndex: '149', name: 'robotnicy' },
    material: { unitLabel: 'szt.', unitIndex: '020', name: 'materiał' },
    equipment: { unitLabel: 'm-g', unitIndex: '150', name: 'sprzęt' },
  };

  const defaults = typeDefaults[type];

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `res-${Date.now()}`,
    name: name || defaults.name,
    index: null,
    originIndex: { type: 'custom', index: '' },
    type,
    factor: 1,
    norm: { type: 'absolute', value: normValue },
    unit: {
      label: unitLabel || defaults.unitLabel,
      unitIndex: unitIndex || defaults.unitIndex,
    },
    unitPrice: { value: unitPrice, currency: 'PLN' },
    group: null,
    marker: null,
    investorTotal: false,
  };
}

/**
 * Create new section
 */
export function createNewSection(
  name: string = 'Nowy dział',
  ordinalNumber: string = '1'
): KosztorysSection {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `sec-${Date.now()}`,
    name,
    description: '',
    ordinalNumber,
    positionIds: [],
    subsectionIds: [],
    factors: createDefaultFactors(),
    overheads: [],
  };
}

/**
 * Validate position data
 */
export function validatePosition(position: KosztorysPosition): string[] {
  const errors: string[] = [];

  if (!position.name || position.name.trim() === '') {
    errors.push('Nazwa pozycji jest wymagana');
  }

  if (!position.unit || !position.unit.label) {
    errors.push('Jednostka miary jest wymagana');
  }

  return errors;
}

/**
 * Validate resource data
 */
export function validateResource(resource: KosztorysResource): string[] {
  const errors: string[] = [];

  if (!resource.name || resource.name.trim() === '') {
    errors.push('Nazwa nakładu jest wymagana');
  }

  if (resource.norm.value < 0) {
    errors.push('Norma nie może być ujemna');
  }

  if (resource.unitPrice.value < 0) {
    errors.push('Cena jednostkowa nie może być ujemna');
  }

  return errors;
}

export default {
  calculateCostEstimate,
  calculatePosition,
  calculateSection,
  calculateResource,
  calculateMeasurements,
  evaluateMeasurementExpression,
  roundToPrecision,
  formatNumber,
  formatCurrency,
  generateOrdinalNumber,
  createDefaultFactors,
  createDefaultPrecision,
  createDefaultIndirectCostsOverhead,
  createDefaultProfitOverhead,
  createDefaultPurchaseCostsOverhead,
  createEmptyMeasurements,
  addMeasurementEntry,
  updateMeasurementEntry,
  removeMeasurementEntry,
  createNewPosition,
  createNewResource,
  createNewSection,
  validatePosition,
  validateResource,
};
