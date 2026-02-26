"""
Generate SQL seed file for system labour catalog from labours.xlsx
Outputs: supabase/migrations/20260225_002_labour_seed.sql
"""
import openpyxl
import uuid
import re

wb = openpyxl.load_workbook('docs/Robocizna/labours.xlsx')
ws = wb.active

def escape_sql(val):
    if val is None:
        return 'NULL'
    s = str(val).strip()
    if not s:
        return 'NULL'
    return "'" + s.replace("'", "''") + "'"

def escape_sql_or_null(val):
    if val is None:
        return 'NULL'
    s = str(val).strip()
    if not s or s == 'None':
        return 'NULL'
    return "'" + s.replace("'", "''") + "'"

def num_or_null(val):
    if val is None:
        return 'NULL'
    try:
        f = float(val)
        return str(f)
    except:
        return 'NULL'

# ===== STEP 1: Parse categories =====
# category_path format: "Level1 / Level2 / Level3"
# We build a hierarchy from paths

categories_by_path = {}  # full_path -> { id, name, number, path, parent_path, depth }
rows_data = []

for row in ws.iter_rows(min_row=2, values_only=True):
    source_id, code, name, unit, description, col6, comments, pkwiu, price_unit, category_id, category_name, category_number, category_path, tags = row
    if not name:
        continue

    rows_data.append(row)

    if category_path:
        cp = str(category_path).strip()
        # Normalize separators: split on / with optional spaces, then rejoin with ' / '
        raw_parts = [p.strip() for p in re.split(r'\s*/\s*', cp) if p.strip()]
        # Rebuild normalized path
        normalized_path = ' / '.join(raw_parts)

        # Build all intermediate paths
        for i, part in enumerate(raw_parts):
            full_path = ' / '.join(raw_parts[:i+1])
            if full_path not in categories_by_path:
                parent_path = ' / '.join(raw_parts[:i]) if i > 0 else None
                # Use the leaf category info for the leaf, generic info for intermediaries
                cat_number = None
                cat_name = part
                if i == len(raw_parts) - 1 and category_number:
                    cat_number = str(category_number).strip()

                categories_by_path[full_path] = {
                    'id': str(uuid.uuid4()),
                    'name': cat_name,
                    'number': cat_number,
                    'path': full_path,
                    'parent_path': parent_path,
                    'depth': i,
                }

# Resolve parent_ids
for path, cat in categories_by_path.items():
    if cat['parent_path'] and cat['parent_path'] in categories_by_path:
        cat['parent_id'] = categories_by_path[cat['parent_path']]['id']
    else:
        cat['parent_id'] = None

# Sort by depth then by path for consistent ordering
sorted_cats = sorted(categories_by_path.values(), key=lambda c: (c['depth'], c['path']))

# ===== STEP 2: Generate SQL =====
lines = []
lines.append('-- =====================================================')
lines.append('-- LABOUR CATALOG SEED DATA')
lines.append(f'-- Generated from labours.xlsx: {len(rows_data)} labours, {len(sorted_cats)} categories')
lines.append('-- =====================================================')
lines.append('')
lines.append('-- =====================================================')
lines.append('-- 1. System labour categories')
lines.append('-- =====================================================')
lines.append('')

# Insert categories (parent rows first due to FK)
for i, cat in enumerate(sorted_cats):
    parent_id = f"'{cat['parent_id']}'" if cat['parent_id'] else 'NULL'
    number = escape_sql_or_null(cat['number'])
    lines.append(
        f"INSERT INTO public.kosztorys_system_labour_categories (id, name, number, path, parent_id, sort_order, depth) "
        f"VALUES ('{cat['id']}', {escape_sql(cat['name'])}, {number}, {escape_sql(cat['path'])}, "
        f"{parent_id}, {i}, {cat['depth']});"
    )

lines.append('')
lines.append('-- =====================================================')
lines.append('-- 2. System labours')
lines.append('-- =====================================================')
lines.append('')

# Batch insert labours in groups of 100 for performance
batch_size = 100
for batch_start in range(0, len(rows_data), batch_size):
    batch = rows_data[batch_start:batch_start + batch_size]

    lines.append(f"INSERT INTO public.kosztorys_system_labours (source_id, code, name, unit, description, comments, pkwiu, price_unit, category_id, category_name, category_number, category_path, tags) VALUES")

    value_lines = []
    for row in batch:
        source_id, code, name, unit, description, col6, comments, pkwiu, price_unit, category_id, category_name, category_number, category_path, tags = row

        # Normalize category_path to use consistent ' / ' separator
        norm_cp = None
        if category_path:
            raw = [p.strip() for p in re.split(r'\s*/\s*', str(category_path).strip()) if p.strip()]
            norm_cp = ' / '.join(raw)

        value_lines.append(
            f"  ({num_or_null(source_id)}, {escape_sql(code)}, {escape_sql(name)}, {escape_sql(unit)}, "
            f"{escape_sql_or_null(description)}, {escape_sql_or_null(comments)}, {escape_sql_or_null(pkwiu)}, "
            f"{num_or_null(price_unit)}, {num_or_null(category_id)}, {escape_sql_or_null(category_name)}, "
            f"{escape_sql_or_null(category_number)}, {escape_sql_or_null(norm_cp)}, {escape_sql_or_null(tags)})"
        )

    lines.append(',\n'.join(value_lines) + ';')
    lines.append('')

# Write output
output_path = 'supabase/migrations/20260225_002_labour_seed.sql'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f"Generated {output_path}")
print(f"  Categories: {len(sorted_cats)}")
print(f"  Labours: {len(rows_data)}")
print(f"  Top-level categories: {sum(1 for c in sorted_cats if c['depth'] == 0)}")
