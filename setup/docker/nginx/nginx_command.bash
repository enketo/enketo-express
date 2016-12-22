#!/bin/bash
set -e

ORIGINAL_DIR='/tmp/enketo_express_nginx/'
TEMPLATES_AVAILABLE_DIR='/tmp/nginx_templates_available'
TEMPLATES_ENABLED_DIR='/tmp/nginx_templates_enabled'

mkdir -p ${TEMPLATES_AVAILABLE_DIR}
cp -a /tmp/enketo_express_nginx/*.tmpl ${TEMPLATES_AVAILABLE_DIR}
mkdir -p ${TEMPLATES_ENABLED_DIR}

echo 'Clearing out any default configurations.'
rm -rf /etc/nginx/conf.d/*

# FIXME: Remove once Enketo Express is relocatable.
# Set up rewrites, if necessary.
if [[ "${ENKETO_EXPRESS_REWRITE_RESPONSE_REFERENCES}" == 'True' ]] && \
    [[ -n "${ENKETO_EXPRESS_URI_PREFIX}" ]] ; then
    echo 'Configuring Nginx to rewrite root-relative refernces in responses.'
    # Configure the rewrite destination.
    cat ${TEMPLATES_AVAILABLE_DIR}/enketo_express_rewrite_response_reference_rules.conf.tmpl \
        | envsubst '${ENKETO_EXPRESS_URI_PREFIX}' > ${TEMPLATES_ENABLED_DIR}/enketo_express_rewrite_response_reference_rules.conf
    # Activate the rewrites.
    export INCLUDE_REWRITE_RULES="include ${TEMPLATES_ENABLED_DIR}/enketo_express_rewrite_response_reference_rules.conf;"
else
    # Ensure the rewrites are not activated.
    export INCLUDE_REWRITE_RULES=''
fi
# Execute the variable substitution.
cat ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl \
    | envsubst '${INCLUDE_REWRITE_RULES}' > ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl.swp
mv ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl.swp ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl

# Determine whether or not to use a root URI prefix.
if [[ ! ${ENKETO_EXPRESS_URI_PREFIX} ]] ; then
    export INCLUDE_ROOT_URI_REDIRECT=''
    export ROOT_URI='/'
else
    echo "Using root URI prefix \"${ENKETO_EXPRESS_URI_PREFIX}\"."
    # Prepare the root URI redirect for when the terminating '/' is missing.
    cat ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location_uri_prefix.conf.tmpl \
        | envsubst '${ENKETO_EXPRESS_URI_PREFIX}' > ${TEMPLATES_ENABLED_DIR}/enketo_express_location_uri_prefix.conf
    export INCLUDE_ROOT_URI_REDIRECT="include ${TEMPLATES_ENABLED_DIR}/enketo_express_location_uri_prefix.conf;"
    export ROOT_URI="/${ENKETO_EXPRESS_URI_PREFIX}/"
fi
# Execute the variable substitutions.
cat ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl \
    | envsubst '${INCLUDE_ROOT_URI_REDIRECT}' > ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl.swp
mv ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl.swp ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl
cat ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl \
    | envsubst '${ROOT_URI}' > ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl.swp
mv ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf.tmpl.swp ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf

# Move the configured location file into place.
mv ${TEMPLATES_AVAILABLE_DIR}/enketo_express_location.conf ${TEMPLATES_ENABLED_DIR}/enketo_express_location.conf

# Check if the SSL certificate and key have been provided.
if [[ -e /tmp/enketo_express_secrets/ssl.crt ]] && [[ -s /tmp/enketo_express_secrets/ssl.crt ]] && \
    [[ -e /tmp/enketo_express_secrets/ssl.key ]] && [[ -s /tmp/enketo_express_secrets/ssl.key ]] ; then
    echo 'SSL certificate and key located. Activating HTTPS configuration.'
    cp /tmp/enketo_express_nginx/enketo_express_site_https.conf /etc/nginx/conf.d/
else
    echo 'No SSL certificate and key found. Activating plain HTTP configuration.'
    cp /tmp/enketo_express_nginx/enketo_express_site_http.conf /etc/nginx/conf.d/
fi

exec nginx -g 'daemon off;'
