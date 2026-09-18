import Tesseract from "tesseract.js";

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function runOcr(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageFile, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(m.progress);
      }
    },
  });
  return {
    text: (data.text || "").trim(),
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
  };
}
