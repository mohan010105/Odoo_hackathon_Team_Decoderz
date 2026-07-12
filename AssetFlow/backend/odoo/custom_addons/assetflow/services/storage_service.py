# -*- coding: utf-8 -*-
"""
Storage Service
===============
Abstraction layer for storing and retrieving user-uploaded attachments
supporting local filesystem and Supabase Storage buckets.
"""
import os
import logging
import requests

_logger = logging.getLogger(__name__)

class StorageService:
    """Configurable service for file upload and storage."""

    def __init__(self, env):
        self.env = env
        self.provider = os.environ.get("STORAGE_PROVIDER", "local")
        self.supabase_url = os.environ.get("SUPABASE_URL", "")
        self.supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
        self.bucket = os.environ.get("SUPABASE_BUCKET", "assetflow-attachments")
        
        # Local filestore settings
        self.local_path = os.environ.get("LOCAL_STORAGE_PATH")
        if not self.local_path:
            self.local_path = os.path.abspath(os.path.join(
                os.path.dirname(__file__), "../../../../filestore"
            ))

    def upload_file(self, file_name, file_data, content_type=None):
        """Upload a file to the configured storage provider.

        Args:
            file_name: The target file name
            file_data: The binary data (bytes) of the file
            content_type: Optional mime type

        Returns:
            The public URL or relative file path representing the uploaded file.
        """
        if self.provider == "supabase":
            if not self.supabase_url or not self.supabase_key:
                _logger.error("Supabase credentials missing for Storage provider.")
                raise ValueError("STORAGE_PROVIDER configured as 'supabase' but credentials missing")
            
            # Construct Supabase Storage REST URL
            sanitized_name = os.path.basename(file_name)
            url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/{self.bucket}/{sanitized_name}"
            
            headers = {
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": content_type or "application/octet-stream"
            }
            
            try:
                _logger.info("Uploading %s to Supabase Storage bucket %s", sanitized_name, self.bucket)
                res = requests.post(url, data=file_data, headers=headers, timeout=30)
                if res.status_code in (200, 201):
                    public_url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/public/{self.bucket}/{sanitized_name}"
                    _logger.info("Supabase upload success. URL: %s", public_url)
                    return public_url
                else:
                    _logger.error("Supabase Storage REST upload failed: %s - %s", res.status_code, res.text)
                    raise Exception(f"Supabase Storage upload failed: {res.text}")
            except Exception as e:
                _logger.exception("Exception during Supabase Storage upload: %s", e)
                raise
        else:
            try:
                os.makedirs(self.local_path, exist_ok=True)
                sanitized_name = os.path.basename(file_name)
                full_path = os.path.join(self.local_path, sanitized_name)
                
                _logger.info("Writing file %s to local path %s", sanitized_name, full_path)
                with open(full_path, "wb") as f:
                    f.write(file_data)
                
                return f"/static/uploads/{sanitized_name}"
            except Exception as e:
                _logger.exception("Exception during local storage write: %s", e)
                raise
