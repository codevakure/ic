import {en_US, EnKeys} from './en_US';

const languages = {
  en_US
};

export type Language = keyof typeof languages;

export function getTranslate(language: string) {
  language = language.replace('-', '_');
  if (!(language in languages)) {
    console.warn('language not found, use en_US instead', language);
    language = 'en_US';
  }
  return (key: EnKeys) => {
    return languages[language as Language][key];
  };
}
