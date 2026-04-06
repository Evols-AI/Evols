# Installation Guide

## Quick Start (Minimum Dependencies)

For a basic installation with essential features only:

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install core dependencies
pip install -r requirements.txt
```

## Customizing Your Installation

### 1. LLM Providers (Choose what you need)

**Edit `requirements.txt` and uncomment only the providers you'll use:**

- **AWS Bedrock**: Keep `boto3` and `botocore` (uses AWS credentials)
- **OpenAI**: Keep `openai>=1.54.0` 
- **Anthropic**: Keep `anthropic==0.18.1`
- **Google Gemini**: Keep `google-generativeai>=0.8.0`

**Comment out providers you don't need** to reduce installation time and dependencies.

### 2. Heavy ML Features (Optional)

For local embeddings and advanced clustering, uncomment in `requirements.txt`:

```python
# sentence-transformers==2.3.1  # Remove the # to enable
# torch==2.2.0                  # Remove the # to enable  
# scikit-learn==1.4.0           # Remove the # to enable
# hdbscan==0.8.33               # Remove the # to enable
```

⚠️ **Warning**: These packages are 2GB+ downloads and memory-intensive.

### 3. Development Tools (Optional)

For contributing to the codebase, uncomment in `requirements.txt`:

```python
# pytest==7.4.4      # Remove the # to enable
# pytest-asyncio==0.23.3
# black==24.1.1
# flake8==7.0.0
# mypy==1.8.0
```

## Installation Examples

### Minimal Setup (API keys only)
```bash
# Edit requirements.txt - comment out all LLM providers except what you use
pip install -r requirements.txt
```

### Full Setup (All features)
```bash
# Edit requirements.txt - uncomment [HEAVY ML] and [DEVELOPMENT] sections
pip install -r requirements.txt
```

### Production Setup (No dev tools)
```bash
# Keep [HEAVY ML] commented out, keep needed LLM providers
pip install -r requirements.txt
```

## Troubleshooting

### Error: "externally-managed-environment"
Always use a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

### Error: "google-generativeai package is required"
Make sure Google Gemini is uncommented in requirements.txt and restart your backend server.

### Large Download Times
Comment out heavy ML dependencies in requirements.txt if you don't need local embeddings.