"""
LLM Response Cache Service
Caches LLM responses by prompt hash to reduce costs on incremental refreshes
"""

import hashlib
import json
from typing import Optional
from loguru import logger

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("[LLMCache] redis package not installed. Cache will be disabled.")


class LLMCacheService:
    """
    Cache LLM responses in Redis for cost optimization.
    Gracefully degrades if Redis is not available.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0", ttl: int = 604800):
        """
        Initialize cache service

        Args:
            redis_url: Redis connection URL
            ttl: Time-to-live for cache entries in seconds (default: 7 days)
        """
        self.ttl = ttl
        self.redis_client = None
        self.enabled = False

        if not REDIS_AVAILABLE:
            logger.info("[LLMCache] Redis not available, caching disabled")
            return

        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.enabled = True
            logger.info("[LLMCache] Cache enabled with Redis")
        except Exception as e:
            logger.warning(f"[LLMCache] Failed to connect to Redis: {e}. Caching disabled.")
            self.enabled = False

    def _generate_cache_key(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str
    ) -> str:
        """
        Generate a unique cache key based on all input parameters

        Args:
            prompt: User prompt
            system_prompt: System prompt
            temperature: Temperature setting
            max_tokens: Max tokens setting
            model: Model name

        Returns:
            SHA256 hash of all parameters
        """
        # Combine all parameters that affect output
        cache_input = {
            "prompt": prompt,
            "system_prompt": system_prompt or "",
            "temperature": temperature,
            "max_tokens": max_tokens,
            "model": model,
        }

        # Create deterministic hash
        cache_string = json.dumps(cache_input, sort_keys=True)
        cache_hash = hashlib.sha256(cache_string.encode()).hexdigest()

        return f"llm_cache:{cache_hash}"

    async def get(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str
    ) -> Optional[dict]:
        """
        Get cached LLM response

        Returns:
            Cached response dict or None if not found/cache disabled
        """
        if not self.enabled or not self.redis_client:
            return None

        try:
            cache_key = self._generate_cache_key(
                prompt, system_prompt, temperature, max_tokens, model
            )

            cached_value = await self.redis_client.get(cache_key)

            if cached_value:
                logger.debug(f"[LLMCache] Cache HIT: {cache_key[:16]}...")
                return json.loads(cached_value)

            logger.debug(f"[LLMCache] Cache MISS: {cache_key[:16]}...")
            return None

        except Exception as e:
            logger.warning(f"[LLMCache] Cache get failed: {e}")
            return None

    async def set(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        model: str,
        response: dict
    ) -> bool:
        """
        Cache LLM response

        Args:
            prompt: User prompt
            system_prompt: System prompt
            temperature: Temperature setting
            max_tokens: Max tokens setting
            model: Model name
            response: LLMResponse dict to cache

        Returns:
            True if cached successfully, False otherwise
        """
        if not self.enabled or not self.redis_client:
            return False

        try:
            cache_key = self._generate_cache_key(
                prompt, system_prompt, temperature, max_tokens, model
            )

            # Store with TTL
            await self.redis_client.setex(
                cache_key,
                self.ttl,
                json.dumps(response)
            )

            logger.debug(f"[LLMCache] Cached response: {cache_key[:16]}...")
            return True

        except Exception as e:
            logger.warning(f"[LLMCache] Cache set failed: {e}")
            return False

    async def clear_all(self) -> bool:
        """
        Clear all LLM cache entries

        Returns:
            True if successful, False otherwise
        """
        if not self.enabled or not self.redis_client:
            return False

        try:
            # Find all cache keys
            cursor = 0
            deleted_count = 0

            async for key in self.redis_client.scan_iter(match="llm_cache:*", count=100):
                await self.redis_client.delete(key)
                deleted_count += 1

            logger.info(f"[LLMCache] Cleared {deleted_count} cache entries")
            return True

        except Exception as e:
            logger.error(f"[LLMCache] Cache clear failed: {e}")
            return False

    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
