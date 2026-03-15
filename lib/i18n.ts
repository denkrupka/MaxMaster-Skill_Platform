// Translation system for multi-language support
export type Language = 'pl' | 'en' | 'uk';

export interface Translations {
  [key: string]: string | Translations;
}

export const translations = {
  pl: {
    // Common
    common: {
      save: 'Zapisz',
      cancel: 'Anuluj',
      delete: 'Usuń',
      edit: 'Edytuj',
      create: 'Utwórz',
      search: 'Szukaj',
      loading: 'Ładowanie...',
      error: 'Błąd',
      success: 'Sukces',
      confirm: 'Potwierdź',
      close: 'Zamknij',
      back: 'Wstecz',
      next: 'Dalej',
      submit: 'Wyślij',
    },
    // Documents
    documents: {
      title: 'Dokumenty do sprawdzenia',
      employee: 'Pracownik',
      document: 'Dokument',
      bonus: 'Bonus',
      status: 'Status',
      actions: 'Akcje',
      noDocuments: 'Brak dokumentów oczekujących na sprawdzenie.',
      selectAll: 'Zaznacz wszystkie',
      deselectAll: 'Odznacz wszystkie',
      signSelected: 'Podpisz wybrane',
      signing: 'Podpisywanie...',
      view: 'Podgląd',
      reject: 'Odrzuć',
      confirm: 'Zatwierdź',
      editDocument: 'Edytuj Dokument',
      documentName: 'Nazwa Dokumentu',
      attachFiles: 'Załącz Pliki',
      issueDate: 'Data Wydania',
      expiryDate: 'Data Ważności',
      indefinite: 'Dokument bezterminowy',
    },
    // Auth
    auth: {
      login: 'Zaloguj się',
      logout: 'Wyloguj',
      email: 'Email',
      password: 'Hasło',
      forgotPassword: 'Zapomniałeś hasła?',
    },
    // Navigation
    nav: {
      dashboard: 'Dashboard',
      employees: 'Pracownicy',
      candidates: 'Kandydaci',
      documents: 'Dokumenty',
      settings: 'Ustawienia',
      profile: 'Profil',
    },
    // Profile
    profile: {
      title: 'Profil',
      language: 'Język',
      personalInfo: 'Dane osobowe',
      changePassword: 'Zmień hasło',
    },
    // HR Templates
    templates: {
      title: 'Szablony HR',
      employmentContract: 'Umowa o pracę',
      nda: 'NDA - Poufność',
      fillAndSend: 'Wypełnij i wyślij',
      createTemplate: 'Utwórz szablon',
    },
    // Verification
    verification: {
      title: 'Weryfikacja tożsamości',
      verifyBeforeSign: 'Zweryfikuj przed podpisaniem',
      status: 'Status weryfikacji',
      verified: 'Zweryfikowany',
      pending: 'Oczekuje',
      failed: 'Niezweryfikowany',
    },
  },
  en: {
    // Common
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      search: 'Search',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      confirm: 'Confirm',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      submit: 'Submit',
    },
    // Documents
    documents: {
      title: 'Documents to Review',
      employee: 'Employee',
      document: 'Document',
      bonus: 'Bonus',
      status: 'Status',
      actions: 'Actions',
      noDocuments: 'No documents pending review.',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      signSelected: 'Sign Selected',
      signing: 'Signing...',
      view: 'View',
      reject: 'Reject',
      confirm: 'Confirm',
      editDocument: 'Edit Document',
      documentName: 'Document Name',
      attachFiles: 'Attach Files',
      issueDate: 'Issue Date',
      expiryDate: 'Expiry Date',
      indefinite: 'Indefinite Document',
    },
    // Auth
    auth: {
      login: 'Login',
      logout: 'Logout',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot password?',
    },
    // Navigation
    nav: {
      dashboard: 'Dashboard',
      employees: 'Employees',
      candidates: 'Candidates',
      documents: 'Documents',
      settings: 'Settings',
      profile: 'Profile',
    },
    // Profile
    profile: {
      title: 'Profile',
      language: 'Language',
      personalInfo: 'Personal Information',
      changePassword: 'Change Password',
    },
    // HR Templates
    templates: {
      title: 'HR Templates',
      employmentContract: 'Employment Contract',
      nda: 'NDA - Confidentiality',
      fillAndSend: 'Fill and Send',
      createTemplate: 'Create Template',
    },
    // Verification
    verification: {
      title: 'Identity Verification',
      verifyBeforeSign: 'Verify before signing',
      status: 'Verification Status',
      verified: 'Verified',
      pending: 'Pending',
      failed: 'Failed',
    },
  },
  uk: {
    // Common
    common: {
      save: 'Зберегти',
      cancel: 'Скасувати',
      delete: 'Видалити',
      edit: 'Редагувати',
      create: 'Створити',
      search: 'Пошук',
      loading: 'Завантаження...',
      error: 'Помилка',
      success: 'Успіх',
      confirm: 'Підтвердити',
      close: 'Закрити',
      back: 'Назад',
      next: 'Далі',
      submit: 'Відправити',
    },
    // Documents
    documents: {
      title: 'Документи на перевірку',
      employee: 'Співробітник',
      document: 'Документ',
      bonus: 'Бонус',
      status: 'Статус',
      actions: 'Дії',
      noDocuments: 'Немає документів, що очікують перевірки.',
      selectAll: 'Вибрати все',
      deselectAll: 'Скасувати вибір',
      signSelected: 'Підписати вибрані',
      signing: 'Підписання...',
      view: 'Перегляд',
      reject: 'Відхилити',
      confirm: 'Підтвердити',
      editDocument: 'Редагувати документ',
      documentName: 'Назва документа',
      attachFiles: 'Прикріпити файли',
      issueDate: 'Дата видачі',
      expiryDate: 'Термін дії',
      indefinite: 'Безстроковий документ',
    },
    // Auth
    auth: {
      login: 'Увійти',
      logout: 'Вийти',
      email: 'Email',
      password: 'Пароль',
      forgotPassword: 'Забули пароль?',
    },
    // Navigation
    nav: {
      dashboard: 'Панель',
      employees: 'Співробітники',
      candidates: 'Кандидати',
      documents: 'Документи',
      settings: 'Налаштування',
      profile: 'Профіль',
    },
    // Profile
    profile: {
      title: 'Профіль',
      language: 'Мова',
      personalInfo: 'Особисті дані',
      changePassword: 'Змінити пароль',
    },
    // HR Templates
    templates: {
      title: 'HR Шаблони',
      employmentContract: 'Трудовий договір',
      nda: 'NDA - Конфіденційність',
      fillAndSend: 'Заповнити та відправити',
      createTemplate: 'Створити шаблон',
    },
    // Verification
    verification: {
      title: 'Верифікація особи',
      verifyBeforeSign: 'Верифікувати перед підписанням',
      status: 'Статус верифікації',
      verified: 'Верифіковано',
      pending: 'Очікує',
      failed: 'Не верифіковано',
    },
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

// Helper function to get nested translation
export function t(lang: Language, key: string): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English
      value = translations['en'];
      for (const fk of keys) {
        if (value && typeof value === 'object' && fk in value) {
          value = value[fk];
        } else {
          return key; // Return key if translation not found
        }
      }
      return typeof value === 'string' ? value : key;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

// Detect language from document content
export function detectLanguageFromContent(content: string): Language {
  const lowerContent = content.toLowerCase();
  
  // Ukrainian patterns
  const ukPatterns = ['і', 'ї', 'є', 'ґ', 'та', 'для', 'що', 'як', 'не', 'це'];
  const ukCount = ukPatterns.filter(p => lowerContent.includes(p)).length;
  
  // Polish patterns
  const plPatterns = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż', 'i', 'nie', 'że', 'jest'];
  const plCount = plPatterns.filter(p => lowerContent.includes(p)).length;
  
  if (ukCount >= 3) return 'uk';
  if (plCount >= 3) return 'pl';
  return 'en';
}

// Get language name
export function getLanguageName(lang: Language): string {
  const names: Record<Language, string> = {
    pl: 'Polski',
    en: 'English',
    uk: 'Українська',
  };
  return names[lang];
}

// Get language flag emoji
export function getLanguageFlag(lang: Language): string {
  const flags: Record<Language, string> = {
    pl: '🇵🇱',
    en: '🇬🇧',
    uk: '🇺🇦',
  };
  return flags[lang];
}
