export interface ThemeTokens {
  background: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  foreground: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentGlow: string;
  border: string;
  borderHover: string;
  borderActive: string;
  muted: string;
  mutedHover: string;
  mutedStrong: string;
  green: string;
  red: string;
  yellow: string;
  purple: string;
  orange: string;
  cyan: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowGlow: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radius2xl: string;
  radiusFull: string;
}

export const darkTheme: ThemeTokens = {
  background: '#0a0a0f',
  bgPrimary: '#0f1117',
  bgSecondary: '#161821',
  bgTertiary: '#1e2030',
  bgElevated: '#252738',
  foreground: '#e2e8f0',
  textPrimary: '#e2e8f0',
  textSecondary: '#a0aec0',
  textMuted: '#5a6578',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  accentSoft: 'rgba(59, 130, 246, 0.15)',
  accentGlow: 'rgba(59, 130, 246, 0.4)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.15)',
  borderActive: 'rgba(59, 130, 246, 0.4)',
  muted: 'rgba(255, 255, 255, 0.05)',
  mutedHover: 'rgba(255, 255, 255, 0.08)',
  mutedStrong: 'rgba(255, 255, 255, 0.12)',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  orange: '#f97316',
  cyan: '#06b6d4',
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.4)',
  shadowLg: '0 10px 25px rgba(0, 0, 0, 0.5)',
  shadowGlow: '0 0 20px rgba(59, 130, 246, 0.3)',
  radiusSm: '6px',
  radiusMd: '8px',
  radiusLg: '10px',
  radiusXl: '14px',
  radius2xl: '20px',
  radiusFull: '9999px',
};

export const lightTheme: ThemeTokens = {
  background: '#ffffff',
  bgPrimary: '#f8f9fa',
  bgSecondary: '#f1f3f5',
  bgTertiary: '#e9ecef',
  bgElevated: '#ffffff',
  foreground: '#1a1a2e',
  textPrimary: '#1a1a2e',
  textSecondary: '#4a5568',
  textMuted: '#a0aec0',
  accent: '#2563eb',
  accentHover: '#1d4ed8',
  accentSoft: 'rgba(37, 99, 235, 0.1)',
  accentGlow: 'rgba(37, 99, 235, 0.25)',
  border: 'rgba(0, 0, 0, 0.08)',
  borderHover: 'rgba(0, 0, 0, 0.15)',
  borderActive: 'rgba(37, 99, 235, 0.4)',
  muted: 'rgba(0, 0, 0, 0.03)',
  mutedHover: 'rgba(0, 0, 0, 0.06)',
  mutedStrong: 'rgba(0, 0, 0, 0.09)',
  green: '#059669',
  red: '#dc2626',
  yellow: '#d97706',
  purple: '#7c3aed',
  orange: '#ea580c',
  cyan: '#0891b2',
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.06)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.08)',
  shadowLg: '0 10px 25px rgba(0, 0, 0, 0.12)',
  shadowGlow: '0 0 20px rgba(37, 99, 235, 0.15)',
  radiusSm: '6px',
  radiusMd: '8px',
  radiusLg: '10px',
  radiusXl: '14px',
  radius2xl: '20px',
  radiusFull: '9999px',
};

export function getThemeTokens(theme: 'dark' | 'light'): ThemeTokens {
  return theme === 'dark' ? darkTheme : lightTheme;
}
