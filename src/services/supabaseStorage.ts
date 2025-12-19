/**
 * Supabase Storage Service
 * Handles file uploads to Supabase Storage buckets
 */

import { supabase } from '@/integrations/supabase/client';

export interface SupabaseUploadResponse {
  url: string;
  path: string;
  uploadedAt: Date;
}

/**
 * Upload file to Supabase Storage
 * @param file - File to upload
 * @param bucket - Storage bucket name (default: 'order-files')
 * @param folderPath - Folder path within bucket (e.g., 'orders/order_123')
 * @returns Upload response with URL and path
 */
export async function uploadFileToSupabase(
  file: File,
  bucket: string = 'order-files',
  folderPath?: string
): Promise<SupabaseUploadResponse> {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}_${randomString}.${fileExt}`;
    
    // Construct full path
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL from Supabase');
    }

    return {
      url: urlData.publicUrl,
      path: filePath,
      uploadedAt: new Date(),
    };
  } catch (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw error;
  }
}

/**
 * Upload file for order (with organized folder structure)
 * @param file - File to upload
 * @param orderId - Order ID for folder organization
 * @param fileType - Type of file (proof, image, other)
 * @returns Upload response with URL and path
 */
export async function uploadOrderFile(
  file: File,
  orderId: string,
  fileType: 'proof' | 'image' | 'other' = 'other'
): Promise<SupabaseUploadResponse> {
  const folderPath = `orders/order_${orderId}/${fileType}`;
  return uploadFileToSupabase(file, 'order-files', folderPath);
}

/**
 * Upload avatar image
 * @param file - Image file
 * @param userId - User ID for folder organization
 * @returns Upload response with URL and path
 */
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<SupabaseUploadResponse> {
  const fileExt = file.name.split('.').pop();
  const fileName = `avatar.${fileExt}`;
  const folderPath = `avatars/${userId}`;
  
  // Upload with upsert to replace existing avatar
  const filePath = `${folderPath}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('order-files') // Using same bucket, can create separate 'avatars' bucket later if needed
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true, // Replace existing avatar
    });

  if (error) {
    throw new Error(`Avatar upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('order-files')
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL from Supabase');
  }

  return {
    url: urlData.publicUrl,
    path: filePath,
    uploadedAt: new Date(),
  };
}

/**
 * Delete file from Supabase Storage
 * @param filePath - Path of file to delete
 * @param bucket - Storage bucket name (default: 'order-files')
 * @returns Success status
 */
export async function deleteFileFromSupabase(
  filePath: string,
  bucket: string = 'order-files'
): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting file from Supabase:', error);
    return false;
  }
}

/**
 * Get public URL for a file
 * @param filePath - Path of file
 * @param bucket - Storage bucket name (default: 'order-files')
 * @returns Public URL
 */
export function getSupabaseFileUrl(
  filePath: string,
  bucket: string = 'order-files'
): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data?.publicUrl || '';
}

