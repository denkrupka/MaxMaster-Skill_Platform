
import { createClient } from '@supabase/supabase-js'

// Hardcoded for compatibility as requested
const supabaseUrl = 'https://diytvuczpciikzdhldny.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeXR2dWN6cGNpaWt6ZGhsZG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMTcwOTMsImV4cCI6MjA4MjU5MzA5M30.8dd75VEY_6VbHWmpbDv4nyzlpyMU0XGAtq6cxBfSbQY'

// Export for use in Edge Functions
export const SUPABASE_ANON_KEY = supabaseAnonKey;

// Klient dla standardowych operacji użytkownika
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Klient Admin - inicjalizowany tylko jeśli klucz jest dostępny
const getServiceKey = () => {
    try {
        // @ts-ignore
        return import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
    } catch {
        return '';
    }
};

const serviceKey = getServiceKey();

export const supabaseAdmin = serviceKey 
    ? createClient(supabaseUrl, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
      })
    : null;

// ============================================================
// STORAGE HELPERS
// ============================================================

export const uploadDocument = async (file: File, userId: string): Promise<string | null> => {
  const UPLOAD_TIMEOUT = 60000; // 60 seconds timeout for file uploads (increased for slow connections)

  try {
    const timestamp = Date.now();
    const fileNameParts = file.name.split('.');
    const fileExt = fileNameParts.pop()?.toLowerCase();
    const originalName = fileNameParts.join('.');

    // Improved sanitization of filename
    const cleanName = originalName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l")
      .replace(/Ł/g, "L")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const finalFileName = `${cleanName}_${timestamp}.${fileExt}`;
    const filePath = `${userId}/${finalFileName}`;

    // Map common extensions to MIME if browser fails
    let contentType = file.type;
    if (!contentType) {
        if (fileExt === 'doc') contentType = 'application/msword';
        else if (fileExt === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (fileExt === 'pdf') contentType = 'application/pdf';
    }

    console.log(`Uploading file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Upload timed out')), UPLOAD_TIMEOUT);
    });

    // Race between upload and timeout
    const uploadPromise = supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType || 'application/octet-stream'
      });

    const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as Awaited<typeof uploadPromise>;

    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    console.log(`Upload completed: ${file.name}`);
    return publicUrl;
  } catch (error: any) {
    if (error.message === 'Upload timed out') {
      console.error(`Upload timed out for file: ${file.name}`);
    } else {
      console.error('Upload error:', error);
    }
    return null;
  }
};
