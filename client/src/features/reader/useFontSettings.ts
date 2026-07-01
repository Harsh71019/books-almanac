import { useCallback, useState } from 'react';
import { DEFAULT_FONT_SETTINGS } from './types';
import type { FontSettings, ThemePreset } from './types';

const STORAGE_KEY = 'reader-font-settings';

function loadSettings(): FontSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_FONT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_FONT_SETTINGS;
}

export function useFontSettings() {
  const [settings, setSettings] = useState<FontSettings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<FontSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const applyPreset = useCallback((preset: ThemePreset) => {
    const next: FontSettings = {
      ...DEFAULT_FONT_SETTINGS,           // reset spacing/margins to 0
      fontFamily:  preset.settings.fontFamily,
      fontSize:    preset.settings.fontSize,
      lineSpacing: preset.settings.lineSpacing,
      bold:        preset.settings.bold,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setSettings(next);
    return preset.settings.theme;          // caller applies theme separately
  }, []);

  const resetSettings = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setSettings(DEFAULT_FONT_SETTINGS);
  }, []);

  return { settings, updateSettings, applyPreset, resetSettings };
}
