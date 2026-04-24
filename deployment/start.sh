#!/bin/sh
set -e

# Single-quoted filter: envsubst only replaces these two vars,
# leaving nginx variables like $remote_addr untouched.
envsubst '${LIBRECHAT_UPSTREAM} ${FRONTEND_UPSTREAM} ${BACKEND_UPSTREAM} ${LIBRECHAT_HOST} ${FRONTEND_HOST} ${BACKEND_HOST} ${PUBLIC_HOST}' \
    < /etc/nginx/nginx.conf.template \
    > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
