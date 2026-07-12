import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

export interface StorageProvider {
  uploadFile(fileName: string, fileData: Buffer, contentType?: string): Promise<string>;
}

export class LocalStorageProvider implements StorageProvider {
  private storagePath: string;

  constructor() {
    this.storagePath = process.env.LOCAL_STORAGE_PATH || "./filestore";
  }

  async uploadFile(fileName: string, fileData: Buffer): Promise<string> {
    const targetDir = path.resolve(this.storagePath);
    await fs.mkdir(targetDir, { recursive: true });
    const fullPath = path.join(targetDir, fileName);
    await fs.writeFile(fullPath, fileData);
    logger.info({ fileName, fullPath }, "File stored locally");
    return `/uploads/${fileName}`;
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  private bucket: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || "";
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
    this.bucket = process.env.SUPABASE_BUCKET || "assetflow-attachments";

    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set for Supabase storage");
    }
  }

  async uploadFile(fileName: string, fileData: Buffer, contentType?: string): Promise<string> {
    // Sanitize fileName
    const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9.\-_]/g, "_");
    
    // Construct REST URL: POST /storage/v1/object/{{bucket}}/{{fileName}}
    const url = `${this.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${this.bucket}/${sanitizedName}`;
    
    logger.info({ url, bucket: this.bucket, fileName: sanitizedName }, "Uploading file to Supabase Storage");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.supabaseKey}`,
        "Content-Type": contentType || "application/octet-stream"
      },
      body: fileData
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorText }, "Supabase Storage upload failed");
      throw new Error(`Supabase Storage upload failed: ${response.status} - ${errorText}`);
    }

    const publicUrl = `${this.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${this.bucket}/${sanitizedName}`;
    logger.info({ publicUrl }, "File uploaded successfully");
    return publicUrl;
  }
}

export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "supabase") {
    return new SupabaseStorageProvider();
  }
  return new LocalStorageProvider();
}
