export interface ThemeTokens {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  border: string;
  green: string;
  red: string;
  yellow: string;
  purple: string;
  orange: string;
}

export const darkTheme: ThemeTokens = {
  bgPrimary: '#1a1b26',
  bgSecondary: '#24283b',
  bgTertiary: '#292e42',
  textPrimary: '#c0caf5',
  textSecondary: '#a9b1d6',
  textMuted: '#565f89',
  accent: '#7aa2f7',
  accentSoft: 'rgba(122, 162, 247, 0.15)',
  border: '#3b4261',
  green: '#9ece6a',
  red: '#f7768e',
  yellow: '#e0af68',
  purple: '#bb9af7',
  orange: '#ff9e64',
};

export const lightTheme: ThemeTokens = {
  bgPrimary: '#f5f5f5',
  bgSecondary: '#ffffff',
  bgTertiary: '#e8e8e8',
  textPrimary: '#1a1b26',
  textSecondary: '#4c505e',
  textMuted: '#8b8fa3',
  accent: '#2e59a8',
  accentSoft: 'rgba(46, 89, 168, 0.12)',
  border: '#d4d4d8',
  green: '#4a9c3c',
  red: '#d63a3a',
  yellow: '#b88a1e',
  purple: '#7c3aed',
  orange: '#d97706',
};

export function getThemeTokens(theme: 'dark' | 'light'): ThemeTokens {
  return theme === 'dark' ? darkTheme : lightTheme;
}
