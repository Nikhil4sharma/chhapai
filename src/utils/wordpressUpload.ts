/**
 * WordPress File Upload Utility
 * Handles file uploads to WordPress Media Library via REST API
 */

export interface WordPressConfig {
  enabled: boolean;
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressUploadResponse {
  success: boolean;
  url?: string;
  id?: number;
  error?: string;
}

/**
 * Upload file to WordPress Media Library
 */
export async function uploadToWordPress(
  file: File,
  config: WordPressConfig
): Promise<WordPressUploadResponse> {
  if (!config.enabled || !config.siteUrl || !config.username || !config.applicationPassword) {
    return {
      success: false,
      error: 'WordPress configuration is incomplete',
    };
  }

  try {
    // WordPress REST API endpoint for media upload
    const apiUrl = `${config.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/media`;

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);

    // Create Basic Auth header
    const credentials = btoa(`${config.username}:${config.applicationPassword}`);
    const authHeader = `Basic ${credentials}`;

    // Upload file to WordPress
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `WordPress upload failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    return {
      success: true,
      url: data.source_url || data.guid?.rendered || data.link,
      id: data.id,
    };
  } catch (error) {
    console.error('WordPress upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete file from WordPress Media Library
 */
export async function deleteFromWordPress(
  mediaId: number,
  config: WordPressConfig
): Promise<boolean> {
  if (!config.enabled || !config.siteUrl || !config.username || !config.applicationPassword) {
    return false;
  }

  try {
    const apiUrl = `${config.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/media/${mediaId}?force=true`;

    const credentials = btoa(`${config.username}:${config.applicationPassword}`);
    const authHeader = `Basic ${credentials}`;

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('WordPress delete error:', error);
    return false;
  }
}

/**
 * Test WordPress connection
 */
export async function testWordPressConnection(
  config: WordPressConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.siteUrl || !config.username || !config.applicationPassword) {
    return {
      success: false,
      message: 'Please fill in all WordPress credentials',
    };
  }

  try {
    // Test by fetching current user info
    const apiUrl = `${config.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/users/me`;

    const credentials = btoa(`${config.username}:${config.applicationPassword}`);
    const authHeader = `Basic ${credentials}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.message || `Connection failed: ${response.status} ${response.statusText}`,
      };
    }

    const userData = await response.json();
    return {
      success: true,
      message: `Successfully connected as ${userData.name || userData.username}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
    };
  }
}

