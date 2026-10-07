import { useState } from 'react';
import { getDomainInitial } from '../lib/domain-initial';
import { getFaviconUrl } from '../lib/favicon-url';

interface FaviconImgProps {
  domain: string;
  size?: number;
  className?: string;
  letterOnly?: boolean;
}

export function FaviconImg({ domain, size = 20, className = '', letterOnly = false }: FaviconImgProps) {
  const [failed, setFailed] = useState(false);
  const src = domain && !letterOnly ? getFaviconUrl(domain, size > 32 ? 64 : 32) : '';

  if (!src || failed) {
    const { letter, gradient } = getDomainInitial(domain || '?');
    const fontSize = Math.max(Math.round(size * 0.55), 6);
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          color: '#fff',
          fontSize,
          fontWeight: 600,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      style={{ width: size, height: size, flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}
