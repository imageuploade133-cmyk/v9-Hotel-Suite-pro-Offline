import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase/client-init';

export interface UploadedImage {
  url: string;
  path: string;
  fileName: string;
}

export interface ImageUploadProgress {
  total: number;
  uploaded: number;
  failed: number;
  urls: string[];
}

/**
 * Upload multiple images to Firebase Storage
 * @param files - Array of File objects to upload
 * @param folder - Storage folder path (default: 'guest-reports')
 * @param onProgress - Optional callback for progress updates
 * @returns Promise with array of uploaded image URLs
 */
export async function uploadImagesToFirebase(
  files: File[],
  folder: string = 'guest-reports',
  onProgress?: (progress: ImageUploadProgress) => void
): Promise<UploadedImage[]> {
  if (!files || files.length === 0) {
    return [];
  }

  const progress: ImageUploadProgress = {
    total: files.length,
    uploaded: 0,
    failed: 0,
    urls: []
  };

  const uploadPromises = files.map(async (file, index) => {
    try {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `${timestamp}-${randomId}.${extension}`;
      const filePath = `${folder}/${fileName}`;

      // Create storage reference
      const storageRef = ref(storage, filePath);

      // Upload file
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          folder: folder
        }
      });

      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      progress.uploaded++;
      progress.urls.push(downloadURL);

      if (onProgress) {
        onProgress(progress);
      }

      return {
        url: downloadURL,
        path: filePath,
        fileName: fileName
      };

    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      progress.failed++;

      if (onProgress) {
        onProgress(progress);
      }

      throw error;
    }
  });

  try {
    const results = await Promise.allSettled(uploadPromises);

    // Filter successful uploads
    const successfulUploads = results
      .filter((result): result is PromiseFulfilledResult<UploadedImage> =>
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    return successfulUploads;

  } catch (error) {
    console.error('Error in batch upload:', error);
    throw error;
  }
}

/**
 * Upload a single image to Firebase Storage
 * @param file - File object to upload
 * @param folder - Storage folder path (default: 'guest-reports')
 * @returns Promise with uploaded image data
 */
export async function uploadImageToFirebase(
  file: File,
  folder: string = 'guest-reports'
): Promise<UploadedImage> {
  const results = await uploadImagesToFirebase([file], folder);

  if (results.length === 0) {
    throw new Error('Failed to upload image');
  }

  return results[0];
}

/**
 * Validate image file
 * @param file - File object to validate
 * @returns Validation result with success flag and optional error message
 */
export function validateImageFile(file: File): { success: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'Only image files are allowed' };
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { success: false, error: 'Image size must be less than 5MB' };
  }

  // Check minimum file size
  const minSize = 1024; // 1KB
  if (file.size < minSize) {
    return { success: false, error: 'Image file is too small' };
  }

  return { success: true };
}

/**
 * Compress image file (basic compression)
 * @param file - File object to compress
 * @param maxWidth - Maximum width (default: 1920)
 * @param maxHeight - Maximum height (default: 1080)
 * @param quality - JPEG quality (default: 0.8)
 * @returns Promise with compressed File object
 */
export function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate image thumbnail
 * @param file - File object to create thumbnail from
 * @param size - Thumbnail size (default: 200x200)
 * @returns Promise with thumbnail File object
 */
export function generateThumbnail(
  file: File,
  size: number = 200
): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      const dimension = Math.min(img.width, img.height);

      // Crop to square
      const sx = (img.width - dimension) / 2;
      const sy = (img.height - dimension) / 2;

      canvas.width = size;
      canvas.height = size;

      ctx.drawImage(img, sx, sy, dimension, dimension, 0, 0, size, size);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], `thumb-${file.name}`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(thumbnailFile);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.7
      );
    };

    img.src = URL.createObjectURL(file);
  });
}