/**
 * KNR Data Import Script
 * Imports folders, positions, and prices from JSON export files into Supabase
 *
 * Usage: npx ts-node scripts/importKnrData.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase configuration
const supabaseUrl = 'https://diytvuczpciikzdhldny.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_KEY environment variable is required');
  console.log('Set it with: export SUPABASE_SERVICE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Data paths
const DATA_DIR = path.join(__dirname, '../docs/budzetuje_export_20260213_181005');

interface Folder {
  xid: string;
  basis: string;
  name: string;
  path: string;
  depth: number;
}

interface RmsPosition {
  type: string;
  ordinalNumber: number;
  norm: number;
  rms: {
    type: string;
    name: string;
    unit: string;
    index: string;
    xid: string;
    rmsCode: number;
  };
}

interface Position {
  path: string;
  basis: string;
  name: string;
  unit: string;
  xid: string;
  ordinalNumber: number;
  full_data: {
    basis: string;
    name: string;
    ordinalNumber: number;
    unit: string;
    rmsPositions: RmsPosition[];
    choiceCriteria: any[];
    xid: string;
    rootXid: string;
  };
}

interface Price {
  rms_index: string;
  rms_type: string;
  name: string;
  min_price: number;
  avg_price: number;
  max_price: number;
  unit: string;
  region: string;
  source: string;
  timestamp: string;
}

async function importFolders(): Promise<void> {
  console.log('📁 Importing folders...');

  const foldersPath = path.join(DATA_DIR, 'folders.json');
  const foldersData: Folder[] = JSON.parse(fs.readFileSync(foldersPath, 'utf-8'));

  console.log(`Found ${foldersData.length} folders`);

  // Build parent relationships
  const foldersByPath = new Map<string, Folder>();
  foldersData.forEach(f => foldersByPath.set(f.path, f));

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < foldersData.length; i += batchSize) {
    const batch = foldersData.slice(i, i + batchSize).map(folder => {
      // Find parent xid by parsing path
      const pathParts = folder.path.split(' / ');
      let parentXid: string | null = null;
      if (pathParts.length > 1) {
        const parentPath = pathParts.slice(0, -1).join(' / ');
        const parent = foldersByPath.get(parentPath);
        parentXid = parent?.xid || null;
      }

      return {
        xid: folder.xid,
        basis: folder.basis,
        name: folder.name,
        path: folder.path,
        depth: folder.depth,
        parent_xid: parentXid,
        is_system: true,
        company_id: null,
      };
    });

    const { error } = await supabase.from('knr_folders').upsert(batch, {
      onConflict: 'xid',
    });

    if (error) {
      console.error(`Error importing folders batch ${i}:`, error);
    } else {
      console.log(`  Imported folders ${i + 1} - ${Math.min(i + batchSize, foldersData.length)}`);
    }
  }

  console.log('✅ Folders import complete');
}

async function importPositions(): Promise<void> {
  console.log('📋 Importing positions...');

  const positionsPath = path.join(DATA_DIR, 'positions_full.json');
  const positionsData: Position[] = JSON.parse(fs.readFileSync(positionsPath, 'utf-8'));

  console.log(`Found ${positionsData.length} positions`);

  // First, get all folder xids by path to find matching folders
  const { data: folders } = await supabase
    .from('knr_folders')
    .select('xid, path')
    .eq('is_system', true);

  const foldersByPath = new Map<string, string>();
  folders?.forEach(f => foldersByPath.set(f.path, f.xid));

  // Process positions in batches
  const batchSize = 100;
  for (let i = 0; i < positionsData.length; i += batchSize) {
    const batch = positionsData.slice(i, i + batchSize);

    // Insert positions
    const positionRecords = batch.map(pos => {
      // Find folder xid by matching path
      let folderXid = pos.full_data.rootXid;
      // Try to find the deepest matching folder
      const pathParts = pos.path.split(' / ');
      for (let j = pathParts.length; j > 0; j--) {
        const testPath = pathParts.slice(0, j).join(' / ');
        const foundXid = foldersByPath.get(testPath);
        if (foundXid) {
          folderXid = foundXid;
          break;
        }
      }

      return {
        xid: pos.xid,
        folder_xid: folderXid,
        root_xid: pos.full_data.rootXid,
        basis: pos.basis,
        name: pos.name,
        unit: pos.unit,
        ordinal_number: pos.ordinalNumber,
        path: pos.path,
        is_system: true,
        company_id: null,
      };
    });

    const { error: posError } = await supabase.from('knr_positions').upsert(positionRecords, {
      onConflict: 'xid',
    });

    if (posError) {
      console.error(`Error importing positions batch ${i}:`, posError);
      continue;
    }

    // Insert position resources
    const resourceRecords: any[] = [];
    batch.forEach(pos => {
      if (pos.full_data.rmsPositions) {
        pos.full_data.rmsPositions.forEach(rms => {
          resourceRecords.push({
            position_xid: pos.xid,
            rms_xid: rms.rms.xid,
            type: rms.type,
            ordinal_number: rms.ordinalNumber,
            norm: rms.norm,
            rms_name: rms.rms.name,
            rms_unit: rms.rms.unit,
            rms_index: rms.rms.index,
            rms_code: rms.rms.rmsCode,
          });
        });
      }
    });

    if (resourceRecords.length > 0) {
      // Delete existing resources for these positions first
      const positionXids = batch.map(p => p.xid);
      await supabase.from('knr_position_resources').delete().in('position_xid', positionXids);

      const { error: resError } = await supabase.from('knr_position_resources').insert(resourceRecords);
      if (resError) {
        console.error(`Error importing resources batch ${i}:`, resError);
      }
    }

    console.log(`  Imported positions ${i + 1} - ${Math.min(i + batchSize, positionsData.length)}`);
  }

  console.log('✅ Positions import complete');
}

async function importPrices(): Promise<void> {
  console.log('💰 Importing prices...');

  const pricesPath = path.join(DATA_DIR, 'eko_prices_20260213_202356.json');
  const pricesData: Price[] = JSON.parse(fs.readFileSync(pricesPath, 'utf-8'));

  console.log(`Found ${pricesData.length} prices`);

  // Get system price source ID
  const priceSourceId = '00000000-0000-0000-0000-000000000001';

  // Process in batches
  const batchSize = 100;
  for (let i = 0; i < pricesData.length; i += batchSize) {
    const batch = pricesData.slice(i, i + batchSize).map(price => ({
      price_source_id: priceSourceId,
      rms_index: price.rms_index,
      rms_type: price.rms_type,
      name: price.name,
      unit: price.unit,
      min_price: price.min_price,
      avg_price: price.avg_price,
      max_price: price.max_price,
      region: price.region,
      timestamp: price.timestamp,
    }));

    const { error } = await supabase.from('resource_prices').upsert(batch, {
      onConflict: 'price_source_id,rms_index',
    });

    if (error) {
      console.error(`Error importing prices batch ${i}:`, error);
    } else {
      console.log(`  Imported prices ${i + 1} - ${Math.min(i + batchSize, pricesData.length)}`);
    }
  }

  console.log('✅ Prices import complete');
}

async function main(): Promise<void> {
  console.log('🚀 Starting KNR data import...\n');

  try {
    await importFolders();
    console.log('');
    await importPositions();
    console.log('');
    await importPrices();
    console.log('\n🎉 All data imported successfully!');
  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  }
}

main();
