/** Shared product image resolution for inventory, POS and reporting surfaces. */
type ImageSettings = {
  useGlobalStockImage?: boolean;
  globalStockImageUrl?: string;
};

function readImageCandidate(candidate: unknown): string | undefined {
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  if (Array.isArray(candidate)) {
    for (const entry of candidate) {
      const found = readImageCandidate(entry);
      if (found) return found;
    }
  }
  if (candidate && typeof candidate === 'object') {
    const value = candidate as Record<string, unknown>;
    return readImageCandidate(value.url) ||
      readImageCandidate(value.src) ||
      readImageCandidate(value.downloadURL) ||
      readImageCandidate(value.imageUrl);
  }
  return undefined;
}

/** Individual product image always wins; global default is only the fallback. */
export function getProductImageUrl(item: unknown, settings?: ImageSettings): string | undefined {
  if (item && typeof item === 'object') {
    const value = item as Record<string, unknown>;
    const candidates = [
      value.imageUrl, value.imageURL, value.image, value.photoURL, value.productImage,
      value.thumbnailUrl, value.thumbnail, value.imageUrls, value.images,
    ];
    for (const candidate of candidates) {
      const url = readImageCandidate(candidate);
      if (url) return url;
    }
  }
  return settings?.useGlobalStockImage && typeof settings.globalStockImageUrl === 'string'
    ? settings.globalStockImageUrl.trim() || undefined
    : undefined;
}
