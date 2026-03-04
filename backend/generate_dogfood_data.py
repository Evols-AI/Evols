import csv
import random
from datetime import datetime, timedelta
import os

# Configuration
RECORD_COUNT = 310
OUTPUT_FILE = '/Users/akshay/Desktop/workspace/ProductOS/backend/data/dogfood_feedback.csv'

FEATURE_AREAS = [
    "Decision Workbench", "Persona Digital Twins", "Knowledge Graph", 
    "Outcome Tracking", "Jira Integration", "Executive Dashboard", 
    "Citations & Evidence", "Clustering Accuracy", "Search & Filters",
    "UI Responsiveness", "API Access", "Role Based Access", "Mobile View",
    "Slack Notifications", "Data Ingestion (Intercom/Zendesk)", "Export to PPT/PDF"
]

SEGMENTS = ["Enterprise", "Mid-Market", "SMB", "Growth", "Early-Stage"]

PERSONAS = [
    {"name": "Sarah Chen", "role": "Senior PM", "sources": ["intercom", "productboard"]},
    {"name": "Marcus Thorne", "role": "Head of Product", "sources": ["zendesk", "salesforce"]},
    {"name": "Alex Rivera", "role": "Product Ops", "sources": ["manual_upload", "api"]},
    {"name": "Jordan Smith", "role": "Director of Product", "sources": ["gong", "intercom"]},
    {"name": "Elena Vance", "role": "Senior Engineer", "sources": ["slack", "zendesk"]},
    {"name": "Chloe Park", "role": "VP of Engineering", "sources": ["salesforce", "gong"]},
    {"name": "David Wu", "role": "Junior PM", "sources": ["intercom", "productboard"]},
    {"name": "Sam Taylor", "role": "Customer Success Manager", "sources": ["zendesk", "intercom"]},
    {"name": "Lisa Ray", "role": "CEO", "sources": ["salesforce", "manual_upload"]},
    {"name": "Tom Baker", "role": "Data Analyst", "sources": ["api", "manual_upload"]}
]

CATEGORIES = ["feature_request", "bug", "improvement", "question", "complaint"]

FEEDBACK_TEMPLATES = {
    "feature_request": [
        "I need a way to {feature} in the workflow.",
        "Can we add {feature} support? It would save us hours.",
        "Requested {feature} for the {segment} segment.",
        "The {feature} is essential for our Q3 planning.",
        "Would love to see a native integration for {feature}."
    ],
    "bug": [
        "The {feature} is currently failing when I try to save.",
        "Seeing a 500 error on the {feature} page.",
        "UI glitch in the {feature} component on mobile.",
        "The logic for {feature} seems off for the {segment} data.",
        "Broken link in the {feature} documentation."
    ],
    "improvement": [
        "The {feature} is great, but it needs to be faster.",
        "Make the {feature} more intuitive for new PMs.",
        "The {feature} visualization is a bit cluttered.",
        "Add more granularity to the {feature} filters.",
        "Keyboard shortcuts for {feature} would be a game changer."
    ],
    "question": [
        "How is the {feature} score calculated?",
        "Is there a way to export {feature} data to CSV?",
        "Does the {feature} support cross-tenant analysis?",
        "Where can I find the settings for {feature}?",
        "How do I mapping my initiatives to the {feature}?"
    ],
    "complaint": [
        "The {feature} is too slow for large datasets.",
        "I find the {feature} flow very confusing.",
        "The {feature} results didn't match our manual findings.",
        "We're missing the {feature} in our current tier.",
        "The {feature} notifications are too noisy."
    ]
}

def generate_feedback():
    data = []
    for _ in range(RECORD_COUNT):
        persona = random.choice(PERSONAS)
        category = random.choice(CATEGORIES)
        feature = random.choice(FEATURE_AREAS)
        segment = random.choice(SEGMENTS)
        source = random.choice(persona["sources"])
        
        template = random.choice(FEEDBACK_TEMPLATES[category])
        content = template.format(feature=feature, segment=segment)
        urgency = round(random.uniform(0.1, 1.0), 2)
        impact = round(random.uniform(0.1, 1.0), 2)
        days_ago = random.randint(0, 60)
        fb_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        
        data.append({
            "source": source, "customer_name": persona["name"], "customer_segment": segment,
            "content": content, "category": category, "urgency_score": urgency,
            "impact_score": impact, "feedback_date": fb_date
        })
    return data

def write_csv(data):
    keys = ["source", "customer_name", "customer_segment", "content", "category", "urgency_score", "impact_score", "feedback_date"]
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', newline='') as f:
        dict_writer = csv.DictWriter(f, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(data)

if __name__ == "__main__":
    feedback_data = generate_feedback()
    write_csv(feedback_data)
    print(f"Successfully generated {len(feedback_data)} records in {OUTPUT_FILE}")
