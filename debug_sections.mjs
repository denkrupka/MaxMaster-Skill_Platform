import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://diytvuczpciikzdhldny.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeXR2dWN6cGNpaWt6ZGhsZG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0MTkwMzMsImV4cCI6MjA1MTk5NTAzM30.VnOxPaSjSIaVYEXnvME7L8U-JlDWLsSdHChYY9YsP0M');

const { data } = await supabase.from('kosztorys_estimates').select('id, name, data_json').order('updated_at', { ascending: false }).limit(1);
if (!data || !data[0]) { console.log('No estimates found'); process.exit(); }
const est = data[0];
const dj = est.data_json;
console.log('Estimate:', est.id, est.name);
console.log('Root sectionIds:', dj.root.sectionIds);
console.log('Root positionIds count:', (dj.root.positionIds || []).length);
console.log('Total sections:', Object.keys(dj.sections).length);
console.log('Total positions:', Object.keys(dj.positions).length);
console.log('---');
for (const sId of dj.root.sectionIds) {
  const sec = dj.sections[sId];
  if (!sec) { console.log('Section', sId, 'NOT FOUND!'); continue; }
  console.log('Section:', sId, '|', sec.name, '| posIds:', (sec.positionIds||[]).length, '| subIds:', (sec.subsectionIds||[]).length);
  for (const subId of (sec.subsectionIds || [])) {
    const sub = dj.sections[subId];
    if (!sub) { console.log('  Sub', subId, 'NOT FOUND!'); continue; }
    console.log('  Sub:', subId, '|', sub.name, '| posIds:', (sub.positionIds||[]).length, '| subIds:', (sub.subsectionIds||[]).length);
    for (const sub2Id of (sub.subsectionIds || [])) {
      const sub2 = dj.sections[sub2Id];
      if (!sub2) { console.log('    Sub2:', sub2Id, '|', sub2.name, '| posIds:', (sub2.positionIds||[]).length); continue; }
      console.log('    Sub2:', sub2Id, '|', sub2.name, '| posIds:', (sub2.positionIds||[]).length, '| subIds:', (sub2.subsectionIds||[]).length);
    }
  }
}
