export function withPropertyFallbacks(css: string): string {
  const defaults = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)].flatMap(([, name, body]) => {
    const value = /initial-value:\s*([^;]+)/.exec(body ?? '')?.[1]?.trim();
    return value === undefined ? [] : [`${name}: ${value}`];
  });
  if (defaults.length === 0) return css;
  return `${css}\n@layer properties {\n  :host, *, ::before, ::after, ::backdrop { ${defaults.join('; ')}; }\n}\n`;
}
