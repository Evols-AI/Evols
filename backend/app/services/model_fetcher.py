"""
Dynamic Model Fetcher Service
Fetches available models from LLM providers with caching
"""

import logging
import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Cache for model lists (provider -> models, timestamp)
_model_cache: Dict[str, Dict] = {}
CACHE_TTL_HOURS = 24


class ModelFetcherService:
    """Service for fetching model lists from LLM providers"""

    @staticmethod
    async def fetch_openai_models(api_key: str) -> Dict[str, List[str]]:
        """
        Fetch available models from OpenAI API

        Args:
            api_key: OpenAI API key

        Returns:
            Dict with 'models' and 'embedding_models' lists
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                response.raise_for_status()

                data = response.json()
                all_models = [model["id"] for model in data.get("data", [])]

                # Filter GPT models (exclude deprecated ones)
                gpt_models = [
                    m for m in all_models
                    if m.startswith("gpt-") and not any(x in m for x in ["instruct", "0301", "0314"])
                ]
                # Sort by version (newer first)
                gpt_models.sort(reverse=True)

                # Filter embedding models
                embedding_models = [
                    m for m in all_models
                    if "embedding" in m
                ]
                embedding_models.sort(reverse=True)

                logger.info(f"Fetched {len(gpt_models)} GPT models and {len(embedding_models)} embedding models from OpenAI")

                return {
                    "models": gpt_models,
                    "embedding_models": embedding_models,
                }

        except httpx.HTTPStatusError as e:
            logger.error(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
            raise ValueError(f"Failed to fetch OpenAI models: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Failed to fetch OpenAI models: {e}")
            raise ValueError(f"Failed to fetch OpenAI models: {str(e)}")

    @staticmethod
    async def fetch_aws_bedrock_models(
        access_key_id: str,
        secret_access_key: str,
        region: str = "us-east-1"
    ) -> List[str]:
        """
        Fetch available foundation models from AWS Bedrock

        Args:
            access_key_id: AWS access key ID
            secret_access_key: AWS secret access key
            region: AWS region

        Returns:
            List of model IDs
        """
        try:
            import boto3
            from botocore.exceptions import ClientError, BotoCoreError

            # Create Bedrock client
            client = boto3.client(
                'bedrock',
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name=region
            )

            # List foundation models
            response = client.list_foundation_models()

            models = []
            for model in response.get('modelSummaries', []):
                model_id = model.get('modelId')
                if model_id:
                    models.append(model_id)

            models.sort()
            logger.info(f"Fetched {len(models)} models from AWS Bedrock in {region}")

            return models

        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            logger.error(f"AWS Bedrock API error: {error_code} - {str(e)}")
            raise ValueError(f"Failed to fetch Bedrock models: {error_code}")
        except BotoCoreError as e:
            logger.error(f"AWS Bedrock boto error: {e}")
            raise ValueError(f"Failed to fetch Bedrock models: {str(e)}")
        except ImportError:
            logger.error("boto3 not installed")
            raise ValueError("boto3 library not installed. Cannot fetch Bedrock models.")
        except Exception as e:
            logger.error(f"Failed to fetch AWS Bedrock models: {e}")
            raise ValueError(f"Failed to fetch Bedrock models: {str(e)}")

    @classmethod
    def get_cached_models(cls, provider: str) -> Optional[Dict]:
        """
        Get cached model list for a provider

        Args:
            provider: Provider name (openai, aws_bedrock)

        Returns:
            Cached model data or None if expired/missing
        """
        if provider not in _model_cache:
            return None

        cached = _model_cache[provider]
        cache_time = cached.get("timestamp")

        if not cache_time:
            return None

        # Check if cache is still valid
        age = datetime.utcnow() - cache_time
        if age > timedelta(hours=CACHE_TTL_HOURS):
            logger.info(f"Cache expired for {provider} (age: {age})")
            return None

        logger.info(f"Using cached models for {provider} (age: {age})")
        return cached.get("data")

    @classmethod
    def set_cached_models(cls, provider: str, data: Dict):
        """
        Cache model list for a provider

        Args:
            provider: Provider name
            data: Model data to cache
        """
        _model_cache[provider] = {
            "data": data,
            "timestamp": datetime.utcnow()
        }
        logger.info(f"Cached models for {provider}")

    @classmethod
    async def fetch_and_cache_openai(cls, api_key: str) -> Dict[str, List[str]]:
        """Fetch OpenAI models and cache the result"""
        models = await cls.fetch_openai_models(api_key)
        cls.set_cached_models("openai", models)
        return models

    @classmethod
    async def fetch_and_cache_bedrock(
        cls,
        access_key_id: str,
        secret_access_key: str,
        region: str = "us-east-1"
    ) -> List[str]:
        """Fetch AWS Bedrock models and cache the result"""
        models = await cls.fetch_aws_bedrock_models(
            access_key_id, secret_access_key, region
        )
        data = {"models": models}
        cls.set_cached_models("aws_bedrock", data)
        return models
