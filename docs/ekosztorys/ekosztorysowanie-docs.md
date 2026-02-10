# eKosztorysowanie - Техническая документация

## 📊 Структура данных

### 1. CostEstimate (Смета)

```typescript
interface CostEstimate {
  id: string;                    // UUID
  settings: CostEstimateSettings;
  data: CostEstimateData;
}

interface CostEstimateSettings {
  type: 'investor' | 'contractor' | 'offer';  // Тип сметы
  name: string;                               // Название
  description: string;                        // Описание
  created: string;                            // ISO datetime
  modified: string;
  defaultCurrency: 'PLN' | 'EUR';
  
  print: PrintSettings;
  precision: PrecisionSettings;
  calculationTemplate: 'overhead-on-top' | 'overhead-included';
}

interface PrintSettings {
  pages: PrintPage[];
  titlePage: TitlePageSettings;
}

interface PrintPage {
  type: 'predefined';
  name: 'title' | 'detailed-cost-calculations' | 'simplified-cost-estimate.offer' 
        | 'assembled-elements' | 'measurements' | 'cost-estimate.offer' 
        | 'cost-estimate.investor' | 'labor-list' | 'equipment-list' | 'material-list';
}

interface TitlePageSettings {
  companyInfo: {
    name: string;
    address: string;
    contacts: string[];
  };
  documentTitle: string;
  showCostFields: boolean;
  showManHourRate: boolean;
  showOverheadsCosts: boolean;
  orderDetails: {
    orderName: string;
    constructionSiteAddress: string;
  };
  clientDetails: {
    clientName: string;
    clientAddress: string;
  };
  contractorDetails: {
    contractorName: string;
    contractorAddress: string;
    industry: string;
  };
  participants: {
    preparedBy: string;
    preparedAt: string;
    preparedByIndustry: string;
    checkedBy: string;
    checkedAt: string;
    checkedByIndustry: string;
  };
}

interface PrecisionSettings {
  norms: number;          // Точность норм (6-7 знаков)
  resources: number;      // Точность ресурсов (2 знака)
  measurements: number;   // Точность обмеров (2-3 знака)
  unitValues: number;     // Точность ед. значений (2 знака)
  positionBase: number;   // Точность позиции (1-2 знака)
  costEstimateBase: number;  // Точность сметы (2 знака)
  roundingMethod: 'default' | 'PN-70/N-02120';
}
```

### 2. CostEstimateData (Данные сметы)

```typescript
interface CostEstimateData {
  root: RootData;
  sections: Record<string, Section>;
  positions: Record<string, Position>;
}

interface RootData {
  sectionIds: string[];      // ID разделов верхнего уровня
  positionIds: string[];     // ID позиций вне разделов
  factor: Factors;           // Глобальные коэффициенты
  overheads: Overhead[];     // Накладные расходы
}

interface Factors {
  labor: number;       // Коэффициент на робочизну (r-g)
  material: number;    // Коэффициент на материалы
  equipment: number;   // Коэффициент на оборудование
  waste: number;       // Коэффициент на отходы
}
```

### 3. Section (Раздел/Глава)

```typescript
interface Section {
  id: string;
  name: string;
  description: string;
  positionIds: string[];      // Позиции в разделе
  subsectionIds: string[];    // Подразделы
  factors: Factors;           // Коэффициенты раздела
  overheads: Overhead[];      // Накладные раздела
}
```

### 4. Position (Позиция сметы) ⭐ ГЛАВНЫЙ ОБЪЕКТ

```typescript
interface Position {
  id: string;
  base: string;              // Норматив: "KNNR 5 0701-01"
  originBase: string;        // Исходный норматив
  name: string;              // "Kopanie rowów dla kabli..."
  marker: string | null;     // Маркер/тег
  
  unit: Unit;                // Единица измерения
  measurements: Measurements; // Обмеры
  multiplicationFactor: number;  // Множитель позиции
  
  resources: Resource[];     // Ресурсы (труд, материалы, техника)
  factors: Factors;          // Коэффициенты позиции
  overheads: Overhead[];     // Накладные позиции
  
  unitPrice: Money;          // Цена за единицу (для упрощённых смет)
}

interface Unit {
  label: string;      // "m3", "r-g", "szt."
  unitIndex: string;  // "060", "149", "020"
}

interface Money {
  value: number;
  currency: 'PLN' | 'EUR';
}
```

### 5. Measurements (Обмеры/Количество)

```typescript
interface Measurements {
  rootIds: string[];
  entries: Record<string, MeasurementEntry>;
}

interface MeasurementEntry {
  id: string;
  type: 'expression' | 'value';
  expression: string;        // Формула: "10*2.5" или "0"
  description: string | null;
}
```

### 6. Resource (Ресурс) ⭐ КЛЮЧЕВОЙ ОБЪЕКТ ДЛЯ РАСЧЁТОВ

```typescript
interface Resource {
  id: string;
  name: string;              // "robotnicy", "kabel YKY 3x2.5"
  index: string | null;      // Индекс в каталоге
  originIndex: {
    type: 'ETO' | 'KNNR' | 'custom';
    index: string;
  };
  
  type: 'labor' | 'material' | 'equipment';
  factor: number;            // Коэффициент ресурса
  
  norm: {
    type: 'absolute' | 'relative';
    value: number;           // Норма расхода (1.35 r-g на единицу)
  };
  
  unit: Unit;
  unitPrice: Money;          // Цена за единицу (51.86 PLN/r-g)
  
  group: string | null;      // Группа ресурсов
  marker: string | null;
  investorTotal: boolean;    // Для инвесторской сметы
}
```

### 7. Overhead (Накладные расходы)

```typescript
interface Overhead {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  appliesTo: ('labor' | 'material' | 'equipment')[];
}
```

---

## 🔢 Формулы расчёта

### Стоимость позиции:

```
Количество = eval(measurements.expression) × multiplicationFactor

Для каждого resource:
  Расход = Количество × resource.norm.value × resource.factor
  Стоимость ресурса = Расход × resource.unitPrice.value

Робочизна = Σ(стоимость labor ресурсов) × factors.labor
Материалы = Σ(стоимость material ресурсов) × factors.material × (1 + factors.waste/100)
Оборудование = Σ(стоимость equipment ресурсов) × factors.equipment

Итого позиция = Робочизна + Материалы + Оборудование + Накладные
```

### Накладные расходы (Narzuty):

```
Koszty pośrednie (Kp) = % от робочизны
Zysk (Z) = % от (робочизна + Kp)
Koszty zakupu (Kz) = % от материалов
```

---

## 🌐 API Endpoints

### GET
- `GET /api/units?lang=pl` — Справочник единиц измерения
- `GET /api/price/user` — Пользовательские цены
- `GET /api/organization/users?organizationId={id}` — Пользователи организации
- `GET /api/thread/all?costEstimateId={id}` — Комментарии к смете
- `GET /api/print/attachment?tenantId={id}` — Вложения для печати

### POST
- `POST /api/suggestion` — Сохранение сметы
- `POST /api/thread?trace=true&message=true` — Добавление комментария
- `POST /api/norm/import/csv` — Импорт норм из CSV
- `POST /api/export/xlsx` — Экспорт в Excel
- `POST /api/export/ath` — Экспорт в ATH формат
- `POST /api/export/ath2xml` — Экспорт в ATH XML

### PUT
- `PUT /api/price` — Обновление сметы целиком
- `PUT /api/price/single` — Обновление одного ресурса

---

## 📁 Справочник единиц (units)

| index | unit | name |
|-------|------|------|
| 020 | szt. | sztuka |
| 033 | kg | kilogram |
| 040 | m | metr |
| 050 | m2 | metr kwadratowy |
| 060 | m3 | metr sześcienny |
| 090 | kpl | komplet |
| 149 | r-g | roboczogodzina |

---

## 📋 Каталоги нормативов

- **KNNR** — Katalog Nakładów Nakładowych Roboczych
- **KNNR-W** — KNNR Wersja...
- **KNR** — Katalog Nakładów Rzeczowych
- **KSNR** — Katalog Scalonych Nakładów Rzeczowych

Формат: `KNNR 5 0701-01`
- KNNR — тип каталога
- 5 — номер тома
- 0701 — номер таблицы
- 01 — номер колонки/варианта

---

## 🏗️ Типы смет

1. **Kosztorys inwestorski** (investor) — Инвесторская смета
2. **Kosztorys wykonawczy** (contractor) — Исполнительская смета  
3. **Kosztorys ofertowy** (offer) — Офертная смета

---

## 🖨️ Отчёты для печати

1. title — Титульная страница
2. detailed-cost-calculations — Детальные калькуляции
3. simplified-cost-estimate — Упрощённая смета
4. assembled-elements — Сводка элементов
5. measurements — Обмеры
6. cost-estimate.offer / .investor — Смета
7. labor-list — Ведомость трудозатрат
8. equipment-list — Ведомость оборудования
9. material-list — Ведомость материалов
