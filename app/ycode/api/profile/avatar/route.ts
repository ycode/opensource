import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { storage } from '@/lib/storage';
import { parseSupabaseConfig } from '@/lib/supabase-config-parser';
import { noCache } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import sharp from 'sharp';

import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseConfig } from '@/types';

const STORAGE_BUCKET = 'avatars';

/**
 * POST /ycode/api/profile/avatar
 *
 * Upload user's profile photo
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return noCache({ error: 'No file provided' }, 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return noCache({ error: 'Only image files are allowed' }, 400);
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return noCache({ error: 'File size must be less than 5MB' }, 400);
    }

    // Get Supabase config
    const config = await storage.get<SupabaseConfig>('supabase_config');

    if (!config) {
      return noCache({ error: 'Supabase not configured' }, 500);
    }

    const credentials = parseSupabaseConfig(config);
    const cookieStore = await cookies();

    // Create Supabase client to get current user
    const supabase = createServerClient(credentials.projectUrl, credentials.anonKey, {
      cookies: {
        get(cookieName: string) {
          return cookieStore.get(cookieName)?.value;
        },
        set(cookieName: string, value: string, options: CookieOptions) {
          cookieStore.set({ name: cookieName, value, ...options });
        },
        remove(cookieName: string, options: CookieOptions) {
          cookieStore.set({ name: cookieName, value: '', ...options });
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return noCache({ error: 'Not authenticated' }, 401);
    }

    // Use admin client for storage operations
    const adminClient = await getSupabaseAdmin();

    if (!adminClient) {
      return noCache({ error: 'Server configuration error' }, 500);
    }

    // Convert image to WebP and resize for avatar
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const webpBuffer = await sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    // Create storage path with user ID
    const timestamp = Date.now();
    const storagePath = `${user.id}/${timestamp}.webp`;

    // Delete old avatar if exists
    const oldAvatarUrl = user.user_metadata?.avatar_url;
    if (oldAvatarUrl) {
      try {
        // Extract path from URL
        const urlParts = oldAvatarUrl.split('/avatars/');
        if (urlParts.length > 1) {
          const oldPath = urlParts[1];
          await adminClient.storage.from(STORAGE_BUCKET).remove([oldPath]);
        }
      } catch (error) {
        console.error('Failed to delete old avatar:', error);
        // Continue even if deletion fails
      }
    }

    // Ensure avatars bucket exists
    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

    if (!bucketExists) {
      const { error: createBucketError } = await adminClient.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/*'],
      });

      if (createBucketError) {
        console.error('Failed to create avatars bucket:', createBucketError);
        return noCache({ error: `Failed to create storage bucket: ${createBucketError.message}` }, 500);
      }
    }

    // Upload new avatar
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, webpBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/webp',
      });

    if (uploadError) {
      console.error('Failed to upload avatar:', uploadError);
      return noCache({ error: `Failed to upload avatar: ${uploadError.message}` }, 500);
    }

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(uploadData.path);

    // Update user metadata with new avatar URL
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: urlData.publicUrl,
      },
    });

    if (updateError) {
      console.error('Failed to update user metadata:', updateError);
      return noCache({ error: 'Failed to update profile' }, 500);
    }

    return noCache({
      data: {
        avatar_url: urlData.publicUrl,
        user: updateData.user,
      },
    });
  } catch (error) {
    console.error('Failed to upload avatar:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return noCache({ error: `Failed to upload avatar: ${message}` }, 500);
  }
}
