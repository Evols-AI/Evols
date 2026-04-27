# Evols custom LightRAG image
#
# Adds ENTITY_ATTRIBUTES support: operators can pass a JSON list of attribute
# names (e.g. '["sentiment","urgency","business_impact","confidence"]') and
# LightRAG will extract them as a compact JSON object appended to each entity
# record during graph extraction.
#
# Build:
#   docker build -f docker/lightrag.Dockerfile -t evols-lightrag:entity-attributes .
#
# The patch (lightrag-entity-attributes.patch) is applied on top of the
# official lightrag-hku wheel.  Pin the version here to keep builds
# reproducible; bump together with the patch when upgrading LightRAG.

FROM python:3.11-slim

ARG LIGHTRAG_VERSION=1.4.15

# System deps required by lightrag storage backends
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        libpq-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the exact upstream release first so all transitive deps are resolved
RUN pip install --no-cache-dir "lightrag-hku==${LIGHTRAG_VERSION}"

# Apply the entity-attributes patch on top of the installed package.
# The patch modifies only Python source files so we can apply it directly to
# the site-packages installation without rebuilding the wheel.
COPY lightrag-entity-attributes.patch /tmp/lightrag-entity-attributes.patch
RUN SITE=$(python -c "import site; print(site.getsitepackages()[0])") && \
    patch -d "${SITE}" -p1 < /tmp/lightrag-entity-attributes.patch && \
    rm /tmp/lightrag-entity-attributes.patch

# Default working directory for graph storage
RUN mkdir -p /app/data/rag_storage /app/inputs
ENV WORKING_DIR=/app/data/rag_storage
ENV INPUT_DIR=/app/inputs

EXPOSE 9621

# Use the lightrag API server entrypoint bundled with the package
CMD ["python", "-m", "lightrag.api.lightrag_server"]
