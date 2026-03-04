"""
Clustering Service
Cluster feedback items using embeddings and HDBSCAN
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.preprocessing import normalize
from collections import Counter, defaultdict
from loguru import logger

from app.services.embedding_service import EmbeddingService, get_embedding_service
from app.core.citations import Citation, CitationSourceType


class ClusterResult:
    """Result of clustering operation"""
    
    def __init__(
        self,
        cluster_labels: List[int],
        cluster_centers: Dict[int, List[float]],
        cluster_sizes: Dict[int, int],
        noise_points: List[int]
    ):
        self.cluster_labels = cluster_labels
        self.cluster_centers = cluster_centers
        self.cluster_sizes = cluster_sizes
        self.noise_points = noise_points
        self.n_clusters = len([c for c in cluster_sizes.keys() if c != -1])


class ClusteringService:
    """
    Service for clustering feedback items using HDBSCAN
    """
    
    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None,
        min_cluster_size: int = 3,
        min_samples: int = 2,
        metric: str = "cosine"
    ):
        self.embedding_service = embedding_service or get_embedding_service()
        self.min_cluster_size = min_cluster_size
        self.min_samples = min_samples
        self.metric = metric
    
    async def cluster_feedback(
        self,
        feedback_items: List[Any],
        embeddings: Optional[List[List[float]]] = None
    ) -> ClusterResult:
        """
        Cluster feedback items based on their content
        
        Args:
            feedback_items: List of Feedback model instances
            embeddings: Pre-computed embeddings (optional)
            
        Returns:
            ClusterResult with cluster assignments
        """
        if not feedback_items:
            return ClusterResult([], {}, {}, [])
        
        logger.info(f"Clustering {len(feedback_items)} feedback items")
        
        # Generate embeddings if not provided
        if embeddings is None:
            logger.info("Generating embeddings for feedback...")
            texts = [item.content for item in feedback_items]
            embeddings = await self.embedding_service.embed_batch(texts)
        
        # Convert to numpy array
        X = np.array(embeddings)
        
        # Normalize embeddings for cosine distance
        if self.metric == "cosine":
            X = normalize(X, norm='l2')
        
        logger.info("Running HDBSCAN clustering...")
        
        # Perform clustering
        clusterer = HDBSCAN(
            min_cluster_size=self.min_cluster_size,
            min_samples=self.min_samples,
            metric='euclidean' if self.metric == "cosine" else self.metric,
            cluster_selection_method='eom',  # Excess of Mass
        )
        
        cluster_labels = clusterer.fit_predict(X)
        
        # Calculate cluster centers (mean of embeddings in cluster)
        cluster_centers = {}
        cluster_sizes = Counter(cluster_labels)
        
        unique_labels = set(cluster_labels)
        for label in unique_labels:
            if label == -1:  # Skip noise
                continue
            
            mask = cluster_labels == label
            cluster_embeddings = X[mask]
            center = np.mean(cluster_embeddings, axis=0)
            cluster_centers[int(label)] = center.tolist()
        
        # Find noise points (label -1)
        noise_points = [i for i, label in enumerate(cluster_labels) if label == -1]
        
        logger.info(f"Found {len(unique_labels) - 1} clusters ({len(noise_points)} noise points)")
        
        return ClusterResult(
            cluster_labels=cluster_labels.tolist(),
            cluster_centers=cluster_centers,
            cluster_sizes={int(k): v for k, v in cluster_sizes.items()},
            noise_points=noise_points
        )
    
    def get_representative_feedback(
        self,
        feedback_items: List[Any],
        cluster_labels: List[int],
        embeddings: List[List[float]],
        cluster_id: int,
        n_representatives: int = 5
    ) -> List[Any]:
        """
        Get most representative feedback items from a cluster
        (Items closest to cluster center)
        
        Args:
            feedback_items: List of Feedback model instances
            cluster_labels: Cluster assignment for each item
            embeddings: Embedding vectors for each item
            cluster_id: Which cluster to extract from
            n_representatives: Number of representative items
            
        Returns:
            List of representative feedback items
        """
        # Find items in this cluster
        cluster_indices = [i for i, label in enumerate(cluster_labels) if label == cluster_id]
        
        if not cluster_indices:
            return []
        
        # Get cluster center
        cluster_embeddings = np.array([embeddings[i] for i in cluster_indices])
        center = np.mean(cluster_embeddings, axis=0)
        
        # Calculate distances to center
        distances = []
        for idx in cluster_indices:
            emb = np.array(embeddings[idx])
            dist = np.linalg.norm(emb - center)
            distances.append((idx, dist))
        
        # Sort by distance (closest first)
        distances.sort(key=lambda x: x[1])
        
        # Return top N items
        top_indices = [idx for idx, _ in distances[:n_representatives]]
        return [feedback_items[i] for i in top_indices]
    
    def get_cluster_statistics(
        self,
        feedback_items: List[Any],
        cluster_labels: List[int],
        cluster_id: int
    ) -> Dict[str, Any]:
        """
        Get statistics for a specific cluster
        
        Args:
            feedback_items: List of Feedback model instances
            cluster_labels: Cluster assignment for each item
            cluster_id: Which cluster to analyze
            
        Returns:
            Dictionary of statistics
        """
        # Find items in this cluster
        cluster_items = [
            feedback_items[i] 
            for i, label in enumerate(cluster_labels) 
            if label == cluster_id
        ]
        
        if not cluster_items:
            return {}
        
        # Count by category
        categories = defaultdict(int)
        for item in cluster_items:
            if item.category:
                categories[item.category.value] += 1
        
        # Count by segment
        segments = defaultdict(int)
        for item in cluster_items:
            if item.customer_segment:
                segments[item.customer_segment] += 1
        
        # Calculate average scores
        urgency_scores = [item.urgency_score for item in cluster_items if item.urgency_score is not None]
        avg_urgency = np.mean(urgency_scores) if urgency_scores else None
        
        sentiment_scores = [item.sentiment_score for item in cluster_items if item.sentiment_score is not None]
        avg_sentiment = np.mean(sentiment_scores) if sentiment_scores else None
        
        return {
            "size": len(cluster_items),
            "categories": dict(categories),
            "segments": dict(segments),
            "avg_urgency": float(avg_urgency) if avg_urgency is not None else None,
            "avg_sentiment": float(avg_sentiment) if avg_sentiment is not None else None,
            "primary_category": max(categories.items(), key=lambda x: x[1])[0] if categories else None,
            "primary_segment": max(segments.items(), key=lambda x: x[1])[0] if segments else None,
        }
    
    def calculate_cluster_arr(
        self,
        feedback_items: List[Any],
        accounts: Dict[int, Any],  # account_id -> Account model
        cluster_labels: List[int],
        cluster_id: int
    ) -> Tuple[float, int]:
        """
        Calculate total ARR and account count for a cluster
        
        Args:
            feedback_items: List of Feedback model instances
            accounts: Dictionary mapping account_id to Account instances
            cluster_labels: Cluster assignment for each item
            cluster_id: Which cluster to analyze
            
        Returns:
            Tuple of (total_arr, unique_account_count)
        """
        # Find items in this cluster
        cluster_items = [
            feedback_items[i] 
            for i, label in enumerate(cluster_labels) 
            if label == cluster_id
        ]
        
        # Get unique accounts
        unique_accounts = set()
        total_arr = 0.0
        
        for item in cluster_items:
            if item.account_id and item.account_id in accounts:
                account = accounts[item.account_id]
                unique_accounts.add(item.account_id)
                
                # Add ARR (avoid double counting)
                if hasattr(account, 'arr') and account.arr:
                    total_arr += account.arr
        
        # Deduplicate ARR (we added it for each feedback item)
        if unique_accounts:
            total_arr = total_arr / len([
                item for item in cluster_items 
                if item.account_id in unique_accounts
            ]) * len(unique_accounts)
        
        return total_arr, len(unique_accounts)


def auto_tune_clustering_params(
    n_items: int,
    target_n_clusters: Optional[int] = None
) -> Dict[str, int]:
    """
    Auto-tune clustering parameters based on dataset size
    
    Args:
        n_items: Number of items to cluster
        target_n_clusters: Desired number of clusters (optional)
        
    Returns:
        Dictionary of recommended parameters
    """
    if n_items < 10:
        min_cluster_size = 2
        min_samples = 1
    elif n_items < 50:
        min_cluster_size = 3
        min_samples = 2
    elif n_items < 200:
        min_cluster_size = 5
        min_samples = 3
    else:
        min_cluster_size = 10
        min_samples = 5
    
    # If target number of clusters is specified, adjust params
    if target_n_clusters:
        estimated_cluster_size = max(n_items // target_n_clusters, 2)
        min_cluster_size = max(min_cluster_size, estimated_cluster_size)
    
    return {
        "min_cluster_size": min_cluster_size,
        "min_samples": min_samples,
    }
