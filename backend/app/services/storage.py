import os
import aiofiles
import aioboto3
from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime, timedelta
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
    """Local filesystem storage for development"""
    
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
    """AWS S3 Storage Provider - Production Ready
    
    Handles video, transcript, and file storage in S3.
    Configure AWS credentials in .env:
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY  
    - AWS_REGION
    - S3_BUCKET_NAME
    """
    
    def __init__(
        self,
        bucket: str,
        region: str = "us-east-1",
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None
    ):
        self.bucket = bucket
        self.region = region
        self.access_key = access_key
        self.secret_key = secret_key
        
        # Create aioboto3 session
        self.session = aioboto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
    
    async def save(self, data: bytes, key: str) -> str:
        """Upload file to S3"""
        async with self.session.client('s3') as s3:
            try:
                await s3.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=data,
                    ServerSideEncryption='AES256',  # Encrypt at rest
                    ContentType=self._get_content_type(key)
                )
                return key
            except Exception as e:
                print(f"S3 upload error: {e}")
                raise
    
    async def get(self, key: str) -> Optional[bytes]:
        """Download file from S3"""
        async with self.session.client('s3') as s3:
            try:
                response = await s3.get_object(Bucket=self.bucket, Key=key)
                async with response['Body'] as stream:
                    return await stream.read()
            except s3.exceptions.NoSuchKey:
                return None
            except Exception as e:
                print(f"S3 download error: {e}")
                return None
    
    async def delete(self, key: str) -> bool:
        """Delete file from S3"""
        async with self.session.client('s3') as s3:
            try:
                await s3.delete_object(Bucket=self.bucket, Key=key)
                return True
            except Exception as e:
                print(f"S3 delete error: {e}")
                return False
    
    async def exists(self, key: str) -> bool:
        """Check if file exists in S3"""
        async with self.session.client('s3') as s3:
            try:
                await s3.head_object(Bucket=self.bucket, Key=key)
                return True
            except s3.exceptions.ClientError:
                return False
            except Exception:
                return False
    
    def get_url(self, key: str, expiration: int = 3600) -> str:
        """Generate presigned URL for secure file access
        
        Args:
            key: S3 object key
            expiration: URL expiration time in seconds (default 1 hour)
        
        Returns:
            Presigned URL for downloading the file
        """
        import boto3  # Use sync boto3 for presigned URL (it's a sync operation)
        
        client = boto3.client(
            's3',
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region
        )
        
        try:
            url = client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': key},
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
            print(f"Error generating presigned URL: {e}")
            return f"/api/storage/{key}"  # Fallback to API endpoint
    
    def _get_content_type(self, key: str) -> str:
        """Determine content type based on file extension"""
        ext = key.split('.')[-1].lower()
        content_types = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'avi': 'video/avi',
            'mov': 'video/quicktime',
            'txt': 'text/plain',
            'json': 'application/json',
            'pdf': 'application/pdf',
        }
        return content_types.get(ext, 'application/octet-stream')


def get_storage_provider() -> StorageProvider:
    """Get configured storage provider (S3 or Local)
    
    If AWS credentials are configured in .env, uses S3.
    Otherwise falls back to local storage.
    """
    if settings.storage_provider == "s3":
        # Use S3 in production
        if not all([
            settings.aws_access_key_id,
            settings.aws_secret_access_key,
            settings.s3_bucket_name
        ]):
            print("WARNING: S3 provider selected but AWS credentials not found")
            print("Falling back to local storage")
            print("Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME in .env")
            return LocalStorageProvider(settings.local_storage_path)
        
        return S3StorageProvider(
            bucket=settings.s3_bucket_name,
            region=settings.aws_region,
            access_key=settings.aws_access_key_id,
            secret_key=settings.aws_secret_access_key
        )
    
    # Use local storage for development
    return LocalStorageProvider(settings.local_storage_path)


def generate_storage_key(
    resource_type: str,
    resource_id: str,
    filename: str,
    extension: str
) -> str:
    """Generate an S3-compatible object key with proper organization
    
    Format: {resource_type}/{YYYY}/{MM}/{DD}/{resource_id}/{filename}.{extension}
    Example: recordings/2026/01/20/appointment-123/interview.mp4
    """
    date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
    return f"{resource_type}/{date_prefix}/{resource_id}/{filename}.{extension}"
