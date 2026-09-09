import fs from "fs";
import path from "path";
import zlib from "zlib";

/**
 * Extracts embedded image from the example PDFs in `exemple/` folder
 * or provides the canonical signature path.
 */
export function getOrCreateSignatureFile(): string {
  const publicDir = path.join(process.cwd(), "public", "signatures");
  const svgPath = path.join(publicDir, "renata-signature.svg");
  const pngPath = path.join(publicDir, "renata-signature.png");

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // If PNG already exists and has content, return it
  if (fs.existsSync(pngPath) && fs.statSync(pngPath).size > 100) {
    return "/signatures/renata-signature.png";
  }

  // Try extracting from PDF in exemple/
  const exempleDir = path.join(process.cwd(), "exemple");
  if (fs.existsSync(exempleDir)) {
    const pdfFiles = [
      "Invoice - Holland Law.pdf",
      "Invoice - Holland Law (1).pdf",
      "invoice - Holland Law Office - 09-2026.pdf",
    ];

    for (const filename of pdfFiles) {
      const fullPath = path.join(exempleDir, filename);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const buffer = fs.readFileSync(fullPath);
        // Search for JPEG / DCTDecode
        const dctIndex = buffer.indexOf("/DCTDecode");
        if (dctIndex !== -1) {
          const streamStart = buffer.indexOf("stream", dctIndex);
          if (streamStart !== -1) {
            // Find start of JPEG SOI (FF D8)
            const soi = buffer.indexOf(Buffer.from([0xff, 0xd8]), streamStart);
            if (soi !== -1 && soi - streamStart < 200) {
              // Find EOI (FF D9)
              const eoi = buffer.indexOf(Buffer.from([0xff, 0xd9]), soi);
              if (eoi !== -1) {
                const imgData = buffer.subarray(soi, eoi + 2);
                fs.writeFileSync(pngPath, imgData);
                return "/signatures/renata-signature.png";
              }
            }
          }
        }

        // Search for FlateDecode Image
        const imageMarker = "/Subtype /Image";
        let offset = 0;
        while ((offset = buffer.indexOf(imageMarker, offset)) !== -1) {
          const streamStart = buffer.indexOf("stream", offset);
          const streamEnd = buffer.indexOf("endstream", streamStart);
          if (streamStart !== -1 && streamEnd !== -1) {
            let start = streamStart + 6;
            if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2;
            else if (buffer[start] === 0x0a) start += 1;

            const compressed = buffer.subarray(start, streamEnd);
            try {
              const decompressed = zlib.inflateSync(compressed);
              if (decompressed.length > 500) {
                // We have decompressed pixel stream or embedded data
                // If it starts with PNG or JPEG headers
                if (
                  decompressed[0] === 0x89 &&
                  decompressed[1] === 0x50 &&
                  decompressed[2] === 0x4e &&
                  decompressed[3] === 0x47
                ) {
                  fs.writeFileSync(pngPath, decompressed);
                  return "/signatures/renata-signature.png";
                }
              }
            } catch {
              // Not a standard zlib stream, continue searching
            }
          }
          offset += imageMarker.length;
        }
      } catch (err) {
        console.error("Erro ao analisar PDF para assinatura:", err);
      }
    }
  }

  // Fallback to SVG if PNG extraction is not available
  if (fs.existsSync(svgPath)) {
    return "/signatures/renata-signature.svg";
  }

  return "/signatures/renata-signature.svg";
}
