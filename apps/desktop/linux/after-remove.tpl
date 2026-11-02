#!/bin/bash

if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/opt/${sanitizedProductName}/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

APPARMOR_PROFILE_TARGET='/etc/apparmor.d/${executable}'
if [ -f "$APPARMOR_PROFILE_TARGET" ]; then
    if apparmor_status --enabled >/dev/null 2>&1; then
        if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
            apparmor_parser --remove "$APPARMOR_PROFILE_TARGET" || true
        fi
    fi
    rm -f "$APPARMOR_PROFILE_TARGET"
fi
