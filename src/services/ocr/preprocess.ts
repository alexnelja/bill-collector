import sharp from "sharp";
import { logger } from "../../utils/logger";

const MAX_DIMENSION = 1568;

interface PreprocessResult {
  base64: string;
  mimeType: string;
}

export async function preprocessImage(
  base64: string,
  mimeType: string
): Promise<PreprocessResult> {
  if (mimeType === "application/pdf") {
    return { base64, mimeType };
  }

  const buffer = Buffer.from(base64, "base64");
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    logger.debug(`Image ${width}x${height} within limits, no resize needed`);
    return { base64, mimeType };
  }

  logger.info(`Resizing image from ${width}x${height} to fit ${MAX_DIMENSION}px`);

  const resized = await sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    base64: resized.toString("base64"),
    mimeType: "image/jpeg",
  };
}
