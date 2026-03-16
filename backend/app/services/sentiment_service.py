"""
Sentiment Analysis Service
Analyzes user messages for implicit feedback during adviser sessions
"""

from typing import Dict, Tuple
from enum import Enum


class SentimentLabel(str, Enum):
    """Sentiment categories"""
    POSITIVE = "POSITIVE"
    NEGATIVE = "NEGATIVE"
    NEUTRAL = "NEUTRAL"
    FRUSTRATED = "FRUSTRATED"


class SentimentAnalyzer:
    """
    Simple rule-based sentiment analyzer for user messages.
    Detects positive, negative, and frustrated sentiments.
    """

    def __init__(self):
        # Positive indicators
        self.positive_keywords = [
            'perfect', 'exactly', 'great', 'excellent', 'love', 'amazing',
            'fantastic', 'wonderful', 'brilliant', 'awesome', 'good', 'nice',
            'thank', 'thanks', 'helpful', 'useful', 'clear', 'better',
            'yes', 'correct', 'right', 'accurate'
        ]

        # Negative indicators
        self.negative_keywords = [
            'no', 'not', 'wrong', 'bad', 'poor', 'terrible', 'awful',
            'horrible', 'useless', 'unhelpful', 'unclear', 'confusing',
            'incorrect', 'inaccurate', 'missing', 'incomplete', 'lacks'
        ]

        # Frustrated indicators (stronger negative signal)
        self.frustrated_keywords = [
            'still wrong', 'still not', 'again', 'keeps', 'always',
            'never works', 'forget it', 'give up', 'waste', 'frustrated',
            'annoyed', 'irritated', 'third time', 'already told'
        ]

        # Negation words that flip sentiment
        self.negations = ['not', "n't", 'no', 'never', 'neither', 'nor']

    def analyze(self, message: str) -> Tuple[SentimentLabel, float]:
        """
        Analyze message sentiment.

        Args:
            message: User's message text

        Returns:
            Tuple of (SentimentLabel, confidence_score)
            confidence_score: -1.0 (very negative) to 1.0 (very positive)
        """
        message_lower = message.lower()

        # Check for frustration first (strongest signal)
        frustrated_count = sum(1 for phrase in self.frustrated_keywords
                             if phrase in message_lower)
        if frustrated_count > 0:
            return (SentimentLabel.FRUSTRATED, -0.9)

        # Count positive and negative keywords
        positive_count = sum(1 for word in self.positive_keywords
                           if f' {word} ' in f' {message_lower} ')
        negative_count = sum(1 for word in self.negative_keywords
                           if f' {word} ' in f' {message_lower} ')

        # Check for negations that might flip sentiment
        has_negation = any(neg in message_lower for neg in self.negations)

        # Calculate base score
        if positive_count > negative_count:
            # Mostly positive
            if has_negation and 'not bad' in message_lower or 'not wrong' in message_lower:
                # "not bad" = mildly positive
                sentiment = SentimentLabel.POSITIVE
                score = 0.4
            elif has_negation:
                # Negation might reduce positivity
                sentiment = SentimentLabel.NEUTRAL
                score = 0.1
            else:
                sentiment = SentimentLabel.POSITIVE
                score = min(0.9, 0.3 + positive_count * 0.2)
        elif negative_count > positive_count:
            # Mostly negative
            sentiment = SentimentLabel.NEGATIVE
            score = max(-0.8, -0.3 - negative_count * 0.2)
        else:
            # Neutral or balanced
            sentiment = SentimentLabel.NEUTRAL
            score = 0.0

        # Very short messages (<5 words) reduce confidence
        word_count = len(message.split())
        if word_count < 5:
            score *= 0.5

        return (sentiment, score)

    def analyze_batch(self, messages: list[str]) -> Dict[str, any]:
        """
        Analyze multiple messages and aggregate sentiment.

        Args:
            messages: List of message texts

        Returns:
            Dict with aggregated sentiment stats
        """
        if not messages:
            return {
                "overall_sentiment": SentimentLabel.NEUTRAL,
                "average_score": 0.0,
                "positive_count": 0,
                "negative_count": 0,
                "neutral_count": 0,
                "frustrated_count": 0,
                "total_messages": 0
            }

        sentiments = []
        scores = []

        for msg in messages:
            sentiment, score = self.analyze(msg)
            sentiments.append(sentiment)
            scores.append(score)

        # Count each sentiment type
        sentiment_counts = {
            SentimentLabel.POSITIVE: sentiments.count(SentimentLabel.POSITIVE),
            SentimentLabel.NEGATIVE: sentiments.count(SentimentLabel.NEGATIVE),
            SentimentLabel.NEUTRAL: sentiments.count(SentimentLabel.NEUTRAL),
            SentimentLabel.FRUSTRATED: sentiments.count(SentimentLabel.FRUSTRATED),
        }

        # Overall sentiment is the most common
        overall_sentiment = max(sentiment_counts.items(), key=lambda x: x[1])[0]

        # Average score
        avg_score = sum(scores) / len(scores) if scores else 0.0

        return {
            "overall_sentiment": overall_sentiment,
            "average_score": round(avg_score, 2),
            "positive_count": sentiment_counts[SentimentLabel.POSITIVE],
            "negative_count": sentiment_counts[SentimentLabel.NEGATIVE],
            "neutral_count": sentiment_counts[SentimentLabel.NEUTRAL],
            "frustrated_count": sentiment_counts[SentimentLabel.FRUSTRATED],
            "total_messages": len(messages)
        }


# Global instance
sentiment_analyzer = SentimentAnalyzer()
