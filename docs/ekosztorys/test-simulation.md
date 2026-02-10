# Test Simulation - Kosztorys Module

## Test Scenario: Cable Installation Estimate

This document describes a test scenario to verify the Kosztorys Editor module functionality.

### Test Data

**Estimate Name:** Instalacja elektryczna - Hala produkcyjna
**Type:** Kosztorys wykonawczy (contractor)
**Currency:** PLN

### Test Structure

```
1. Dział: Roboty ziemne
   └── 1.1 Pozycja: KNNR 5 0702-01 - Zasypywanie rowów dla kabli wykonanych ręcznie w gruncie kat. I-II
       ├── R: robotnicy (1.0769 r-g × 10 m3 = 10.769 r-g × 52.86 PLN = 569.18 PLN)
       └── S: Koparka (16.9 m-g × 10 m3 = 169 m-g × 11.00 PLN = 1,859.00 PLN)

       Przedmiar = 10 m3

       Koszty bezpośrednie = 569.18 + 1,859.00 = 2,428.18 PLN
       Razem z narzutami = 2,428.18 PLN
       Cena jednostkowa = 242.82 PLN/m3

1.1 Poddział: jeszcze jeden poddział
```

### Expected Calculation Results

| Component | Quantity | Unit Price | Total |
|-----------|----------|------------|-------|
| Robocizna (R) - robotnicy | 10.769 r-g | 52.86 PLN | 569.18 PLN |
| Sprzęt (S) - Koparka | 169.0 m-g | 11.00 PLN | 1,859.00 PLN |
| **Koszty bezpośrednie** | | | **2,428.18 PLN** |

### Overhead Calculation

With default overheads:
- Koszty pośrednie (Kp): 65% of labor = 569.18 × 0.65 = 369.97 PLN
- Zysk (Z): 10% of (labor + Kp) = (569.18 + 369.97) × 0.10 = 93.92 PLN
- Koszty zakupu (Kz): 5% of material = 0 (no materials)

**Total with overheads:** 2,428.18 + 369.97 + 93.92 = 2,892.07 PLN

### Manual Test Steps

1. **Create new estimate:**
   - Navigate to: /construction/kosztorys
   - Set name: "Instalacja elektryczna - Hala produkcyjna"
   - Set type: "contractor"

2. **Add section:**
   - Click "Dział" button in toolbar
   - Name: "Roboty ziemne"

3. **Add position:**
   - Click "Pozycja" button
   - Base: "KNNR 5 0702-01"
   - Name: "Zasypywanie rowów dla kabli wykonanych ręcznie w gruncie kat. I-II"
   - Unit: m3
   - Measurement: 10

4. **Add resources:**
   - Add labor resource:
     - Type: Robocizna (R)
     - Name: robotnicy
     - Index: 999
     - Norm: 1.0769
     - Unit: r-g
     - Price: 52.86

   - Add equipment resource:
     - Type: Sprzęt (S)
     - Name: Koparka
     - Index: (leave empty)
     - Norm: 16.9
     - Unit: m-g
     - Price: 11.00

5. **Verify calculations:**
   - Position total should show: 2,428.18 PLN
   - Labor total: 569.18 PLN
   - Equipment total: 1,859.00 PLN
   - Unit cost: 242.82 PLN/m3

6. **Export:**
   - Click "Eksport CSV" button
   - Verify CSV file contains all positions and totals

7. **Save:**
   - Click "Zapisz" button
   - Verify success notification

### Automated Test Code

```typescript
import {
  calculateCostEstimate,
  calculatePosition,
  createNewPosition,
  createNewResource,
  addMeasurementEntry,
  formatNumber,
  formatCurrency,
} from '../lib/kosztorysCalculator';

// Test: Calculate position with labor and equipment
const testPosition = createNewPosition('KNNR 5 0702-01', 'Zasypywanie rowów', 'm3', '060');
testPosition.measurements = addMeasurementEntry(testPosition.measurements, '10', 'Przedmiar');

// Add labor resource
testPosition.resources.push(createNewResource('labor', 'robotnicy', 1.0769, 52.86, 'r-g', '149'));

// Add equipment resource
testPosition.resources.push(createNewResource('equipment', 'Koparka', 16.9, 11.00, 'm-g', '150'));

// Calculate
const result = calculatePosition(testPosition, { labor: 1, material: 1, equipment: 1, waste: 0 }, []);

console.log('Quantity:', result.quantity); // Expected: 10
console.log('Labor Total:', formatNumber(result.laborTotal)); // Expected: 569.18
console.log('Equipment Total:', formatNumber(result.equipmentTotal)); // Expected: 1,859.00
console.log('Direct Costs:', formatNumber(result.directCostsTotal)); // Expected: 2,428.18
console.log('Unit Cost:', formatNumber(result.unitCost)); // Expected: 242.82

// Assertions
console.assert(result.quantity === 10, 'Quantity should be 10');
console.assert(Math.abs(result.laborTotal - 569.18) < 0.01, 'Labor total should be ~569.18');
console.assert(Math.abs(result.equipmentTotal - 1859.00) < 0.01, 'Equipment total should be ~1859.00');
console.assert(Math.abs(result.directCostsTotal - 2428.18) < 0.01, 'Direct costs should be ~2428.18');
```

### Browser Console Test

Open browser console and run:

```javascript
// Import calculator functions (if module is loaded)
const calc = await import('/src/lib/kosztorysCalculator');

// Quick test
const pos = calc.createNewPosition('TEST-001', 'Test position', 'm3', '060');
pos.measurements = calc.addMeasurementEntry(pos.measurements, '10', 'Test');
pos.resources.push(calc.createNewResource('labor', 'worker', 1.5, 50, 'r-g', '149'));

const result = calc.calculatePosition(pos);
console.log('Test result:', result);
// Expected: quantity=10, laborTotal=750 (10*1.5*50)
```

## Success Criteria

- [ ] Editor loads without errors
- [ ] Can create sections
- [ ] Can create positions with measurements
- [ ] Can add resources (labor, material, equipment)
- [ ] Calculations update in real-time
- [ ] Can save to database
- [ ] Can export to CSV
- [ ] Total value displays correctly in footer
- [ ] Properties panel shows details for selected items
