import { i18n } from '@mimik/core/env';
import { replaceGuideHost } from '@mimik/core/guides/service';
import { logger } from '@mimik/core/logger';
import { useState } from 'react';
import { FaviconImg } from '../../common/components/FaviconImg';

interface GuideHostFieldProps {
  guideId: string;
  domain: string;
  origin: string;
  onChanged: () => void;
}

export function GuideHostField({ guideId, domain, origin, onChanged }: GuideHostFieldProps) {
  const [value, setValue] = useState(origin);
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    const typed = value.trim();
    if (!typed || typed === origin) {
      setValue(origin);
      return;
    }
    replaceGuideHost(guideId, origin, typed)
      .then(onChanged)
      .catch((err) => {
        setInvalid(true);
        logger.error(' Guide host change failed', err);
      });
  };

  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-card border border-border pl-1.5 pr-2.5 py-0.5 rounded-full">
        <FaviconImg domain={domain} size={14} className="rounded-full" />
        <input
          value={value}
          size={Math.max(value.length, 1)}
          aria-label={i18n.t('editor.guideHost')}
          aria-invalid={invalid}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="field-sizing-content bg-transparent focus:outline-none"
        />
      </span>
      {invalid && (
        <span className="text-[11px] text-destructive" role="alert">
          {i18n.t('editor.guideHostInvalid')}
        </span>
      )}
    </>
  );
}
