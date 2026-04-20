FROM nginx:alpine

# gettext provides envsubst
RUN apk add --no-cache gettext

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy the template (uses ${LIBRECHAT_UPSTREAM} / ${FRONTEND_UPSTREAM} placeholders)
COPY deployment/nginx.conf /etc/nginx/nginx.conf.template

# Write the start script inline so the image is self-contained
RUN printf '#!/bin/sh\nset -e\n\n# Substitute env vars into the template\nenvsubst "${LIBRECHAT_UPSTREAM} ${FRONTEND_UPSTREAM}" \\\n    < /etc/nginx/nginx.conf.template \\\n    > /etc/nginx/nginx.conf\n\nexec nginx -g "daemon off;"\n' > /start.sh && chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]
