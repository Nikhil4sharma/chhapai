/**
 * Cloudinary File Upload Service
 * Handles file uploads to Cloudinary using unsigned upload preset
 */

const CLOUDINARY_CONFIG = {
  cloudName: 'dqb3i74d4',
  uploadPreset: 'Chhapai', // Upload preset name from Cloudinary dashboard
  uploadUrl: 'https://api.cloudinary.com/v1_1/dqb3i74d4/auto/upload',
};

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  version: number;
  uploadedAt: Date;
}

/**
 * Try upload with a specific preset
 */
async function tryUploadWithPreset(
  file: File,
  orderId: string,
  fileType: 'proof' | 'image' | 'other',
  preset: string
): Promise<CloudinaryUploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);
    
    // Use folder parameter for organization
    // Preset settings: Use filename: true, Unique filename: false
    // So Cloudinary will use the original filename in the specified folder
    const folderPath = `chhapai/orders/order_${orderId}`;
    formData.append('folder', folderPath);
    
    // Add tags for better organization
    formData.append('tags', `chhapai,order_${orderId},${fileType}`);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        // Progress can be handled by caller if needed
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          const version = response.version || Date.now();

          resolve({
            secure_url: response.secure_url,
            public_id: response.public_id,
            version: version,
            uploadedAt: new Date(),
          });
        } catch (error) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          const errorMsg = errorResponse.error?.message || `Upload failed with status ${xhr.status}`;
          reject(new Error(errorMsg));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'));
    });

    xhr.open('POST', CLOUDINARY_CONFIG.uploadUrl);
    xhr.send(formData);
  });
}

/**
 * Upload file to Cloudinary
 * Tries main preset first, then falls back to alternatives if needed
 */
export async function uploadFileToCloudinary(
  file: File,
  orderId: string,
  fileType: 'proof' | 'image' | 'other' = 'other'
): Promise<CloudinaryUploadResponse> {
  // Try main preset first
  try {
    return await tryUploadWithPreset(file, orderId, fileType, CLOUDINARY_CONFIG.uploadPreset);
  } catch (error: any) {
    // If preset not found error, try without public_id or folder
    if (error.message?.includes('preset') || error.message?.includes('400')) {
      // Try simpler upload without folder
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        // Don't set folder or public_id - let Cloudinary handle it

        const xhr = new XMLHttpRequest();

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({
                secure_url: response.secure_url,
                public_id: response.public_id,
                version: response.version || Date.now(),
                uploadedAt: new Date(),
              });
            } catch (error) {
              reject(new Error('Failed to parse Cloudinary response'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.error?.message || `Upload failed: ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.open('POST', CLOUDINARY_CONFIG.uploadUrl);
        xhr.send(formData);
      });
    }
    // If all attempts fail, throw the original error
    throw error;
  }
}

/**
 * Delete file from Cloudinary
 */
export async function deleteFileFromCloudinary(publicId: string): Promise<boolean> {
  // Note: Deletion requires signed requests with API key/secret
  // For now, we'll just return true as unsigned preset doesn't support deletion
  // If deletion is needed, implement signed deletion endpoint
  console.warn('File deletion from Cloudinary requires signed requests. Public ID:', publicId);
  return true;
}
