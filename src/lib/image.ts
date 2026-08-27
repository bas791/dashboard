/**
 * Browser-side photo preparation for the mark-up tool.
 *
 * Phone and drone photos are 8–20 MP, which is far more than the vision model
 * uses (it works on roughly a 1568px long edge) and far more than we want to
 * push through an API request. Downscaling here keeps uploads fast and the
 * page responsive when a dozen photos are open at once.
 */

/** Long edge, in pixels, of the image sent for analysis and drawn on screen. */
const MAX_EDGE = 1568;

/** JPEG quality — high enough that light lichen speckling survives. */
const JPEG_QUALITY = 0.85;

export interface PreparedPhoto {
  dataUrl: string;
  width: number;
  height: number;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Decode with `imageOrientation: "from-image"` so photos taken in portrait on
 * a phone are not marked up sideways — the EXIF rotation is baked in here, and
 * every box we store afterwards refers to the upright image.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the <img> path below (older Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read that image file."));
      img.src = url;
    });
  } finally {
    // Revoking immediately is safe: the bitmap is already decoded by now.
    URL.revokeObjectURL(url);
  }
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const source = await decode(file);
  const naturalWidth =
    "naturalWidth" in source ? source.naturalWidth : source.width;
  const naturalHeight =
    "naturalHeight" in source ? source.naturalHeight : source.height;

  if (!naturalWidth || !naturalHeight) {
    throw new Error("Could not read that image file.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(naturalWidth, naturalHeight));
  const width = Math.round(naturalWidth * scale);
  const height = Math.round(naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process images.");

  // Better downsampling of fine detail (lichen speckle, sheet laps).
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);

  if ("close" in source) source.close();

  return {
    dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    width,
    height,
  };
}
