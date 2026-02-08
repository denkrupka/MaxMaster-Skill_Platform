/**
 * Estimate Generator - Алгоритм автоматической генерации сметы из формуляра
 * Согласно разделу 8.1 TZ_ElektroSmeta
 *
 * Логика:
 * 1. Берем все ответы формуляра (form_answers) где value > 0
 * 2. Для каждого ответа находим правила маппинга по room_code + work_code
 * 3. Применяем шаблонные задания с материалами и оборудованием
 * 4. Умножаем на количество из формуляра и множитель из правила
 * 5. Получаем цены из активного прайс-листа
 * 6. Формируем позиции сметы
 */

import { supabase } from './supabase';
import type {
  KosztorysForm,
  KosztorysFormAnswer,
  KosztorysMappingRule,
  KosztorysTemplateTask,
  KosztorysPriceList,
  KosztorysPriceListItem,
  KosztorysEstimate,
  KosztorysEstimateItem,
} from '../types';

interface GeneratedEstimateItem {
  work_type_id?: string;
  work_code: string;
  work_name: string;
  room_code: string;
  room_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  labor_hours: number;
  material_cost: number;
  equipment_cost: number;
  source_template_id?: string;
  source_answer_id?: string;
}

interface GeneratedMaterial {
  material_id: string;
  material_code: string;
  material_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface GeneratedEquipment {
  equipment_id: string;
  equipment_code: string;
  equipment_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface EstimateGenerationResult {
  success: boolean;
  estimateId?: string;
  items: GeneratedEstimateItem[];
  materials: GeneratedMaterial[];
  equipment: GeneratedEquipment[];
  totals: {
    workTotal: number;
    materialTotal: number;
    equipmentTotal: number;
    laborHoursTotal: number;
    grandTotal: number;
  };
  warnings: string[];
  errors: string[];
}

export async function generateEstimateFromForm(
  formId: string,
  requestId: string,
  companyId: string,
  priceListId?: string
): Promise<EstimateGenerationResult> {
  const result: EstimateGenerationResult = {
    success: false,
    items: [],
    materials: [],
    equipment: [],
    totals: {
      workTotal: 0,
      materialTotal: 0,
      equipmentTotal: 0,
      laborHoursTotal: 0,
      grandTotal: 0,
    },
    warnings: [],
    errors: [],
  };

  try {
    // 1. Загружаем форму и её ответы
    const { data: form, error: formError } = await supabase
      .from('kosztorys_forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      result.errors.push('Nie można załadować formularza');
      return result;
    }

    // 2. Загружаем ответы формуляра (только отмеченные)
    const { data: answers, error: answersError } = await supabase
      .from('kosztorys_form_answers')
      .select('*')
      .eq('form_id', formId)
      .eq('is_marked', true);

    if (answersError) {
      result.errors.push('Nie można załadować odpowiedzi formularza');
      return result;
    }

    if (!answers || answers.length === 0) {
      result.warnings.push('Formularz nie zawiera żadnych wypełnionych pozycji');
      result.success = true;
      return result;
    }

    // 3. Загружаем правила маппинга для типа формуляра
    const { data: mappingRules, error: mappingError } = await supabase
      .from('kosztorys_mapping_rules')
      .select(`
        *,
        template_task:kosztorys_template_tasks(
          *,
          work_type:kosztorys_work_types(*),
          materials:kosztorys_template_task_materials(
            *,
            material:kosztorys_materials(*)
          ),
          equipment:kosztorys_template_task_equipment(
            *,
            equipment:kosztorys_equipment(*)
          )
        )
      `)
      .eq('form_type', form.form_type)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (mappingError) {
      result.errors.push('Nie można załadować reguł mapowania');
      return result;
    }

    // 4. Находим активный прайс-лист
    let priceList: KosztorysPriceList | null = null;
    let priceListItems: KosztorysPriceListItem[] = [];

    if (priceListId) {
      const { data: pl } = await supabase
        .from('kosztorys_price_lists')
        .select('*')
        .eq('id', priceListId)
        .maybeSingle();
      priceList = pl;
    } else {
      // Находим активный прайс-лист по дате
      const today = new Date().toISOString().split('T')[0];
      const { data: pl } = await supabase
        .from('kosztorys_price_lists')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .lte('valid_from', today)
        .or(`valid_to.is.null,valid_to.gte.${today}`)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      priceList = pl;
    }

    if (priceList) {
      const { data: items } = await supabase
        .from('kosztorys_price_list_items')
        .select('*')
        .eq('price_list_id', priceList.id);
      priceListItems = items || [];
    } else {
      result.warnings.push('Brak aktywnego cennika - zostaną użyte ceny domyślne');
    }

    // Функция получения цены из прайс-листа
    const getPrice = (itemType: string, itemId: string, defaultPrice: number): number => {
      const priceItem = priceListItems.find(
        pi => pi.item_type === itemType && pi.item_id === itemId
      );
      return priceItem?.unit_price ?? defaultPrice;
    };

    // 5. Обрабатываем каждый ответ формуляра
    const materialsMap = new Map<string, GeneratedMaterial>();
    const equipmentMap = new Map<string, GeneratedEquipment>();

    for (const answer of answers) {
      // Находим подходящие правила маппинга
      // Используем work_type_code из ответа (или work_code если есть)
      const workCode = answer.work_code || answer.work_type_code;

      const applicableRules = (mappingRules || []).filter((rule: any) => {
        // Точное совпадение или wildcard '*'
        const roomMatch = rule.room_code === answer.room_code || rule.room_code === '*';
        const workMatch = rule.work_type_code === workCode || rule.work_code === workCode || rule.work_type_code === '*';
        return roomMatch && workMatch;
      });

      if (applicableRules.length === 0) {
        result.warnings.push(
          `Brak reguły mapowania dla: ${answer.room_code} + ${workCode}`
        );
        continue;
      }

      // Берем правило с наивысшим приоритетом (первое после сортировки)
      const rule: any = applicableRules[0];
      const template = rule.template_task;

      if (!template) {
        result.warnings.push(
          `Brak szablonu dla reguły: ${answer.room_code} + ${workCode}`
        );
        continue;
      }

      // Рассчитываем количество (value по умолчанию = 1 если не задано)
      const answerValue = answer.value ?? 1;
      const quantity = answerValue * (rule.multiplier || 1) * (template.base_quantity || 1);

      // Получаем цену работы
      const workPrice = getPrice('work', template.id, template.work_type?.labor_hours * 50 || 0);
      const laborHours = (template.labor_hours || 0) * quantity;

      // Рассчитываем стоимость материалов для этой позиции
      let materialCost = 0;
      if (template.materials) {
        for (const tm of template.materials) {
          const material = tm.material;
          if (!material) continue;

          const matQuantity = quantity * (tm.quantity || 1);
          const matPrice = getPrice('material', material.id, material.default_price || 0);
          const matTotal = matQuantity * matPrice;
          materialCost += matTotal;

          // Добавляем в общий список материалов
          const key = material.id;
          if (materialsMap.has(key)) {
            const existing = materialsMap.get(key)!;
            existing.quantity += matQuantity;
            existing.total_price += matTotal;
          } else {
            materialsMap.set(key, {
              material_id: material.id,
              material_code: material.code,
              material_name: material.name,
              unit: material.unit,
              quantity: matQuantity,
              unit_price: matPrice,
              total_price: matTotal,
            });
          }
        }
      }

      // Рассчитываем стоимость оборудования для этой позиции
      let equipmentCost = 0;
      if (template.equipment) {
        for (const te of template.equipment) {
          const eq = te.equipment;
          if (!eq) continue;

          const eqQuantity = quantity * (te.quantity || 1);
          const eqPrice = getPrice('equipment', eq.id, eq.default_price || 0);
          const eqTotal = eqQuantity * eqPrice;
          equipmentCost += eqTotal;

          // Добавляем в общий список оборудования
          const key = eq.id;
          if (equipmentMap.has(key)) {
            const existing = equipmentMap.get(key)!;
            existing.quantity += eqQuantity;
            existing.total_price += eqTotal;
          } else {
            equipmentMap.set(key, {
              equipment_id: eq.id,
              equipment_code: eq.code,
              equipment_name: eq.name,
              unit: eq.unit,
              quantity: eqQuantity,
              unit_price: eqPrice,
              total_price: eqTotal,
            });
          }
        }
      }

      // Создаем позицию сметы
      const estimateItem: GeneratedEstimateItem = {
        work_type_id: template.work_type_id,
        work_code: template.code,
        work_name: template.name,
        room_code: answer.room_code,
        room_name: answer.room_name || answer.room_group || answer.room_code,
        unit: template.work_type?.unit || 'szt',
        quantity,
        unit_price: workPrice,
        total_price: quantity * workPrice,
        labor_hours: laborHours,
        material_cost: materialCost,
        equipment_cost: equipmentCost,
        source_template_id: template.id,
        source_answer_id: answer.id,
      };

      result.items.push(estimateItem);
    }

    // 6. Преобразуем Map в массивы
    result.materials = Array.from(materialsMap.values());
    result.equipment = Array.from(equipmentMap.values());

    // 7. Считаем итоги
    result.totals.workTotal = result.items.reduce((sum, item) => sum + item.total_price, 0);
    result.totals.materialTotal = result.materials.reduce((sum, mat) => sum + mat.total_price, 0);
    result.totals.equipmentTotal = result.equipment.reduce((sum, eq) => sum + eq.total_price, 0);
    result.totals.laborHoursTotal = result.items.reduce((sum, item) => sum + item.labor_hours, 0);
    result.totals.grandTotal =
      result.totals.workTotal + result.totals.materialTotal + result.totals.equipmentTotal;

    result.success = true;
    return result;
  } catch (error: any) {
    result.errors.push(`Błąd generowania: ${error.message}`);
    return result;
  }
}

/**
 * Сохраняет сгенерированную смету в БД
 */
export async function saveGeneratedEstimate(
  requestId: string,
  formId: string,
  companyId: string,
  createdById: string,
  generationResult: EstimateGenerationResult,
  priceListId?: string
): Promise<{ success: boolean; estimateId?: string; error?: string }> {
  try {
    // Создаем смету
    const { data: estimate, error: estimateError } = await supabase
      .from('kosztorys_estimates')
      .insert({
        request_id: requestId,
        form_id: formId,
        company_id: companyId,
        price_list_id: priceListId,
        created_by_id: createdById,
        status: 'draft',
        version: 1,
        work_total: generationResult.totals.workTotal,
        material_total: generationResult.totals.materialTotal,
        equipment_total: generationResult.totals.equipmentTotal,
        labor_hours_total: generationResult.totals.laborHoursTotal,
        grand_total: generationResult.totals.grandTotal,
        margin_percent: 0,
        discount_percent: 0,
        final_total: generationResult.totals.grandTotal,
      })
      .select()
      .single();

    if (estimateError || !estimate) {
      return { success: false, error: estimateError?.message || 'Nie można utworzyć kosztorysu' };
    }

    // Добавляем позиции сметы
    if (generationResult.items.length > 0) {
      const estimateItems = generationResult.items.map((item, index) => ({
        estimate_id: estimate.id,
        position_number: index + 1,
        work_type_id: item.work_type_id,
        work_code: item.work_code,
        work_name: item.work_name,
        room_code: item.room_code,
        room_name: item.room_name,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        labor_hours: item.labor_hours,
        material_cost: item.material_cost,
        equipment_cost: item.equipment_cost,
      }));

      const { error: itemsError } = await supabase
        .from('kosztorys_estimate_items')
        .insert(estimateItems);

      if (itemsError) {
        console.error('Error inserting estimate items:', itemsError);
      }
    }

    // Добавляем оборудование сметы
    if (generationResult.equipment.length > 0) {
      const equipmentItems = generationResult.equipment.map((eq, index) => ({
        estimate_id: estimate.id,
        position_number: index + 1,
        equipment_id: eq.equipment_id,
        equipment_code: eq.equipment_code,
        equipment_name: eq.equipment_name,
        unit: eq.unit,
        quantity: eq.quantity,
        unit_price: eq.unit_price,
        total_price: eq.total_price,
      }));

      const { error: eqError } = await supabase
        .from('kosztorys_estimate_equipment')
        .insert(equipmentItems);

      if (eqError) {
        console.error('Error inserting estimate equipment:', eqError);
      }
    }

    // Обновляем статус запроса
    await supabase
      .from('kosztorys_requests')
      .update({ status: 'estimate_generated' })
      .eq('id', requestId);

    return { success: true, estimateId: estimate.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Генерирует и сохраняет смету за один вызов
 */
export async function generateAndSaveEstimate(
  formId: string,
  requestId: string,
  companyId: string,
  createdById: string,
  priceListId?: string
): Promise<EstimateGenerationResult & { estimateId?: string }> {
  // Сначала генерируем
  const result = await generateEstimateFromForm(formId, requestId, companyId, priceListId);

  if (!result.success) {
    return result;
  }

  // Затем сохраняем (даже если нет позиций - создаем пустой коштрис)
  const saveResult = await saveGeneratedEstimate(
    requestId,
    formId,
    companyId,
    createdById,
    result,
    priceListId
  );

  if (!saveResult.success) {
    result.errors.push(saveResult.error || 'Nie można zapisać kosztorysu');
    result.success = false;
  } else {
    result.estimateId = saveResult.estimateId;
  }

  return result;
}
