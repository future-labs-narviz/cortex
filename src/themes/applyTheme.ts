import { darkTheme, type ThemeTokens } from './tokens';

export function applyTheme(tokens: ThemeTokens) {
  const root = document.documentElement;

  // Set the data-theme attribute so the CSS [data-theme="light"] block activates
  root.dataset.theme = tokens === darkTheme ? 'dark' : 'light';

  // Also set CSS variables directly so JS-applied themes override the stylesheet
  root.style.setProperty('--background', tokens.background);
  root.style.setProperty('--bg-primary', tokens.bgPrimary);
  root.style.setProperty('--bg-secondary', tokens.bgSecondary);
  root.style.setProperty('--bg-tertiary', tokens.bgTertiary);
  root.style.setProperty('--bg-elevated', tokens.bgElevated);
  root.style.setProperty('--foreground', tokens.foreground);
  root.style.setProperty('--text-primary', tokens.textPrimary);
  root.style.setProperty('--text-secondary', tokens.textSecondary);
  root.style.setProperty('--text-muted', tokens.textMuted);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--accent-hover', tokens.accentHover);
  root.style.setProperty('--accent-soft', tokens.accentSoft);
  root.style.setProperty('--accent-glow', tokens.accentGlow);
  root.style.setProperty('--border', tokens.border);
  root.style.setProperty('--border-hover', tokens.borderHover);
  root.style.setProperty('--border-active', tokens.borderActive);
  root.style.setProperty('--muted', tokens.muted);
  root.style.setProperty('--muted-hover', tokens.mutedHover);
  root.style.setProperty('--muted-strong', tokens.mutedStrong);
  root.style.setProperty('--green', tokens.green);
  root.style.setProperty('--red', tokens.red);
  root.style.setProperty('--yellow', tokens.yellow);
  root.style.setProperty('--purple', tokens.purple);
  root.style.setProperty('--orange', tokens.orange);
  root.style.setProperty('--cyan', tokens.cyan);
  root.style.setProperty('--shadow-sm', tokens.shadowSm);
  root.style.setProperty('--shadow-md', tokens.shadowMd);
  root.style.setProperty('--shadow-lg', tokens.shadowLg);
  root.style.setProperty('--shadow-glow', tokens.shadowGlow);
  root.style.setProperty('--radius-sm', tokens.radiusSm);
  root.style.setProperty('--radius-md', tokens.radiusMd);
  root.style.setProperty('--radius-lg', tokens.radiusLg);
  root.style.setProperty('--radius-xl', tokens.radiusXl);
  root.style.setProperty('--radius-2xl', tokens.radius2xl);
  root.style.setProperty('--radius-full', tokens.radiusFull);
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
