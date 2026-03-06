"""
Web Scraping Service
Fetches real market data from various sources for Founder Mode
"""

import asyncio
import httpx
from typing import List, Dict, Any, Optional
from loguru import logger
from datetime import datetime, timedelta


class WebScraperService:
    """
    Scrapes market data from multiple sources:
    - Reddit API (discussions, pain points, feature requests)
    - G2/Capterra (competitor reviews)
    - Product Hunt (launches, reception)
    - Google (market reports, trends)
    """

    def __init__(self):
        self.timeout = httpx.Timeout(30.0)

    # ── Reddit API ─────────────────────────────────────────────────────────

    async def search_reddit(
        self,
        query: str,
        subreddits: Optional[List[str]] = None,
        limit: int = 50,
        time_filter: str = "year"  # hour, day, week, month, year, all
    ) -> List[Dict[str, Any]]:
        """
        Search Reddit for discussions using Reddit JSON API (no auth required for read-only)

        Args:
            query: Search query (product name, problem space, etc.)
            subreddits: List of subreddits to search (e.g., ['SaaS', 'startups', 'Entrepreneur'])
            limit: Max posts to fetch (default 50)
            time_filter: Time range filter

        Returns:
            List of posts with title, content, score, comments, url
        """
        try:
            results = []

            # Default subreddits for startup/product validation
            if not subreddits:
                subreddits = [
                    'SaaS', 'startups', 'Entrepreneur', 'smallbusiness',
                    'ProductManagement', 'sales', 'marketing'
                ]

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for subreddit in subreddits:
                    try:
                        # Search within subreddit
                        url = f"https://www.reddit.com/r/{subreddit}/search.json"
                        params = {
                            'q': query,
                            'limit': limit,
                            't': time_filter,
                            'restrict_sr': 'on',  # Restrict to this subreddit
                            'sort': 'relevance'
                        }

                        response = await client.get(
                            url,
                            params=params,
                            headers={'User-Agent': 'Evols Market Research Bot 1.0'}
                        )

                        if response.status_code == 200:
                            data = response.json()
                            posts = data.get('data', {}).get('children', [])

                            for post in posts:
                                post_data = post.get('data', {})
                                results.append({
                                    'source': 'reddit',
                                    'subreddit': post_data.get('subreddit'),
                                    'title': post_data.get('title', ''),
                                    'content': post_data.get('selftext', ''),
                                    'score': post_data.get('score', 0),
                                    'num_comments': post_data.get('num_comments', 0),
                                    'url': f"https://reddit.com{post_data.get('permalink', '')}",
                                    'created_utc': post_data.get('created_utc'),
                                    'author': post_data.get('author', '[deleted]'),
                                })

                        # Respect Reddit rate limits
                        await asyncio.sleep(1)

                    except Exception as e:
                        logger.warning(f"Failed to search r/{subreddit}: {e}")
                        continue

            logger.info(f"Fetched {len(results)} Reddit posts for query: {query}")
            return results

        except Exception as e:
            logger.error(f"Reddit search failed: {e}")
            return []

    async def get_reddit_hot_discussions(
        self,
        subreddits: List[str],
        limit: int = 25
    ) -> List[Dict[str, Any]]:
        """
        Get hot/trending discussions from specific subreddits
        """
        try:
            results = []

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for subreddit in subreddits:
                    try:
                        url = f"https://www.reddit.com/r/{subreddit}/hot.json"
                        response = await client.get(
                            url,
                            params={'limit': limit},
                            headers={'User-Agent': 'Evols Market Research Bot 1.0'}
                        )

                        if response.status_code == 200:
                            data = response.json()
                            posts = data.get('data', {}).get('children', [])

                            for post in posts:
                                post_data = post.get('data', {})
                                results.append({
                                    'source': 'reddit',
                                    'subreddit': post_data.get('subreddit'),
                                    'title': post_data.get('title', ''),
                                    'content': post_data.get('selftext', ''),
                                    'score': post_data.get('score', 0),
                                    'num_comments': post_data.get('num_comments', 0),
                                    'url': f"https://reddit.com{post_data.get('permalink', '')}",
                                })

                        await asyncio.sleep(1)

                    except Exception as e:
                        logger.warning(f"Failed to fetch hot from r/{subreddit}: {e}")
                        continue

            return results

        except Exception as e:
            logger.error(f"Reddit hot fetch failed: {e}")
            return []

    # ── G2 / Capterra Reviews ─────────────────────────────────────────────

    async def scrape_g2_reviews(
        self,
        product_name: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Scrape G2 reviews for competitors (requires web scraping or API key)
        Note: G2 doesn't have a public API, so this uses web scraping

        For MVP: Returns simulated structure. Production should use:
        - Scrapy/BeautifulSoup for actual scraping
        - Or G2 API if available
        """
        logger.warning("G2 scraping not fully implemented - using placeholder")

        # Placeholder structure - in production, implement actual scraping
        return [
            {
                'source': 'g2',
                'product_name': product_name,
                'rating': 0.0,
                'review_title': 'Placeholder - G2 scraping not implemented',
                'review_text': 'Implement G2 scraping with BeautifulSoup or official API',
                'reviewer_role': 'Unknown',
                'company_size': 'Unknown',
                'pros': [],
                'cons': [],
                'date': datetime.now().isoformat(),
            }
        ]

    async def scrape_capterra_reviews(
        self,
        product_name: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Scrape Capterra reviews (similar to G2)
        """
        logger.warning("Capterra scraping not fully implemented - using placeholder")
        return []

    # ── Product Hunt ──────────────────────────────────────────────────────

    async def search_product_hunt(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search Product Hunt for similar products
        Uses Product Hunt GraphQL API (requires API token)

        For MVP: Returns placeholder. Production requires:
        - Product Hunt API token
        - GraphQL queries
        """
        logger.warning("Product Hunt API not fully implemented - using placeholder")

        return [
            {
                'source': 'product_hunt',
                'name': 'Placeholder',
                'tagline': 'Product Hunt API integration pending',
                'votes': 0,
                'comments_count': 0,
                'url': 'https://www.producthunt.com',
            }
        ]

    # ── Google Search / Market Reports ────────────────────────────────────

    async def search_market_reports(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for market reports and analyst insights
        Could use:
        - Google Custom Search API
        - Bing Search API
        - SerpAPI

        For MVP: Using placeholder
        """
        logger.warning("Market report search not fully implemented")
        return []

    # ── Aggregate Market Data ─────────────────────────────────────────────

    async def fetch_market_data(
        self,
        product_name: str,
        product_description: str,
        competitors: List[str],
        is_beyond_idea_phase: bool
    ) -> Dict[str, Any]:
        """
        Main entry point: Fetch market data from all sources
        Product name is optional - can pull market data using just description for pre-launch products.
        """
        product_identifier = product_name or product_description or "product"
        logger.info(f"Fetching market data for: {product_identifier}")

        # Build search queries
        # For pre-launch products without names, use description-based queries
        base_query = f"{product_name} {product_description}".strip()
        if not base_query:
            base_query = "startup product feedback"  # Fallback if both are empty
        problem_query = f"{product_description} problems challenges pain points" if product_description else "startup challenges pain points"

        # Fetch from multiple sources in parallel
        reddit_results, reddit_hot = await asyncio.gather(
            self.search_reddit(base_query, limit=30),
            self.search_reddit(problem_query, limit=20),
        )

        # Combine and structure results
        market_data = {
            'product_feedback': self._extract_feedback(reddit_results + reddit_hot),
            'competitor_insights': self._extract_competitor_insights(reddit_results, competitors),
            'market_trends': self._extract_trends(reddit_results + reddit_hot),
            'customer_pain_points': self._extract_pain_points(reddit_results + reddit_hot),
            'opportunities': self._extract_opportunities(reddit_results + reddit_hot),
            'metadata': {
                'sources_queried': ['reddit'],
                'total_data_points': len(reddit_results) + len(reddit_hot),
                'timestamp': datetime.now().isoformat(),
                'query': base_query,
            }
        }

        return market_data

    # ── Helper: Data Extraction ───────────────────────────────────────────

    def _extract_feedback(self, posts: List[Dict]) -> List[Dict[str, Any]]:
        """Extract customer feedback from posts"""
        feedback = []

        for post in posts[:15]:  # Top 15 most relevant
            if post.get('content') or post.get('title'):
                feedback.append({
                    'text': f"{post.get('title', '')}. {post.get('content', '')}".strip(),
                    'source': f"Reddit r/{post.get('subreddit', 'unknown')}",
                    'score': post.get('score', 0),
                    'url': post.get('url', ''),
                })

        return feedback

    def _extract_competitor_insights(self, posts: List[Dict], competitors: List[str]) -> List[Dict[str, Any]]:
        """Extract insights about competitors"""
        insights = []

        for post in posts:
            text = f"{post.get('title', '')} {post.get('content', '')}".lower()

            # Check if any competitor is mentioned
            for competitor in competitors:
                if competitor.lower() in text:
                    insights.append({
                        'competitor': competitor,
                        'mention': post.get('title', ''),
                        'context': post.get('content', '')[:200],
                        'sentiment': 'neutral',  # Could add sentiment analysis
                        'source': post.get('url', ''),
                    })

        return insights[:10]

    def _extract_trends(self, posts: List[Dict]) -> List[Dict[str, Any]]:
        """Extract market trends from discussions"""
        # Simple keyword-based trend detection
        trend_keywords = ['future', 'trend', 'emerging', 'growing', 'demand', 'need']
        trends = []

        for post in posts:
            text = f"{post.get('title', '')} {post.get('content', '')}".lower()

            if any(keyword in text for keyword in trend_keywords):
                trends.append({
                    'trend': post.get('title', ''),
                    'description': post.get('content', '')[:200],
                    'signals': post.get('score', 0),
                    'source': f"Reddit r/{post.get('subreddit', 'unknown')}",
                })

        return trends[:8]

    def _extract_pain_points(self, posts: List[Dict]) -> List[Dict[str, Any]]:
        """Extract customer pain points"""
        pain_keywords = ['problem', 'issue', 'struggle', 'difficult', 'pain', 'frustrat', 'annoying']
        pain_points = []

        for post in posts:
            text = f"{post.get('title', '')} {post.get('content', '')}".lower()

            if any(keyword in text for keyword in pain_keywords):
                pain_points.append({
                    'pain_point': post.get('title', ''),
                    'description': post.get('content', '')[:200],
                    'severity': 'medium',  # Could calculate based on engagement
                    'frequency': post.get('num_comments', 0),
                    'source': post.get('url', ''),
                })

        return pain_points[:10]

    def _extract_opportunities(self, posts: List[Dict]) -> List[Dict[str, Any]]:
        """Extract market opportunities"""
        opportunity_keywords = ['wish', 'would love', 'looking for', 'need', 'want', 'feature request']
        opportunities = []

        for post in posts:
            text = f"{post.get('title', '')} {post.get('content', '')}".lower()

            if any(keyword in text for keyword in opportunity_keywords):
                opportunities.append({
                    'opportunity': post.get('title', ''),
                    'description': post.get('content', '')[:200],
                    'potential_impact': 'medium',
                    'validation': f"{post.get('score', 0)} upvotes, {post.get('num_comments', 0)} comments",
                    'source': post.get('url', ''),
                })

        return opportunities[:8]


# Global instance
_scraper = None


def get_web_scraper() -> WebScraperService:
    """Get singleton web scraper instance"""
    global _scraper
    if _scraper is None:
        _scraper = WebScraperService()
    return _scraper
