import React, { createContext, useCallback, useContext, useState } from 'react';
import { type AppLanguage, getAppLanguage, setAppLanguage } from '../services/chatPrefs';

type LanguageContextValue = {
  lang: AppLanguage;
  setLang: (l: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => undefined,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(getAppLanguage);

  const setLang = useCallback((l: AppLanguage) => {
    setAppLanguage(l);
    setLangState(l);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
