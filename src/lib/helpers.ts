
import { Timestamp } from 'firebase/firestore';
import { setHours, setMinutes, setSeconds, parseISO, isValid } from 'date-fns';

export const getInitials = (name: string): string => {
  if (!name) return '';
  const names = name.split(' ');
  let initials = names[0].substring(0, 1).toUpperCase();

  if (names.length > 1) {
    initials += names[names.length - 1].substring(0, 1).toUpperCase();
  }
  return initials;
};

/**
 * Safely converts a Firestore timestamp, a date string, or a Date object to a valid Date object.
 * Returns null if the input is null, undefined, or results in an invalid date.
 * @param {any} timestamp - The value to convert.
 * @returns {Date | null} A valid Date object or null.
 */
export const getSafeDate = (timestamp: any): Date | null => {
  if (!timestamp) {
    return null;
  }

  // If it's already a Date object, check its validity.
  if (timestamp instanceof Date) {
    return isValid(timestamp) ? timestamp : null;
  }

  // Handle Firestore Timestamp objects (both with toDate method and {seconds, nanoseconds} structure).
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
    const date = new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
    return isValid(date) ? date : null;
  }

  // Handle string representations of dates.
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return isValid(date) ? date : null;
  }

  // If it's a number (milliseconds from epoch), create a date from it.
  if (typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isValid(date) ? date : null;
  }

  // If none of the above, it's an unrecognized format.
  return null;
};


export const getCheckoutDateTime = (date: Date, time: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
        // Return the original date if the time is invalid to prevent a crash.
        return date;
    }
    return setSeconds(setMinutes(setHours(date, hours), minutes), 0);
};

export async function uploadImage(file: File, apiKey: string, name: string, expiration?: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target && typeof event.target.result === 'string') {
                const fullDataUrl = event.target.result;
                const base64Image = fullDataUrl.split(',')[1];

                // If offline or no network connection, return local Data URL for instant 100% offline local display
                if (!navigator.onLine) {
                    console.warn('[Offline Mode] Network offline. Saving image locally as Data URL for instant display.');
                    resolve(fullDataUrl);
                    return;
                }

                const formData = new FormData();
                formData.append('image', base64Image);
                formData.append('name', name);

                let uploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}`;
                if (expiration && expiration > 0) {
                    uploadUrl += `&expiration=${expiration}`;
                }

                try {
                    const response = await fetch(uploadUrl, {
                        method: 'POST',
                        body: formData,
                    });

                    const result = await response.json();
                    if (result.success) {
                        resolve(result.data.url);
                    } else {
                        // Fall back to local Data URL if imgbb upload fails
                        console.warn('ImgBB upload error, falling back to local Data URL:', result.error?.message);
                        resolve(fullDataUrl);
                    }
                } catch (error) {
                    // Fall back to local Data URL on network error so image loads 100% offline
                    console.warn('ImgBB network request failed, returning local Data URL:', error);
                    resolve(fullDataUrl);
                }
            } else {
                 reject(new Error('Failed to read file.'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

export const sanitizeForUrl = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-');
};

export const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};
