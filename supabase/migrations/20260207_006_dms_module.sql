-- =====================================================
-- Migration: DMS Module (Dokumenty)
-- Date: 2026-02-07
-- Description: Document management system with versioning
-- =====================================================

-- 1. DMS Folders
CREATE TABLE IF NOT EXISTS dms_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  path_ids UUID[] DEFAULT '{}',
  color TEXT DEFAULT '#6366f1',
  is_system BOOLEAN DEFAULT FALSE,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by_id UUID
);

-- 2. DMS Files
CREATE TABLE IF NOT EXISTS dms_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES dms_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  extension TEXT,
  mime_type TEXT,
  size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  preview_url TEXT,
  -- Versioning
  version INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT TRUE,
  parent_file_id UUID REFERENCES dms_files(id) ON DELETE SET NULL,
  version_comment TEXT,
  -- Content
  checksum TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  content_text TEXT,
  -- Meta
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by_id UUID
);

-- 3. DMS Permissions
DO $$ BEGIN
  CREATE TYPE dms_permission AS ENUM ('view', 'download', 'edit', 'delete', 'manage');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS dms_file_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES dms_files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER,
  permission dms_permission NOT NULL,
  inherited BOOLEAN DEFAULT FALSE,
  inherited_from_id UUID,
  granted_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CHECK (file_id IS NOT NULL OR folder_id IS NOT NULL)
);

-- 4. DMS Activity Log
DO $$ BEGIN
  CREATE TYPE dms_activity_action AS ENUM (
    'created', 'viewed', 'downloaded', 'updated', 'renamed',
    'moved', 'deleted', 'restored', 'permission_changed', 'version_created'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS dms_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_id UUID REFERENCES dms_files(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES dms_folders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  action dms_activity_action NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DMS Bookmarks
CREATE TABLE IF NOT EXISTS dms_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES dms_files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (file_id IS NOT NULL OR folder_id IS NOT NULL),
  UNIQUE(user_id, file_id),
  UNIQUE(user_id, folder_id)
);

-- 6. DMS Tags
CREATE TABLE IF NOT EXISTS dms_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- 7. DMS File Tags (many-to-many)
CREATE TABLE IF NOT EXISTS dms_file_tags (
  file_id UUID NOT NULL REFERENCES dms_files(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES dms_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (file_id, tag_id)
);

-- 8. DMS Shares (external sharing)
CREATE TABLE IF NOT EXISTS dms_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES dms_files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES dms_folders(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (file_id IS NOT NULL OR folder_id IS NOT NULL)
);

-- 9. Enable RLS
ALTER TABLE dms_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dms_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE dms_file_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dms_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dms_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dms_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE dms_file_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE dms_shares ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies
CREATE POLICY "dms_folders_company_access" ON dms_folders
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "dms_files_company_access" ON dms_files
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "dms_file_permissions_access" ON dms_file_permissions
  FOR ALL USING (
    user_id = auth.uid() OR
    granted_by_id = auth.uid() OR
    file_id IN (SELECT id FROM dms_files WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())) OR
    folder_id IN (SELECT id FROM dms_folders WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

CREATE POLICY "dms_activity_log_company_access" ON dms_activity_log
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "dms_bookmarks_user_access" ON dms_bookmarks
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "dms_tags_company_access" ON dms_tags
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "dms_file_tags_access" ON dms_file_tags
  FOR ALL USING (file_id IN (
    SELECT id FROM dms_files WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "dms_shares_access" ON dms_shares
  FOR ALL USING (
    created_by_id = auth.uid() OR
    file_id IN (SELECT id FROM dms_files WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())) OR
    folder_id IN (SELECT id FROM dms_folders WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

-- 11. Indexes
CREATE INDEX IF NOT EXISTS idx_dms_folders_company ON dms_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_dms_folders_project ON dms_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_dms_folders_parent ON dms_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_dms_folders_path ON dms_folders(path);
CREATE INDEX IF NOT EXISTS idx_dms_files_company ON dms_files(company_id);
CREATE INDEX IF NOT EXISTS idx_dms_files_project ON dms_files(project_id);
CREATE INDEX IF NOT EXISTS idx_dms_files_folder ON dms_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_dms_files_parent ON dms_files(parent_file_id);
CREATE INDEX IF NOT EXISTS idx_dms_files_extension ON dms_files(extension);
CREATE INDEX IF NOT EXISTS idx_dms_activity_log_company ON dms_activity_log(company_id);
CREATE INDEX IF NOT EXISTS idx_dms_activity_log_file ON dms_activity_log(file_id);
CREATE INDEX IF NOT EXISTS idx_dms_activity_log_folder ON dms_activity_log(folder_id);
CREATE INDEX IF NOT EXISTS idx_dms_activity_log_user ON dms_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_dms_bookmarks_user ON dms_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_dms_shares_token ON dms_shares(share_token);

-- 12. Triggers
CREATE TRIGGER update_dms_folders_updated_at BEFORE UPDATE ON dms_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dms_files_updated_at BEFORE UPDATE ON dms_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. Function to update folder path
CREATE OR REPLACE FUNCTION update_folder_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
  parent_path_ids UUID[];
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := '/' || NEW.name;
    NEW.path_ids := ARRAY[NEW.id];
  ELSE
    SELECT path, path_ids INTO parent_path, parent_path_ids
    FROM dms_folders WHERE id = NEW.parent_id;
    NEW.path := parent_path || '/' || NEW.name;
    NEW.path_ids := parent_path_ids || NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_folder_path_trigger
  BEFORE INSERT OR UPDATE OF parent_id, name ON dms_folders
  FOR EACH ROW EXECUTE FUNCTION update_folder_path();

-- 14. Function to extract file extension
CREATE OR REPLACE FUNCTION extract_file_extension()
RETURNS TRIGGER AS $$
BEGIN
  NEW.extension := LOWER(SUBSTRING(NEW.original_name FROM '\.([^.]+)$'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER extract_file_extension_trigger
  BEFORE INSERT OR UPDATE OF original_name ON dms_files
  FOR EACH ROW EXECUTE FUNCTION extract_file_extension();

-- 15. Full-text search index for file content
CREATE INDEX IF NOT EXISTS idx_dms_files_content_search ON dms_files
  USING gin(to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(content_text, '')));
