import os
import aiofiles
from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime
from app.core.config import get_settings

settings = get_settings()


class StorageProvider(ABC):
    @abstractmethod
    async def save(self, data: bytes, key: str) -> str:
        pass
    
    @abstractmethod
    async def get(self, key: str) -> Optional[bytes]:
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> bool:
        pass
    
    @abstractmethod
    async def exists(self, key: str) -> bool:
        pass
    
    @abstractmethod
    def get_url(self, key: str) -> str:
        pass


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)
    
    def _get_full_path(self, key: str) -> str:
        return os.path.join(self.base_path, key)
    
    async def save(self, data: bytes, key: str) -> str:
        full_path = self._get_full_path(key)
        dir_path = os.path.dirname(full_path)
        os.makedirs(dir_path, exist_ok=True)
        
        async with aiofiles.open(full_path, 'wb') as f:
            await f.write(data)
        
        return key
    
    async def get(self, key: str) -> Optional[bytes]:
        full_path = self._get_full_path(key)
        if not os.path.exists(full_path):
            return None
        
        async with aiofiles.open(full_path, 'rb') as f:
            return await f.read()
    
    async def delete(self, key: str) -> bool:
        full_path = self._get_full_path(key)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
        return False
    
    async def exists(self, key: str) -> bool:
        full_path = self._get_full_path(key)
        return os.path.exists(full_path)
    
    def get_url(self, key: str) -> str:
        return f"/api/storage/{key}"


class S3StorageProvider(StorageProvider):
    """
    AWS S3 Storage Provider - Ready for future implementation.
    Currently serves as a placeholder that uses local storage.
    """
    
    def __init__(self, bucket: str, region: str = "us-east-1"):
        self.bucket = bucket
        self.region = region
        # In production, initialize boto3 client here
        # self.client = boto3.client('s3', region_name=region)
        
        # For now, fall back to local storage
        self._local = LocalStorageProvider(settings.local_storage_path)
    
    async def save(self, data: bytes, key: str) -> str:
        # Production: Upload to S3
        # await self.client.put_object(Bucket=self.bucket, Key=key, Body=data)
        return await self._local.save(data, key)
    
    async def get(self, key: str) -> Optional[bytes]:
        # Production: Download from S3
        # response = await self.client.get_object(Bucket=self.bucket, Key=key)
        # return response['Body'].read()
        return await self._local.get(key)
    
    async def delete(self, key: str) -> bool:
        # Production: Delete from S3
        # await self.client.delete_object(Bucket=self.bucket, Key=key)
        return await self._local.delete(key)
    
    async def exists(self, key: str) -> bool:
        # Production: Check if exists in S3
        return await self._local.exists(key)
    
    def get_url(self, key: str) -> str:
        # Production: Generate presigned URL
        # return self.client.generate_presigned_url('get_object', ...)
        return f"/api/storage/{key}"


def get_storage_provider() -> StorageProvider:
    if settings.storage_provider == "s3":
        # In production, get bucket from settings
        return S3StorageProvider(bucket="care-platform-bucket")
    return LocalStorageProvider(settings.local_storage_path)


def generate_storage_key(
    resource_type: str,
    resource_id: str,
    filename: str,
    extension: str
) -> str:
    """Generate an S3-compatible object key."""
    date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
    return f"{resource_type}/{date_prefix}/{resource_id}/{filename}.{extension}"
