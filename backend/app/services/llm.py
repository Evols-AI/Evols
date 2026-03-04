"""
LLM Service
Handles interactions with various LLM providers (OpenAI, Anthropic, Bedrock)
"""

import os
from typing import List, Dict, Optional, Any
from app.core.config import settings


class LLMService:
    """Unified interface for different LLM providers"""

    def __init__(self):
        self.provider = self._detect_provider()

    def _detect_provider(self) -> str:
        """Auto-detect which LLM provider to use based on available API keys"""
        if settings.OPENAI_API_KEY:
            return "openai"
        elif settings.ANTHROPIC_API_KEY:
            return "anthropic"
        else:
            # Default to OpenAI, will fail gracefully if no key
            return "openai"

    async def generate_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1000,
        model: Optional[str] = None,
    ) -> str:
        """
        Generate completion from messages

        Args:
            messages: List of {role, content} dicts
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            model: Optional model override

        Returns:
            Generated text
        """
        if self.provider == "openai":
            return await self._openai_completion(messages, temperature, max_tokens, model)
        elif self.provider == "anthropic":
            return await self._anthropic_completion(messages, temperature, max_tokens, model)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    async def _openai_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        model: Optional[str] = None,
    ) -> str:
        """Generate completion using OpenAI"""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

            response = await client.chat.completions.create(
                model=model or settings.OPENAI_MODEL or "gpt-4-turbo-preview",
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            return response.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"OpenAI API error: {str(e)}")

    async def _anthropic_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        model: Optional[str] = None,
    ) -> str:
        """Generate completion using Anthropic Claude"""
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            # Convert OpenAI-style messages to Anthropic format
            system_message = None
            anthropic_messages = []

            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    anthropic_messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })

            response = await client.messages.create(
                model=model or "claude-3-sonnet-20240229",
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_message,
                messages=anthropic_messages,
            )

            return response.content[0].text
        except Exception as e:
            raise RuntimeError(f"Anthropic API error: {str(e)}")


# Global instance
llm_service = LLMService()
