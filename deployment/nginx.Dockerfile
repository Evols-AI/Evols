FROM nginx:alpine

# gettext provides envsubst
RUN apk add --no-cache gettext

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy the template (uses ${LIBRECHAT_UPSTREAM} / ${FRONTEND_UPSTREAM} placeholders)
COPY deployment/nginx.conf /etc/nginx/nginx.conf.template

COPY deployment/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]
