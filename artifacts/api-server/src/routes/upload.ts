import { Router } from "express";
import { getStorageProvider } from "../lib/storage";
import { logger } from "../lib/logger";

const router = Router();

/**
 * File upload route handling binary uploads.
 * Expects the raw file data in the request body.
 * Metadata must be passed via headers:
 * - 'x-file-name': The name of the file to save
 * - 'content-type': The MIME type of the file (e.g. image/png, application/pdf)
 */
router.post("/attachments/upload", async (req, res) => {
  try {
    const fileName = (req.headers["x-file-name"] as string) || `upload_${Date.now()}`;
    const contentType = req.headers["content-type"] || "application/octet-stream";

    logger.info({ fileName, contentType }, "Received file upload request");

    // Buffer accumulation of the incoming body stream
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const fileData = Buffer.concat(chunks);

    if (fileData.length === 0) {
      logger.error("Upload failed: request body is empty");
      return res.status(400).json({ error: "Empty file data received in body" });
    }

    const storage = getStorageProvider();
    const fileUrl = await storage.uploadFile(fileName, fileData, contentType);

    return res.status(201).json({
      url: fileUrl,
      fileName,
      contentType,
      sizeBytes: fileData.length
    });
  } catch (err: any) {
    logger.error({ err }, "Error occurred during file upload");
    return res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

export default router;
