import { darkTheme, type ThemeTokens } from './tokens';

export function applyTheme(tokens: ThemeTokens) {
  const root = document.documentElement;
  root.style.setProperty('--bg-primary', tokens.bgPrimary);
  root.style.setProperty('--bg-secondary', tokens.bgSecondary);
  root.style.setProperty('--bg-tertiary', tokens.bgTertiary);
  root.style.setProperty('--text-primary', tokens.textPrimary);
  root.style.setProperty('--text-secondary', tokens.textSecondary);
  root.style.setProperty('--text-muted', tokens.textMuted);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--accent-soft', tokens.accentSoft);
  root.style.setProperty('--border', tokens.border);
  root.style.setProperty('--green', tokens.green);
  root.style.setProperty('--red', tokens.red);
  root.style.setProperty('--yellow', tokens.yellow);
  root.style.setProperty('--purple', tokens.purple);
  root.style.setProperty('--orange', tokens.orange);
  root.setAttribute('data-theme', tokens === darkTheme ? 'dark' : 'light');
}

export function applyCustomCSS(css: string) {
  let styleEl = document.getElementById('cortex-custom-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'cortex-custom-css';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

export function applyFontSettings(family: string, size: number, lineHeight: number) {
  const root = document.documentElement;

  const fontMap: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    jetbrains: '"JetBrains Mono", monospace',
    fira: '"Fira Code", monospace',
    inter: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  };

  root.style.setProperty('--font-family', fontMap[family] ?? fontMap.system);
  root.style.setProperty('--font-size', `${size}px`);
  root.style.setProperty('--line-height', String(lineHeight));
}
