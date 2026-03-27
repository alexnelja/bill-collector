import { preprocessImage } from "../../src/services/ocr/preprocess";
import sharp from "sharp";

describe("preprocessImage", () => {
  it("passes through PDFs unchanged", async () => {
    const pdfBase64 = Buffer.from("fake-pdf").toString("base64");
    const result = await preprocessImage(pdfBase64, "application/pdf");
    expect(result.base64).toBe(pdfBase64);
    expect(result.mimeType).toBe("application/pdf");
  });

  it("resizes a large image to max 1568px", async () => {
    const largeImg = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await preprocessImage(
      largeImg.toString("base64"),
      "image/jpeg"
    );
    const metadata = await sharp(
      Buffer.from(result.base64, "base64")
    ).metadata();

    expect(metadata.width).toBeLessThanOrEqual(1568);
    expect(metadata.height).toBeLessThanOrEqual(1568);
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("does not upscale small images", async () => {
    const smallImg = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await preprocessImage(
      smallImg.toString("base64"),
      "image/jpeg"
    );
    const metadata = await sharp(
      Buffer.from(result.base64, "base64")
    ).metadata();

    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);
  });
});
