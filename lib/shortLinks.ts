import { supabase } from './supabase';

/**
 * Generate a random short code (6 alphanumeric characters).
 */
function generateCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Create a short link for the given target URL.
 * Returns the full short URL (e.g. https://portal.maxmaster.info/r.html?c=AbC123).
 */
export async function createShortLink(targetUrl: string, userId?: string): Promise<string | null> {
    const code = generateCode();

    const { error } = await supabase
        .from('short_links')
        .insert({
            code,
            target_url: targetUrl,
            created_by: userId || null,
        });

    if (error) {
        console.error('Error creating short link:', error);
        // On conflict (unlikely with 6 chars), retry once
        if (error.code === '23505') {
            const retryCode = generateCode();
            const { error: retryError } = await supabase
                .from('short_links')
                .insert({
                    code: retryCode,
                    target_url: targetUrl,
                    created_by: userId || null,
                });
            if (retryError) {
                console.error('Retry failed:', retryError);
                return null;
            }
            return `${window.location.origin}/r.html?c=${retryCode}`;
        }
        return null;
    }

    return `${window.location.origin}/r.html?c=${code}`;
}
