"""
Embedding Service
Generate text embeddings for semantic search and clustering
Supports: OpenAI, sentence-transformers, AWS Bedrock
"""

import os
import json
import asyncio
from typing import List, Optional
import numpy as np
from loguru import logger
from functools import lru_cache

# Optional imports
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None

try:
    import boto3
except ImportError:
    boto3 = None


class EmbeddingService:
    """
    Service for generating text embeddings.
    Supports OpenAI, sentence-transformers, and AWS Bedrock (Amazon Titan / Cohere).
    """

    def __init__(
        self,
        provider: str = "aws_bedrock",
        model: str = "amazon.titan-embed-text-v2:0",
        api_key: Optional[str] = None,
        aws_region: Optional[str] = None,
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        aws_session_token: Optional[str] = None,
    ):
        self.provider = provider
        self.model = model
        self._st_model = None

        if provider == "openai":
            if AsyncOpenAI is None:
                raise ImportError("openai package required: pip install openai")
            self.api_key = api_key or os.getenv("OPENAI_API_KEY")
            self.openai_client = AsyncOpenAI(api_key=self.api_key)

        elif provider == "aws_bedrock":
            if boto3 is None:
                raise ImportError("boto3 package required: pip install boto3")

            session_kwargs = {
                "region_name": aws_region or os.getenv("AWS_REGION", "us-east-1")
            }
            if aws_access_key_id and aws_secret_access_key:
                session_kwargs["aws_access_key_id"] = aws_access_key_id
                session_kwargs["aws_secret_access_key"] = aws_secret_access_key
            if aws_session_token:
                session_kwargs["aws_session_token"] = aws_session_token

            session = boto3.Session(**session_kwargs)
            self.bedrock_client = session.client("bedrock-runtime")

        elif provider == "sentence_transformers":
            if SentenceTransformer is None:
                raise ImportError(
                    "sentence-transformers required: pip install sentence-transformers"
                )

    @property
    def sentence_transformer_model(self):
        """Lazy-load the sentence-transformers model."""
        if self._st_model is None:
            logger.info(f"Loading sentence-transformer model: {self.model}")
            self._st_model = SentenceTransformer(self.model)
        return self._st_model

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        results = await self.embed_batch([text])
        return results[0]

    async def embed_batch(self, texts: List[str], batch_size: int = 96) -> List[List[float]]:
        """Generate embeddings for multiple texts in batches."""
        if not texts:
            return []

        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]

            if self.provider == "openai":
                embeddings = await self._embed_openai(batch)
            elif self.provider == "aws_bedrock":
                embeddings = await self._embed_bedrock(batch)
            elif self.provider == "sentence_transformers":
                embeddings = await self._embed_sentence_transformers(batch)
            else:
                raise ValueError(f"Unknown embedding provider: {self.provider}")

            all_embeddings.extend(embeddings)
            logger.info(
                f"Embedded batch {i // batch_size + 1}/"
                f"{(len(texts) - 1) // batch_size + 1}"
            )

        return all_embeddings

    # ------------------------------------------------------------------ #
    # Provider implementations
    # ------------------------------------------------------------------ #

    async def _embed_openai(self, texts: List[str]) -> List[List[float]]:
        """Embed via OpenAI API (native async)."""
        try:
            # Native async - no thread blocking
            response = await self.openai_client.embeddings.create(
                input=texts,
                model=self.model,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"OpenAI embedding error: {e}")
            raise

    async def _embed_bedrock(self, texts: List[str]) -> List[List[float]]:
        """
        Embed via AWS Bedrock.

        Supported models:
          - amazon.titan-embed-text-v2:0   (default, 1024-dim)
          - amazon.titan-embed-text-v1     (1536-dim)
          - cohere.embed-english-v3        (1024-dim, batch-native)
          - cohere.embed-multilingual-v3   (1024-dim, batch-native)
        """
        embeddings: List[List[float]] = []

        # Cohere models support native batching
        if "cohere.embed" in self.model:
            embeddings = await asyncio.to_thread(
                self._cohere_batch_embed, texts
            )
        else:
            # Titan and others: one call per text
            tasks = [asyncio.to_thread(self._titan_embed_single, t) for t in texts]
            embeddings = await asyncio.gather(*tasks)

        return embeddings

    def _titan_embed_single(self, text: str) -> List[float]:
        """Single-text embedding with Amazon Titan."""
        body = json.dumps({"inputText": text})
        response = self.bedrock_client.invoke_model(
            modelId=self.model,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        resp_body = json.loads(response["body"].read())
        return resp_body["embedding"]

    def _cohere_batch_embed(self, texts: List[str]) -> List[List[float]]:
        """Batch embedding with Cohere on Bedrock."""
        body = json.dumps(
            {
                "texts": texts,
                "input_type": "search_document",  # or "search_query" for queries
                "truncate": "END",
            }
        )
        response = self.bedrock_client.invoke_model(
            modelId=self.model,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        resp_body = json.loads(response["body"].read())
        return resp_body["embeddings"]

    async def _embed_sentence_transformers(self, texts: List[str]) -> List[List[float]]:
        """Embed with local sentence-transformers model."""
        try:
            embeddings = await asyncio.to_thread(
                self.sentence_transformer_model.encode,
                texts,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Sentence-transformer embedding error: {e}")
            raise

    # ------------------------------------------------------------------ #
    # Utility
    # ------------------------------------------------------------------ #

    def get_embedding_dimension(self) -> int:
        """Return the vector dimension for the configured model."""
        dim_map = {
            "amazon.titan-embed-text-v2:0": 1024,
            "amazon.titan-embed-text-v1": 1536,
            "cohere.embed-english-v3": 1024,
            "cohere.embed-multilingual-v3": 1024,
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
            "text-embedding-ada-002": 1536,
        }
        # Exact match
        if self.model in dim_map:
            return dim_map[self.model]
        # Prefix match for sentence-transformers
        if self.provider == "sentence_transformers":
            return self.sentence_transformer_model.get_sentence_embedding_dimension()
        return 1024  # Safe default (Titan v2)


def cosine_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    """
    Calculate cosine similarity between two embeddings
    
    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector
        
    Returns:
        Similarity score between -1 and 1
    """
    vec1 = np.array(embedding1)
    vec2 = np.array(embedding2)
    
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(dot_product / (norm1 * norm2))


def find_most_similar(
    query_embedding: List[float],
    candidate_embeddings: List[List[float]],
    top_k: int = 5
) -> List[tuple[int, float]]:
    """
    Find most similar embeddings to query
    
    Args:
        query_embedding: Query embedding vector
        candidate_embeddings: List of candidate embedding vectors
        top_k: Number of top results to return
        
    Returns:
        List of (index, similarity_score) tuples, sorted by similarity descending
    """
    similarities = []
    
    for idx, candidate in enumerate(candidate_embeddings):
        sim = cosine_similarity(query_embedding, candidate)
        similarities.append((idx, sim))
    
    # Sort by similarity descending
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    return similarities[:top_k]


def get_embedding_service(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    aws_region: Optional[str] = None,
    aws_access_key_id: Optional[str] = None,
    aws_secret_access_key: Optional[str] = None,
    aws_session_token: Optional[str] = None,
    tenant_config: Optional[dict] = None,
) -> EmbeddingService:
    """
    Factory function that returns a configured EmbeddingService.
    Priority: explicit args > tenant_config > environment variables.

    AWS Bedrock is the default provider.
    """
    cfg = tenant_config or {}

    resolved_provider = provider or cfg.get("embedding_provider") or os.getenv(
        "EMBEDDING_PROVIDER", "aws_bedrock"
    )

    if resolved_provider == "aws_bedrock":
        resolved_model = (
            model
            or cfg.get("embedding_model")
            or os.getenv("EMBEDDING_MODEL", "amazon.titan-embed-text-v2:0")
        )
        return EmbeddingService(
            provider="aws_bedrock",
            model=resolved_model,
            aws_region=aws_region or cfg.get("aws_region") or os.getenv("AWS_REGION"),
            aws_access_key_id=(
                aws_access_key_id
                or cfg.get("aws_access_key_id")
                or os.getenv("AWS_ACCESS_KEY_ID")
            ),
            aws_secret_access_key=(
                aws_secret_access_key
                or cfg.get("aws_secret_access_key")
                or os.getenv("AWS_SECRET_ACCESS_KEY")
            ),
            aws_session_token=(
                aws_session_token
                or cfg.get("aws_session_token")
                or os.getenv("AWS_SESSION_TOKEN")
            ),
        )

    elif resolved_provider == "openai":
        resolved_model = (
            model
            or cfg.get("embedding_model")
            or os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        )
        return EmbeddingService(
            provider="openai",
            model=resolved_model,
            api_key=api_key or cfg.get("api_key") or os.getenv("OPENAI_API_KEY"),
        )

    else:  # sentence_transformers
        resolved_model = (
            model
            or cfg.get("embedding_model")
            or os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        )
        return EmbeddingService(provider="sentence_transformers", model=resolved_model)
