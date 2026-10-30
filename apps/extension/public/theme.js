(() => {
  const system = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    let choice = null;
    try {
      choice = localStorage.getItem('mimikTheme');
    } catch {}
    document.documentElement.classList.toggle('dark', choice === 'dark' || (choice !== 'light' && system.matches));
    globalThis.chrome?.storage?.local.set({ mimikTheme: choice ?? 'system' });
  };
  apply();
  system.addEventListener('change', apply);
  addEventListener('storage', (event) => {
    if (event.key === null || event.key === 'mimikTheme') apply();
  });
})();
