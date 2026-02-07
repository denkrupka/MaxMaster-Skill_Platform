/**
 * Estimate Export Utilities
 * Экспорт сметы в Excel/CSV формат
 */

import { supabase } from './supabase';

interface ExportEstimateData {
  estimate: any;
  request: any;
  items: any[];
  equipment: any[];
  totals: {
    workTotal: number;
    materialTotal: number;
    equipmentTotal: number;
    laborHoursTotal: number;
    grandTotal: number;
    marginPercent: number;
    discountPercent: number;
    finalTotal: number;
  };
}

/**
 * Load estimate data for export
 */
export async function loadEstimateForExport(estimateId: string): Promise<ExportEstimateData | null> {
  try {
    // Load estimate with request
    const { data: estimate, error } = await supabase
      .from('kosztorys_estimates')
      .select(`
        *,
        request:kosztorys_requests(*),
        price_list:kosztorys_price_lists(*)
      `)
      .eq('id', estimateId)
      .single();

    if (error || !estimate) return null;

    // Load items
    const { data: items } = await supabase
      .from('kosztorys_estimate_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('position_number');

    // Load equipment
    const { data: equipment } = await supabase
      .from('kosztorys_estimate_equipment')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('position_number');

    return {
      estimate,
      request: estimate.request,
      items: items || [],
      equipment: equipment || [],
      totals: {
        workTotal: estimate.work_total || 0,
        materialTotal: estimate.material_total || 0,
        equipmentTotal: estimate.equipment_total || 0,
        laborHoursTotal: estimate.labor_hours_total || 0,
        grandTotal: estimate.grand_total || 0,
        marginPercent: estimate.margin_percent || 0,
        discountPercent: estimate.discount_percent || 0,
        finalTotal: estimate.final_total || 0,
      },
    };
  } catch (error) {
    console.error('Error loading estimate for export:', error);
    return null;
  }
}

/**
 * Export estimate to CSV format
 */
export function exportEstimateToCSV(data: ExportEstimateData): string {
  const lines: string[] = [];
  const separator = ';';

  // Header info
  lines.push(`KOSZTORYS`);
  lines.push(`Wersja:${separator}${data.estimate.version}`);
  lines.push(`Data utworzenia:${separator}${new Date(data.estimate.created_at).toLocaleDateString('pl-PL')}`);
  lines.push(``);

  // Client info
  if (data.request) {
    lines.push(`DANE KLIENTA`);
    lines.push(`Klient:${separator}${data.request.client_name || ''}`);
    lines.push(`Inwestycja:${separator}${data.request.investment_name || ''}`);
    lines.push(`Adres:${separator}${data.request.address || ''}`);
    lines.push(`Typ obiektu:${separator}${data.request.object_type || ''}`);
    lines.push(`Instalacje:${separator}${data.request.installation_types || ''}`);
    lines.push(``);
  }

  // Work items header
  lines.push(`POZYCJE KOSZTORYSOWE`);
  lines.push([
    'Lp.',
    'Pomieszczenie',
    'Kod',
    'Nazwa pracy',
    'Jednostka',
    'Ilość',
    'Cena jednostkowa',
    'Wartość',
    'Roboczogodziny',
    'Koszt materiałów'
  ].join(separator));

  // Work items
  data.items.forEach((item, index) => {
    lines.push([
      index + 1,
      item.room_name || '',
      item.work_code || '',
      item.work_name || '',
      item.unit || '',
      item.quantity || 0,
      (item.unit_price || 0).toFixed(2),
      (item.total_price || 0).toFixed(2),
      (item.labor_hours || 0).toFixed(1),
      (item.material_cost || 0).toFixed(2),
    ].join(separator));
  });

  lines.push(``);

  // Equipment header
  if (data.equipment.length > 0) {
    lines.push(`SPRZĘT`);
    lines.push([
      'Lp.',
      'Kod',
      'Nazwa',
      'Jednostka',
      'Ilość',
      'Cena jednostkowa',
      'Wartość'
    ].join(separator));

    data.equipment.forEach((eq, index) => {
      lines.push([
        index + 1,
        eq.equipment_code || '',
        eq.equipment_name || '',
        eq.unit || '',
        eq.quantity || 0,
        (eq.unit_price || 0).toFixed(2),
        (eq.total_price || 0).toFixed(2),
      ].join(separator));
    });

    lines.push(``);
  }

  // Totals
  lines.push(`PODSUMOWANIE`);
  lines.push(`Prace:${separator}${data.totals.workTotal.toFixed(2)} PLN`);
  lines.push(`Materiały:${separator}${data.totals.materialTotal.toFixed(2)} PLN`);
  lines.push(`Sprzęt:${separator}${data.totals.equipmentTotal.toFixed(2)} PLN`);
  lines.push(`Roboczogodziny:${separator}${data.totals.laborHoursTotal.toFixed(1)} h`);
  lines.push(``);
  lines.push(`Suma netto:${separator}${data.totals.grandTotal.toFixed(2)} PLN`);
  lines.push(`Marża (${data.totals.marginPercent}%):${separator}${(data.totals.grandTotal * data.totals.marginPercent / 100).toFixed(2)} PLN`);
  lines.push(`Rabat (${data.totals.discountPercent}%):${separator}${(data.totals.grandTotal * data.totals.discountPercent / 100).toFixed(2)} PLN`);
  lines.push(`RAZEM:${separator}${data.totals.finalTotal.toFixed(2)} PLN`);

  return lines.join('\n');
}

/**
 * Export estimate to HTML format (for printing/PDF)
 */
export function exportEstimateToHTML(data: ExportEstimateData): string {
  const formatCurrency = (value: number) =>
    value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Kosztorys - ${data.request?.investment_name || 'Bez nazwy'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; padding: 20px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .header h1 { font-size: 18pt; color: #1a365d; }
    .meta { margin: 10px 0; color: #666; }
    .client-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 5px; }
    .client-info dt { font-weight: bold; color: #666; }
    .client-info dd { color: #333; margin-left: 0; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f1f5f9; font-weight: bold; color: #475569; }
    .text-right { text-align: right; }
    .section-title { font-size: 12pt; font-weight: bold; color: #1a365d; margin: 20px 0 10px; padding: 5px 0; border-bottom: 1px solid #ddd; }
    .summary { margin-top: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
    .summary-box { padding: 15px; background: #f8fafc; border-radius: 5px; text-align: center; }
    .summary-box .label { font-size: 9pt; color: #666; }
    .summary-box .value { font-size: 14pt; font-weight: bold; color: #333; margin-top: 5px; }
    .totals-table { width: auto; margin-left: auto; }
    .totals-table td { padding: 5px 15px; }
    .totals-table .final { font-size: 14pt; font-weight: bold; color: #059669; border-top: 2px solid #333; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>KOSZTORYS</h1>
    <div class="meta">Wersja: ${data.estimate.version} | Data: ${new Date(data.estimate.created_at).toLocaleDateString('pl-PL')}</div>
  </div>

  ${data.request ? `
  <div class="client-info">
    <dl>
      <dt>Klient</dt>
      <dd>${data.request.client_name || '-'}</dd>
      <dt>Inwestycja</dt>
      <dd>${data.request.investment_name || '-'}</dd>
    </dl>
    <dl>
      <dt>Adres</dt>
      <dd>${data.request.address || '-'}</dd>
      <dt>Typ / Instalacje</dt>
      <dd>${data.request.object_type || '-'} / ${data.request.installation_types || '-'}</dd>
    </dl>
  </div>
  ` : ''}

  <div class="section-title">POZYCJE KOSZTORYSOWE</div>
  <table>
    <thead>
      <tr>
        <th>Lp.</th>
        <th>Pomieszczenie</th>
        <th>Nazwa pracy</th>
        <th>Jedn.</th>
        <th class="text-right">Ilość</th>
        <th class="text-right">Cena j.</th>
        <th class="text-right">Wartość</th>
        <th class="text-right">R-g</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${item.room_name || '-'}</td>
          <td>${item.work_name || '-'}</td>
          <td>${item.unit || '-'}</td>
          <td class="text-right">${item.quantity || 0}</td>
          <td class="text-right">${formatCurrency(item.unit_price || 0)}</td>
          <td class="text-right">${formatCurrency(item.total_price || 0)}</td>
          <td class="text-right">${(item.labor_hours || 0).toFixed(1)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${data.equipment.length > 0 ? `
  <div class="section-title">SPRZĘT</div>
  <table>
    <thead>
      <tr>
        <th>Lp.</th>
        <th>Kod</th>
        <th>Nazwa</th>
        <th>Jedn.</th>
        <th class="text-right">Ilość</th>
        <th class="text-right">Cena j.</th>
        <th class="text-right">Wartość</th>
      </tr>
    </thead>
    <tbody>
      ${data.equipment.map((eq, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${eq.equipment_code || '-'}</td>
          <td>${eq.equipment_name || '-'}</td>
          <td>${eq.unit || '-'}</td>
          <td class="text-right">${eq.quantity || 0}</td>
          <td class="text-right">${formatCurrency(eq.unit_price || 0)}</td>
          <td class="text-right">${formatCurrency(eq.total_price || 0)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="summary">
    <div class="section-title">PODSUMOWANIE</div>
    <div class="summary-grid">
      <div class="summary-box">
        <div class="label">Prace</div>
        <div class="value">${formatCurrency(data.totals.workTotal)}</div>
      </div>
      <div class="summary-box">
        <div class="label">Materiały</div>
        <div class="value">${formatCurrency(data.totals.materialTotal)}</div>
      </div>
      <div class="summary-box">
        <div class="label">Sprzęt</div>
        <div class="value">${formatCurrency(data.totals.equipmentTotal)}</div>
      </div>
      <div class="summary-box">
        <div class="label">Roboczogodziny</div>
        <div class="value">${data.totals.laborHoursTotal.toFixed(1)} h</div>
      </div>
    </div>

    <table class="totals-table">
      <tr>
        <td>Suma netto:</td>
        <td class="text-right">${formatCurrency(data.totals.grandTotal)}</td>
      </tr>
      <tr>
        <td>Marża (${data.totals.marginPercent}%):</td>
        <td class="text-right">+${formatCurrency(data.totals.grandTotal * data.totals.marginPercent / 100)}</td>
      </tr>
      <tr>
        <td>Rabat (${data.totals.discountPercent}%):</td>
        <td class="text-right">-${formatCurrency(data.totals.grandTotal * data.totals.discountPercent / 100)}</td>
      </tr>
      <tr class="final">
        <td>RAZEM:</td>
        <td class="text-right">${formatCurrency(data.totals.finalTotal)}</td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}

/**
 * Download file utility
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export estimate to CSV and download
 */
export async function downloadEstimateCSV(estimateId: string): Promise<boolean> {
  const data = await loadEstimateForExport(estimateId);
  if (!data) return false;

  const csv = exportEstimateToCSV(data);
  const filename = `kosztorys_${data.estimate.version}_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile('\ufeff' + csv, filename, 'text/csv;charset=utf-8'); // BOM for Excel
  return true;
}

/**
 * Export estimate to HTML for printing
 */
export async function printEstimate(estimateId: string): Promise<boolean> {
  const data = await loadEstimateForExport(estimateId);
  if (!data) return false;

  const html = exportEstimateToHTML(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
  return true;
}
