#!/bin/bash

if type update-alternatives >/dev/null 2>&1; then
    if [ -L '/usr/bin/${executable}' -a -e '/usr/bin/${executable}' -a "`readlink '/usr/bin/${executable}'`" != '/etc/alternatives/${executable}' ]; then
        rm -f '/usr/bin/${executable}'
    fi
    update-alternatives --install '/usr/bin/${executable}' '${executable}' '/opt/${sanitizedProductName}/${executable}' 100 || ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
else
    ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

APPARMOR_PROFILE_SOURCE='/opt/${sanitizedProductName}/resources/apparmor-profile'
APPARMOR_PROFILE_TARGET='/etc/apparmor.d/${executable}'
if apparmor_status --enabled >/dev/null 2>&1; then
    if apparmor_parser --skip-kernel-load --debug "$APPARMOR_PROFILE_SOURCE" >/dev/null 2>&1; then
        cp -f "$APPARMOR_PROFILE_SOURCE" "$APPARMOR_PROFILE_TARGET"
        if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
            apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE_TARGET" || rm -f "$APPARMOR_PROFILE_TARGET"
        fi
    else
        echo "Skipping the AppArmor profile, this version of AppArmor does not support it"
    fi
fi

if [ -f "$APPARMOR_PROFILE_TARGET" ]; then
    chmod 0755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
elif [ "`cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null`" = 1 ] || ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    chmod 4755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
else
    chmod 0755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
fi
