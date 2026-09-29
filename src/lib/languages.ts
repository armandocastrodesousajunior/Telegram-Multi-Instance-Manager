export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export const POPULAR_LANGUAGES: LanguageOption[] = [
  { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'pt-PT', name: 'Português (Portugal)', flag: '🇵🇹' },
  { code: 'es', name: 'Espanhol (Geral)', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Espanhol (México)', flag: '🇲🇽' },
  { code: 'es-ES', name: 'Espanhol (Espanha)', flag: '🇪🇸' },
  { code: 'es-AR', name: 'Espanhol (Argentina)', flag: '🇦🇷' },
  { code: 'es-CO', name: 'Espanhol (Colômbia)', flag: '🇨🇴' },
  { code: 'es-CL', name: 'Espanhol (Chile)', flag: '🇨🇱' },
  { code: 'es-PE', name: 'Espanhol (Peru)', flag: '🇵🇪' },
  { code: 'en-US', name: 'Inglês (Estados Unidos)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'Inglês (Reino Unido)', flag: '🇬🇧' },
  { code: 'fr-FR', name: 'Francês (França)', flag: '🇫🇷' },
  { code: 'de-DE', name: 'Alemão (Alemanha)', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italiano (Itália)', flag: '🇮🇹' },
  { code: 'ru-RU', name: 'Russo (Rússia)', flag: '🇷🇺' },
  { code: 'zh-CN', name: 'Chinês (Simplificado)', flag: '🇨🇳' },
  { code: 'ja-JP', name: 'Japonês (Japão)', flag: '🇯🇵' },
  { code: 'ar-SA', name: 'Árabe (Arábia Saudita)', flag: '🇸🇦' },
];

export function getLanguageDisplay(code?: string): { code: string; label: string; flag: string } {
  const langCode = code?.trim() || 'pt-BR';
  const found = POPULAR_LANGUAGES.find(l => l.code.toLowerCase() === langCode.toLowerCase());
  if (found) {
    return { code: found.code, label: found.name, flag: found.flag };
  }
  return { code: langCode, label: langCode, flag: '🌐' };
}
