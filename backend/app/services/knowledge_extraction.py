"""
Knowledge Extraction Service
Extracts capabilities from documentation sources with multi-page crawling
"""

import logging
import httpx
import re
from typing import List, Dict, Any, Set
from urllib.parse import urljoin, urlparse
from sqlalchemy.ext.asyncio import AsyncSession
from bs4 import BeautifulSoup

from app.models.knowledge_base import KnowledgeSource, Capability
from app.services.llm_service import get_llm_service

logger = logging.getLogger(__name__)


class KnowledgeExtractionService:
    """Extract capabilities from knowledge sources with multi-page crawling"""

    # Crawling configuration
    MAX_PAGES_TO_CRAWL = 20  # Maximum pages to crawl per documentation site
    MAX_DEPTH = 3  # Maximum link depth from starting URL
    MAX_TEXT_LENGTH = 50000  # Maximum total text length before sending to LLM
    REQUEST_TIMEOUT = 30.0  # Timeout for HTTP requests

    def __init__(self, db: AsyncSession, tenant_config: Dict[str, Any] = None):
        self.db = db
        self.llm_service = get_llm_service(tenant_config=tenant_config)

    async def process_source(self, source: KnowledgeSource) -> int:
        """
        Process a knowledge source and extract capabilities
        Returns the number of capabilities extracted
        """
        try:
            # Update status to processing
            source.status = 'processing'
            await self.db.commit()

            if source.type == 'url':
                count = await self._process_url(source)
            elif source.type == 'github':
                count = await self._process_github(source)
            elif source.type == 'pdf':
                count = await self._process_pdf(source)
            elif source.type == 'mcp':
                count = await self._process_mcp(source)
            else:
                raise ValueError(f"Unsupported source type: {source.type}")

            # Update source with success
            source.status = 'completed'
            source.capabilities_extracted = count
            await self.db.commit()

            logger.info(f"Extracted {count} capabilities from source {source.id}")
            return count

        except Exception as e:
            logger.error(f"Error processing source {source.id}: {e}")
            source.status = 'failed'
            source.error_message = str(e)
            await self.db.commit()
            return 0

    async def _process_url(self, source: KnowledgeSource) -> int:
        """Process documentation URL with multi-page crawling"""
        try:
            logger.info(f"Starting multi-page crawl for {source.url}")

            # Crawl documentation site
            pages_content = await self._crawl_documentation_site(source.url)

            if not pages_content:
                raise ValueError("No content extracted from documentation site")

            logger.info(f"Crawled {len(pages_content)} pages, total {sum(len(p['text']) for p in pages_content)} characters")

            # Aggregate all text content
            all_text = ""
            for page in pages_content:
                section_header = f"\n\n=== {page['title']} ({page['url']}) ===\n\n"
                all_text += section_header + page['text']

            # Limit text size for LLM
            if len(all_text) > self.MAX_TEXT_LENGTH:
                all_text = all_text[:self.MAX_TEXT_LENGTH] + "\n\n[Content truncated due to length...]"

            # Use LLM to extract capabilities
            prompt = f"""Analyze this comprehensive product documentation from multiple pages and extract ALL product capabilities you can find.

IMPORTANT: Do not limit yourself to 10 or 20 capabilities. Extract EVERY capability, feature, API, service, component, database, and integration mentioned in the documentation. A typical product has 30-100+ capabilities.

For each capability, provide:
1. Name (concise, 2-5 words)
2. Description (1-2 sentences explaining what it does)
3. Category (choose from: api, feature, component, service, database, integration)

Documentation (from {len(pages_content)} pages):
{all_text}

Return a JSON array of ALL capabilities found. Example format:
[
  {{"name": "User Authentication", "description": "Allows users to sign up and log in securely with multiple providers.", "category": "feature"}},
  {{"name": "REST API", "description": "Provides RESTful endpoints for all core operations with OpenAPI documentation.", "category": "api"}},
  {{"name": "Real-time Messaging", "description": "WebSocket-based real-time communication between users.", "category": "feature"}}
]

Extract EVERY capability mentioned. Be comprehensive and thorough - aim for completeness, not brevity. Avoid duplicates only."""

            result = await self.llm_service.generate(prompt, max_tokens=8000)

            # Parse LLM response to extract capabilities
            capabilities_data = self._parse_capabilities_from_llm(result.content)

            if not capabilities_data:
                logger.warning("No capabilities extracted from LLM response")
            else:
                logger.info(f"LLM returned {len(capabilities_data)} capabilities from documentation")
                # Check if response might be truncated
                if result.finish_reason == 'length':
                    logger.warning(f"LLM response was truncated (finish_reason='length'). Consider processing in smaller chunks or the documentation may have 100+ capabilities.")

            # Create capability records with associated pages (with deduplication)
            count = 0
            for cap_data in capabilities_data:
                capability_name = cap_data.get('name', 'Unknown')

                # Check if capability with same name already exists for this tenant
                from sqlalchemy import select
                existing = await self.db.execute(
                    select(Capability).where(
                        Capability.tenant_id == source.tenant_id,
                        Capability.name == capability_name
                    )
                )
                if existing.scalar_one_or_none():
                    logger.info(f"Skipping duplicate capability: {capability_name}")
                    continue

                # Try to find the most relevant page for this capability
                relevant_url = self._find_relevant_page(capability_name, pages_content)

                capability = Capability(
                    tenant_id=source.tenant_id,
                    source_id=source.id,
                    name=capability_name,
                    description=cap_data.get('description', ''),
                    category=cap_data.get('category', 'feature'),
                    source_url=relevant_url or source.url,
                    source_section=cap_data.get('section')
                )
                self.db.add(capability)
                count += 1

            await self.db.commit()
            logger.info(f"Successfully extracted {count} capabilities from {source.url}")
            return count

        except Exception as e:
            logger.error(f"Error processing URL {source.url}: {e}")
            import traceback
            traceback.print_exc()
            # Create at least one generic capability
            capability = Capability(
                tenant_id=source.tenant_id,
                source_id=source.id,
                name=source.name,
                description=f"Documentation source: {source.description or source.url}",
                category='feature',
                source_url=source.url
            )
            self.db.add(capability)
            await self.db.commit()
            return 1

    async def _crawl_documentation_site(self, start_url: str) -> List[Dict[str, str]]:
        """
        Crawl documentation site starting from start_url
        Returns list of {url, title, text} dictionaries
        """
        visited: Set[str] = set()
        to_visit = [(start_url, 0)]  # (url, depth)
        pages_content = []

        # Parse base domain to stay within same site
        parsed_start = urlparse(start_url)
        base_domain = f"{parsed_start.scheme}://{parsed_start.netloc}"

        async with httpx.AsyncClient(
            timeout=self.REQUEST_TIMEOUT,
            follow_redirects=True,
            headers={'User-Agent': 'Evols-KnowledgeBot/1.0'}
        ) as client:

            while to_visit and len(pages_content) < self.MAX_PAGES_TO_CRAWL:
                current_url, depth = to_visit.pop(0)

                # Skip if already visited
                if current_url in visited:
                    continue

                # Skip if too deep
                if depth > self.MAX_DEPTH:
                    continue

                visited.add(current_url)

                try:
                    logger.info(f"Crawling page {len(visited)}/{self.MAX_PAGES_TO_CRAWL}: {current_url}")

                    # Fetch page
                    response = await client.get(current_url)
                    response.raise_for_status()
                    html_content = response.text

                    # Parse HTML
                    soup = BeautifulSoup(html_content, 'html.parser')

                    # Extract title
                    title = soup.title.string if soup.title else current_url

                    # Remove script, style, nav, footer elements
                    for element in soup(['script', 'style', 'nav', 'footer', 'header']):
                        element.decompose()

                    # Extract text
                    text = soup.get_text()
                    lines = (line.strip() for line in text.splitlines())
                    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                    text = ' '.join(chunk for chunk in chunks if chunk)

                    # Only include pages with meaningful content
                    if len(text) > 100:
                        pages_content.append({
                            'url': current_url,
                            'title': title,
                            'text': text
                        })

                    # Find links to other documentation pages (only if not too deep)
                    if depth < self.MAX_DEPTH:
                        links = soup.find_all('a', href=True)
                        for link in links:
                            href = link['href']

                            # Convert relative URLs to absolute
                            absolute_url = urljoin(current_url, href)

                            # Only follow links within the same domain
                            parsed_url = urlparse(absolute_url)
                            if parsed_url.netloc != parsed_start.netloc:
                                continue

                            # Remove fragment identifiers
                            clean_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
                            if parsed_url.query:
                                clean_url += f"?{parsed_url.query}"

                            # Skip non-documentation URLs (images, downloads, etc.)
                            if any(ext in clean_url.lower() for ext in ['.pdf', '.zip', '.png', '.jpg', '.jpeg', '.gif', '.svg']):
                                continue

                            # Add to queue if not visited
                            if clean_url not in visited:
                                to_visit.append((clean_url, depth + 1))

                except Exception as e:
                    logger.warning(f"Error crawling {current_url}: {e}")
                    continue

        logger.info(f"Completed crawl: visited {len(visited)} pages, extracted content from {len(pages_content)} pages")
        return pages_content

    def _find_relevant_page(self, capability_name: str, pages_content: List[Dict[str, str]]) -> str:
        """Find the most relevant page URL for a capability based on keyword matching"""
        if not pages_content:
            return None

        capability_keywords = capability_name.lower().split()

        best_match = pages_content[0]['url']
        best_score = 0

        for page in pages_content:
            # Count keyword matches in title and text
            title_lower = page['title'].lower()
            text_lower = page['text'][:500].lower()  # Check first 500 chars

            score = sum(1 for kw in capability_keywords if kw in title_lower) * 3  # Title matches worth more
            score += sum(1 for kw in capability_keywords if kw in text_lower)

            if score > best_score:
                best_score = score
                best_match = page['url']

        return best_match

    async def _process_github(self, source: KnowledgeSource) -> int:
        """Process GitHub repository with API crawling"""
        try:
            logger.info(f"Starting GitHub repository analysis for {source.github_repo}")

            # Fetch repository content from GitHub API
            repo_content = await self._fetch_github_repository(source.github_repo)

            if not repo_content:
                raise ValueError("No content extracted from GitHub repository")

            logger.info(f"Fetched {len(repo_content)} files from GitHub, total {sum(len(f['content']) for f in repo_content)} characters")

            # Aggregate all content
            all_text = f"GitHub Repository: {source.github_repo}\n\n"

            for file_info in repo_content:
                section_header = f"\n\n=== {file_info['path']} ===\n\n"
                all_text += section_header + file_info['content']

            # Limit text size for LLM
            if len(all_text) > self.MAX_TEXT_LENGTH:
                all_text = all_text[:self.MAX_TEXT_LENGTH] + "\n\n[Content truncated due to length...]"

            # Use LLM to extract capabilities
            prompt = f"""Analyze this GitHub repository documentation and code structure to extract ALL product capabilities.

IMPORTANT: Do not limit yourself to 10 or 20 capabilities. Extract EVERY capability, feature, API, service, component, database, and integration mentioned in the repository. A typical product has 30-100+ capabilities.

For each capability, provide:
1. Name (concise, 2-5 words)
2. Description (1-2 sentences explaining what it does)
3. Category (choose from: api, feature, component, service, database, integration)

Repository Content:
{all_text}

Return a JSON array of ALL capabilities found. Example format:
[
  {{"name": "REST API", "description": "Provides RESTful endpoints for core operations.", "category": "api"}},
  {{"name": "Authentication System", "description": "OAuth2-based authentication with JWT tokens.", "category": "feature"}},
  {{"name": "Database Integration", "description": "PostgreSQL database with migration support.", "category": "database"}}
]

Extract EVERY capability mentioned in README, API endpoints, major components, and integrations. Be comprehensive and thorough - aim for completeness. Avoid duplicates only."""

            result = await self.llm_service.generate(prompt, max_tokens=8000)

            # Parse LLM response to extract capabilities
            capabilities_data = self._parse_capabilities_from_llm(result.content)

            if not capabilities_data:
                logger.warning("No capabilities extracted from LLM response")
            else:
                logger.info(f"LLM returned {len(capabilities_data)} capabilities from GitHub repository")
                # Check if response might be truncated
                if result.finish_reason == 'length':
                    logger.warning(f"LLM response was truncated (finish_reason='length'). The repository may have 100+ capabilities.")

            # Create capability records (with deduplication)
            count = 0
            github_url = f"https://github.com/{source.github_repo}"

            for cap_data in capabilities_data:
                capability_name = cap_data.get('name', 'Unknown')

                # Check if capability with same name already exists for this tenant
                from sqlalchemy import select
                existing = await self.db.execute(
                    select(Capability).where(
                        Capability.tenant_id == source.tenant_id,
                        Capability.name == capability_name
                    )
                )
                if existing.scalar_one_or_none():
                    logger.info(f"Skipping duplicate capability: {capability_name}")
                    continue

                capability = Capability(
                    tenant_id=source.tenant_id,
                    source_id=source.id,
                    name=capability_name,
                    description=cap_data.get('description', ''),
                    category=cap_data.get('category', 'feature'),
                    source_url=github_url,
                    source_section=cap_data.get('section')
                )
                self.db.add(capability)
                count += 1

            await self.db.commit()
            logger.info(f"Successfully extracted {count} capabilities from {source.github_repo}")
            return count

        except Exception as e:
            logger.error(f"Error processing GitHub repo {source.github_repo}: {e}")
            import traceback
            traceback.print_exc()
            # Create at least one generic capability
            capability = Capability(
                tenant_id=source.tenant_id,
                source_id=source.id,
                name=f"{source.github_repo} Repository",
                description=f"GitHub repository: {source.github_repo}",
                category='service',
                source_url=f"https://github.com/{source.github_repo}"
            )
            self.db.add(capability)
            await self.db.commit()
            return 1

    async def _fetch_github_repository(self, repo: str) -> List[Dict[str, str]]:
        """
        Fetch documentation and key files from GitHub repository
        Returns list of {path, content} dictionaries
        """
        files_content = []

        # Paths to look for in the repository
        important_paths = [
            'README.md',
            'README',
            'DOCS.md',
            'docs/README.md',
            'documentation/README.md',
            'API.md',
            'ARCHITECTURE.md',
            'FEATURES.md',
            'CONTRIBUTING.md'
        ]

        # Also look for files in docs/ directory
        docs_patterns = ['docs/', 'documentation/', '.github/']

        async with httpx.AsyncClient(
            timeout=self.REQUEST_TIMEOUT,
            follow_redirects=True,
            headers={
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Evols-KnowledgeBot/1.0'
            }
        ) as client:

            # First, try to get README
            for path in important_paths:
                try:
                    # GitHub API endpoint for file content
                    url = f"https://api.github.com/repos/{repo}/contents/{path}"
                    response = await client.get(url)

                    if response.status_code == 200:
                        data = response.json()

                        # Decode base64 content
                        import base64
                        content = base64.b64decode(data['content']).decode('utf-8')

                        files_content.append({
                            'path': path,
                            'content': content
                        })

                        logger.info(f"Fetched {path} from {repo}")

                except Exception as e:
                    logger.debug(f"Could not fetch {path}: {e}")
                    continue

            # Try to get repository info for description
            try:
                url = f"https://api.github.com/repos/{repo}"
                response = await client.get(url)

                if response.status_code == 200:
                    repo_data = response.json()

                    # Add repository metadata as context
                    metadata = f"""Repository Metadata:
- Name: {repo_data.get('name', '')}
- Description: {repo_data.get('description', '')}
- Topics: {', '.join(repo_data.get('topics', []))}
- Language: {repo_data.get('language', '')}
- Stars: {repo_data.get('stargazers_count', 0)}
"""

                    files_content.insert(0, {
                        'path': 'REPOSITORY_INFO',
                        'content': metadata
                    })

            except Exception as e:
                logger.debug(f"Could not fetch repo metadata: {e}")

            # Try to get contents of docs directory
            try:
                url = f"https://api.github.com/repos/{repo}/contents/docs"
                response = await client.get(url)

                if response.status_code == 200:
                    docs_files = response.json()

                    # Limit to first 5 markdown files in docs
                    markdown_files = [f for f in docs_files if f['name'].endswith('.md')][:5]

                    for file_info in markdown_files:
                        try:
                            file_response = await client.get(file_info['download_url'])
                            if file_response.status_code == 200:
                                content = file_response.text

                                files_content.append({
                                    'path': f"docs/{file_info['name']}",
                                    'content': content
                                })

                                logger.info(f"Fetched docs/{file_info['name']} from {repo}")

                        except Exception as e:
                            logger.debug(f"Could not fetch {file_info['name']}: {e}")
                            continue

            except Exception as e:
                logger.debug(f"Could not fetch docs directory: {e}")

        logger.info(f"Fetched {len(files_content)} files from {repo}")
        return files_content

    async def _process_pdf(self, source: KnowledgeSource) -> int:
        """Process PDF document - placeholder"""
        # TODO: Implement PDF text extraction
        capability = Capability(
            tenant_id=source.tenant_id,
            source_id=source.id,
            name=source.name,
            description=f"PDF documentation: {source.description or source.name}",
            category='feature',
            source_url=source.file_path
        )
        self.db.add(capability)
        await self.db.commit()
        return 1

    async def _process_mcp(self, source: KnowledgeSource) -> int:
        """Process MCP server connection - placeholder"""
        # TODO: Implement MCP server integration
        capability = Capability(
            tenant_id=source.tenant_id,
            source_id=source.id,
            name=f"{source.name} MCP Server",
            description=f"MCP Server: {source.mcp_endpoint}",
            category='integration',
            source_url=source.mcp_endpoint
        )
        self.db.add(capability)
        await self.db.commit()
        return 1

    def _parse_capabilities_from_llm(self, llm_response: str) -> List[Dict[str, Any]]:
        """Parse capabilities from LLM JSON response"""
        import json
        import re

        try:
            # Try to find JSON in the response
            # Look for JSON array
            json_match = re.search(r'\[.*\]', llm_response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                capabilities = json.loads(json_str)
                # Return all capabilities extracted by the LLM (no arbitrary limit)
                logger.info(f"Successfully parsed {len(capabilities)} capabilities from LLM response")
                return capabilities

            # If no JSON found, return empty list
            logger.warning("No JSON array found in LLM response")
            logger.debug(f"LLM response preview: {llm_response[:500]}")
            return []

        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            logger.debug(f"LLM response preview: {llm_response[:500]}")
            return []
