export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'textarea';
  required?: boolean;
}

export interface BuiltinTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  variables: TemplateVariable[];
  content: string;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'umowa_o_dzielo',
    name: 'Umowa o dzieło',
    category: 'Umowy',
    description: 'Standardowa umowa o wykonanie dzieła/usługi',
    variables: [
      { name: 'firma_nazwa', label: 'Nazwa firmy (Zamawiający)', type: 'text', required: true },
      { name: 'firma_nip', label: 'NIP firmy', type: 'text', required: true },
      { name: 'firma_adres', label: 'Adres firmy', type: 'text', required: true },
      { name: 'kontrahent_nazwa', label: 'Imię i nazwisko Wykonawcy', type: 'text', required: true },
      { name: 'kontrahent_pesel', label: 'PESEL Wykonawcy', type: 'text' },
      { name: 'kontrahent_adres', label: 'Adres Wykonawcy', type: 'text', required: true },
      { name: 'opis_dziela', label: 'Opis dzieła/usługi', type: 'textarea', required: true },
      { name: 'kwota', label: 'Kwota wynagrodzenia (PLN)', type: 'number', required: true },
      { name: 'termin_realizacji', label: 'Termin realizacji', type: 'date', required: true },
      { name: 'data', label: 'Data zawarcia umowy', type: 'date', required: true },
      { name: 'miejsce', label: 'Miejsce zawarcia umowy', type: 'text', required: true },
    ],
    content: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #333;">

<h1 style="text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 8px;">UMOWA O DZIEŁO</h1>
<p style="text-align: center; color: #666; margin-bottom: 32px;">zawarta dnia {{data}} w {{miejsce}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 1. STRONY UMOWY</h2>
<p><strong>Zamawiający:</strong><br>
{{firma_nazwa}}, NIP: {{firma_nip}}<br>
{{firma_adres}}</p>
<p style="margin-top: 12px;"><strong>Wykonawca:</strong><br>
{{kontrahent_nazwa}}, PESEL: {{kontrahent_pesel}}<br>
{{kontrahent_adres}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 2. PRZEDMIOT UMOWY</h2>
<p>Zamawiający zleca, a Wykonawca zobowiązuje się do wykonania następującego dzieła:</p>
<p style="padding: 12px; background: #f9f9f9; border-left: 3px solid #ccc; margin: 12px 0;">{{opis_dziela}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 3. TERMIN REALIZACJI</h2>
<p>Wykonawca zobowiązuje się wykonać dzieło do dnia: <strong>{{termin_realizacji}}</strong></p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 4. WYNAGRODZENIE</h2>
<p>Za wykonanie dzieła Zamawiający zapłaci Wykonawcy wynagrodzenie w wysokości: <strong>{{kwota}} PLN brutto</strong> (słownie: ____________).</p>
<p>Wynagrodzenie zostanie wypłacone w terminie 7 dni od daty odbioru dzieła, przelewem bankowym na rachunek wskazany przez Wykonawcę.</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 5. PRAWA AUTORSKIE</h2>
<p>Z chwilą przyjęcia dzieła przez Zamawiającego, Wykonawca przenosi na Zamawiającego autorskie prawa majątkowe do dzieła na wszelkich polach eksploatacji.</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 6. POSTANOWIENIA KOŃCOWE</h2>
<p>W sprawach nieuregulowanych niniejszą umową mają zastosowanie przepisy Kodeksu Cywilnego. Wszelkie zmiany umowy wymagają formy pisemnej pod rygorem nieważności.</p>

<div style="display: flex; justify-content: space-between; margin-top: 60px; gap: 40px;">
  <div style="flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Zamawiający</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{firma_nazwa}}</p>
  </div>
  <div style="flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Wykonawca</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{kontrahent_nazwa}}</p>
  </div>
</div>
</div>`
  },
  {
    id: 'umowa_zlecenie',
    name: 'Umowa zlecenie',
    category: 'Umowy',
    description: 'Umowa zlecenia na wykonanie usługi',
    variables: [
      { name: 'firma_nazwa', label: 'Nazwa firmy (Zleceniodawca)', type: 'text', required: true },
      { name: 'firma_nip', label: 'NIP firmy', type: 'text', required: true },
      { name: 'firma_adres', label: 'Adres firmy', type: 'text', required: true },
      { name: 'kontrahent_nazwa', label: 'Imię i nazwisko Zleceniobiorcy', type: 'text', required: true },
      { name: 'kontrahent_pesel', label: 'PESEL', type: 'text' },
      { name: 'kontrahent_adres', label: 'Adres Zleceniobiorcy', type: 'text', required: true },
      { name: 'opis_uslugi', label: 'Opis zlecanych czynności', type: 'textarea', required: true },
      { name: 'stawka_godzinowa', label: 'Stawka godzinowa (PLN)', type: 'number', required: true },
      { name: 'data_od', label: 'Data od', type: 'date', required: true },
      { name: 'data_do', label: 'Data do', type: 'date', required: true },
      { name: 'data', label: 'Data zawarcia umowy', type: 'date', required: true },
      { name: 'miejsce', label: 'Miejsce zawarcia umowy', type: 'text', required: true },
    ],
    content: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #333;">

<h1 style="text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 8px;">UMOWA ZLECENIE</h1>
<p style="text-align: center; color: #666; margin-bottom: 32px;">zawarta dnia {{data}} w {{miejsce}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 1. STRONY UMOWY</h2>
<p><strong>Zleceniodawca:</strong><br>
{{firma_nazwa}}, NIP: {{firma_nip}}<br>
{{firma_adres}}</p>
<p style="margin-top: 12px;"><strong>Zleceniobiorca:</strong><br>
{{kontrahent_nazwa}}, PESEL: {{kontrahent_pesel}}<br>
{{kontrahent_adres}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 2. PRZEDMIOT UMOWY</h2>
<p>Zleceniodawca zleca, a Zleceniobiorca zobowiązuje się do wykonania następujących czynności:</p>
<p style="padding: 12px; background: #f9f9f9; border-left: 3px solid #ccc; margin: 12px 0;">{{opis_uslugi}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 3. CZAS TRWANIA</h2>
<p>Umowa obowiązuje od <strong>{{data_od}}</strong> do <strong>{{data_do}}</strong>.</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 4. WYNAGRODZENIE</h2>
<p>Za wykonanie zlecenia Zleceniobiorca otrzyma wynagrodzenie w wysokości <strong>{{stawka_godzinowa}} PLN brutto</strong> za każdą przepracowaną godzinę.</p>
<p>Wynagrodzenie wypłacane będzie miesięcznie, po dostarczeniu ewidencji godzin.</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 5. POSTANOWIENIA KOŃCOWE</h2>
<p>Umowa może być rozwiązana przez każdą ze stron za 7-dniowym wypowiedzeniem. W sprawach nieuregulowanych stosuje się przepisy Kodeksu Cywilnego.</p>

<div style="display: flex; justify-content: space-between; margin-top: 60px; gap: 40px;">
  <div style="flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Zleceniodawca</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{firma_nazwa}}</p>
  </div>
  <div style="flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Zleceniobiorca</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{kontrahent_nazwa}}</p>
  </div>
</div>
</div>`
  },
  {
    id: 'protokol_odbioru',
    name: 'Protokół odbioru robót',
    category: 'Protokoły',
    description: 'Protokół odbioru wykonanych prac budowlanych',
    variables: [
      { name: 'firma_nazwa', label: 'Nazwa firmy (Wykonawca)', type: 'text', required: true },
      { name: 'kontrahent_nazwa', label: 'Nazwa Zamawiającego', type: 'text', required: true },
      { name: 'adres_obiektu', label: 'Adres obiektu', type: 'text', required: true },
      { name: 'opis_robot', label: 'Opis wykonanych robót', type: 'textarea', required: true },
      { name: 'kwota', label: 'Wartość robót (PLN)', type: 'number', required: true },
      { name: 'data_wykonania', label: 'Data wykonania robót', type: 'date', required: true },
      { name: 'data', label: 'Data odbioru', type: 'date', required: true },
      { name: 'uwagi', label: 'Uwagi i zastrzeżenia', type: 'textarea' },
    ],
    content: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #333;">

<h1 style="text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 8px;">PROTOKÓŁ ODBIORU ROBÓT</h1>
<p style="text-align: center; color: #666; margin-bottom: 32px;">sporządzony dnia {{data}}</p>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
  <div style="padding: 16px; background: #f9f9f9; border-radius: 8px;">
    <p style="margin: 0 0 4px; font-size: 12px; color: #666; font-weight: bold;">WYKONAWCA</p>
    <p style="margin: 0; font-size: 15px; font-weight: bold;">{{firma_nazwa}}</p>
  </div>
  <div style="padding: 16px; background: #f9f9f9; border-radius: 8px;">
    <p style="margin: 0 0 4px; font-size: 12px; color: #666; font-weight: bold;">ZAMAWIAJĄCY</p>
    <p style="margin: 0; font-size: 15px; font-weight: bold;">{{kontrahent_nazwa}}</p>
  </div>
</div>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">1. DANE OBIEKTU</h2>
<p>Adres obiektu: <strong>{{adres_obiektu}}</strong><br>
Data wykonania robót: <strong>{{data_wykonania}}</strong></p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">2. ZAKRES WYKONANYCH ROBÓT</h2>
<p style="padding: 12px; background: #f9f9f9; border-left: 3px solid #ccc; margin: 12px 0;">{{opis_robot}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">3. WARTOŚĆ ROBÓT</h2>
<p>Łączna wartość wykonanych robót: <strong>{{kwota}} PLN brutto</strong></p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">4. UWAGI I ZASTRZEŻENIA</h2>
<p style="padding: 12px; background: #fff8f0; border-left: 3px solid #f59e0b; margin: 12px 0; min-height: 60px;">{{uwagi}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">5. WYNIK ODBIORU</h2>
<p>Roboty zostają przyjęte / przyjęte warunkowo / odrzucone* <em>(*niepotrzebne skreślić)</em></p>

<div style="display: flex; justify-content: space-between; margin-top: 60px; gap: 40px;">
  <div style="flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Wykonawca</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{firma_nazwa}}</p>
  </div>
  <div style="flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Zamawiający</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{kontrahent_nazwa}}</p>
  </div>
</div>
</div>`
  },
  {
    id: 'protokol_przekazania',
    name: 'Protokół przekazania obiektu',
    category: 'Protokoły',
    description: 'Protokół przekazania/przejęcia obiektu lub terenu',
    variables: [
      { name: 'firma_nazwa', label: 'Nazwa firmy (Przekazujący)', type: 'text', required: true },
      { name: 'kontrahent_nazwa', label: 'Nazwa Przejmującego', type: 'text', required: true },
      { name: 'adres_obiektu', label: 'Adres obiektu', type: 'text', required: true },
      { name: 'opis_obiektu', label: 'Opis przekazywanego obiektu/terenu', type: 'textarea', required: true },
      { name: 'stan_techniczny', label: 'Stan techniczny', type: 'textarea', required: true },
      { name: 'data', label: 'Data przekazania', type: 'date', required: true },
    ],
    content: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #333;">

<h1 style="text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 8px;">PROTOKÓŁ PRZEKAZANIA OBIEKTU</h1>
<p style="text-align: center; color: #666; margin-bottom: 32px;">sporządzony dnia {{data}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 1. STRONY</h2>
<p><strong>Przekazujący:</strong> {{firma_nazwa}}</p>
<p><strong>Przejmujący:</strong> {{kontrahent_nazwa}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 2. PRZEDMIOT PRZEKAZANIA</h2>
<p>Adres obiektu: <strong>{{adres_obiektu}}</strong></p>
<p style="padding: 12px; background: #f9f9f9; border-left: 3px solid #ccc; margin: 12px 0;">{{opis_obiektu}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 3. STAN TECHNICZNY</h2>
<p style="padding: 12px; background: #f9f9f9; border-left: 3px solid #ccc; margin: 12px 0;">{{stan_techniczny}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px;">§ 4. POTWIERDZENIE</h2>
<p>Przekazujący oświadcza, że przekazuje obiekt/teren w opisanym stanie. Przejmujący potwierdza odbiór.</p>

<div style="display: flex; justify-content: space-between; margin-top: 60px; gap: 40px;">
  <div style="flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Przekazujący</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{firma_nazwa}}</p>
  </div>
  <div style="flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Przejmujący</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{kontrahent_nazwa}}</p>
  </div>
</div>
</div>`
  },
  {
    id: 'pelnomocnictwo',
    name: 'Pełnomocnictwo',
    category: 'Inne',
    description: 'Pełnomocnictwo do działania w imieniu firmy',
    variables: [
      { name: 'firma_nazwa', label: 'Nazwa firmy (Mocodawca)', type: 'text', required: true },
      { name: 'firma_nip', label: 'NIP firmy', type: 'text', required: true },
      { name: 'reprezentant', label: 'Imię i nazwisko reprezentanta firmy', type: 'text', required: true },
      { name: 'pelnomocnik', label: 'Imię i nazwisko Pełnomocnika', type: 'text', required: true },
      { name: 'pesel_pelnomocnika', label: 'PESEL Pełnomocnika', type: 'text' },
      { name: 'zakres', label: 'Zakres pełnomocnictwa', type: 'textarea', required: true },
      { name: 'data', label: 'Data udzielenia', type: 'date', required: true },
      { name: 'miejsce', label: 'Miejsce udzielenia', type: 'text', required: true },
    ],
    content: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #333;">

<h1 style="text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 8px;">PEŁNOMOCNICTWO</h1>
<p style="text-align: center; color: #666; margin-bottom: 32px;">udzielone dnia {{data}} w {{miejsce}}</p>

<p>Ja, niżej podpisany/-a, działając jako przedstawiciel/-ka spółki <strong>{{firma_nazwa}}</strong>, NIP: <strong>{{firma_nip}}</strong>,</p>

<p style="margin: 20px 0;">niniejszym udzielam pełnomocnictwa</p>

<div style="padding: 16px; background: #f0f4ff; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0; font-size: 16px; font-weight: bold;">{{pelnomocnik}}</p>
  <p style="margin: 4px 0 0; color: #666;">PESEL: {{pesel_pelnomocnika}}</p>
</div>

<p>do następujących działań w moim imieniu / imieniu spółki:</p>
<p style="padding: 12px; background: #f9f9f9; border-left: 3px solid #ccc; margin: 12px 0;">{{zakres}}</p>

<p>Pełnomocnictwo jest ważne do odwołania.</p>

<div style="margin-top: 60px; max-width: 300px; margin-left: auto; text-align: center;">
  <div style="border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Mocodawca</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{reprezentant}}</p>
    <p style="margin: 0; font-size: 12px; color: #666;">{{firma_nazwa}}</p>
  </div>
</div>
</div>`
  },
  {
    id: 'oswiadczenie',
    name: 'Oświadczenie',
    category: 'Inne',
    description: 'Ogólne oświadczenie / deklaracja',
    variables: [
      { name: 'firma_nazwa', label: 'Nazwa firmy', type: 'text', required: true },
      { name: 'kontrahent_nazwa', label: 'Imię i nazwisko / Nazwa oświadczającego', type: 'text', required: true },
      { name: 'tytul', label: 'Tytuł oświadczenia', type: 'text', required: true },
      { name: 'tresc', label: 'Treść oświadczenia', type: 'textarea', required: true },
      { name: 'data', label: 'Data', type: 'date', required: true },
      { name: 'miejsce', label: 'Miejsce', type: 'text', required: true },
    ],
    content: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #333;">

<h1 style="text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 8px;">OŚWIADCZENIE</h1>
<h2 style="text-align: center; font-size: 16px; font-weight: normal; color: #555; margin-bottom: 32px;">{{tytul}}</h2>

<p>{{miejsce}}, dnia {{data}}</p>

<div style="padding: 16px; background: #f9f9f9; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0; font-weight: bold;">{{kontrahent_nazwa}}</p>
</div>

<p>Niniejszym oświadczam, że:</p>
<p style="padding: 12px 16px; border-left: 4px solid #3b82f6; background: #eff6ff; margin: 16px 0; white-space: pre-wrap;">{{tresc}}</p>

<div style="margin-top: 60px; max-width: 300px; margin-left: auto; text-align: center;">
  <div style="border-top: 1px solid #333; padding-top: 8px;">
    <p style="margin: 0; font-size: 13px;"><strong>Podpis</strong></p>
    <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{kontrahent_nazwa}}</p>
  </div>
</div>
</div>`
  }
,
  {
    id: 'umowa_o_prace',
    name: 'Umowa o pracę',
    category: 'Umowy',
    description: 'Umowa o pracę na czas określony lub nieokreślony',
    variables: [
      { name: 'firma_nazwa', label: 'Nazwa pracodawcy', type: 'text', required: true },
      { name: 'firma_nip', label: 'NIP pracodawcy', type: 'text', required: true },
      { name: 'firma_adres', label: 'Adres pracodawcy', type: 'text', required: true },
      { name: 'firma_reprezentant', label: 'Reprezentant pracodawcy', type: 'text', required: true },
      { name: 'pracownik_imie_nazwisko', label: 'Imię i nazwisko pracownika', type: 'text', required: true },
      { name: 'pracownik_pesel', label: 'PESEL pracownika', type: 'text', required: true },
      { name: 'pracownik_adres', label: 'Adres pracownika', type: 'text', required: true },
      { name: 'stanowisko', label: 'Stanowisko / Rodzaj pracy', type: 'text', required: true },
      { name: 'miejsce_pracy', label: 'Miejsce wykonywania pracy', type: 'text', required: true },
      { name: 'wymiar_czasu', label: 'Wymiar czasu pracy', type: 'text', required: true },
      { name: 'wynagrodzenie', label: 'Wynagrodzenie zasadnicze (PLN brutto)', type: 'number', required: true },
      { name: 'data_od', label: 'Data zatrudnienia od', type: 'date', required: true },
      { name: 'data_do', label: 'Data zatrudnienia do (puste = nieokreślony)', type: 'date', required: false },
      { name: 'rodzaj_umowy', label: 'Rodzaj umowy (czas określony/nieokreślony)', type: 'text', required: true },
      { name: 'data', label: 'Data zawarcia umowy', type: 'date', required: true },
      { name: 'miejsce', label: 'Miejsce zawarcia umowy', type: 'text', required: true },
    ],
    content: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.7; color: #333;">

<h1 style="text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 4px;">UMOWA O PRACĘ</h1>
<p style="text-align: center; font-size: 14px; color: #666; margin-bottom: 8px;">na {{rodzaj_umowy}}</p>
<p style="text-align: center; color: #666; margin-bottom: 32px;">zawarta dnia {{data}} w {{miejsce}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: #1a1a1a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">§ 1. STRONY UMOWY</h2>
<p><strong>Pracodawca:</strong><br>
{{firma_nazwa}}, NIP: {{firma_nip}}<br>
{{firma_adres}}<br>
reprezentowany przez: {{firma_reprezentant}}</p>
<p style="margin-top: 12px;"><strong>Pracownik:</strong><br>
{{pracownik_imie_nazwisko}}, PESEL: {{pracownik_pesel}}<br>
{{pracownik_adres}}</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: #1a1a1a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">§ 2. WARUNKI ZATRUDNIENIA</h2>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <tr style="background: #f8f9fa;">
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold; width: 40%;">Rodzaj umówionej pracy:</td>
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">{{stanowisko}}</td>
  </tr>
  <tr>
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold;">Miejsce wykonywania pracy:</td>
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">{{miejsce_pracy}}</td>
  </tr>
  <tr style="background: #f8f9fa;">
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold;">Wymiar czasu pracy:</td>
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">{{wymiar_czasu}}</td>
  </tr>
  <tr>
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold;">Termin rozpoczęcia pracy:</td>
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">{{data_od}}</td>
  </tr>
  <tr style="background: #f8f9fa;">
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: bold;">Termin zakończenia umowy:</td>
    <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">{{data_do}}</td>
  </tr>
</table>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: #1a1a1a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">§ 3. WYNAGRODZENIE</h2>
<p>Pracownikowi przysługuje wynagrodzenie zasadnicze w wysokości: <strong>{{wynagrodzenie}} PLN brutto</strong> miesięcznie.</p>
<p>Wynagrodzenie będzie wypłacane do ostatniego dnia każdego miesiąca, przelewem na rachunek bankowy wskazany przez Pracownika.</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: #1a1a1a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">§ 4. OBOWIĄZKI PRACOWNIKA</h2>
<p>Pracownik zobowiązuje się do:</p>
<ul style="margin: 8px 0 8px 24px;">
  <li>sumiennego i starannego wykonywania powierzonych obowiązków,</li>
  <li>przestrzegania regulaminu pracy i przepisów BHP,</li>
  <li>dbałości o dobro zakładu pracy i zachowania jego tajemnicy,</li>
  <li>przestrzegania zasad współżycia społecznego w zakładzie pracy.</li>
</ul>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: #1a1a1a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">§ 5. URLOP WYPOCZYNKOWY</h2>
<p>Pracownikowi przysługuje urlop wypoczynkowy w wymiarze określonym przez Kodeks Pracy (20 lub 26 dni roboczych rocznie, w zależności od stażu pracy).</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: #1a1a1a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">§ 6. OKRES WYPOWIEDZENIA</h2>
<p>Okres wypowiedzenia niniejszej umowy wynosi odpowiednio: 2 tygodnie (staż pracy poniżej 6 miesięcy), 1 miesiąc (staż pracy powyżej 6 miesięcy), 3 miesiące (staż pracy co najmniej 3 lata).</p>

<h2 style="font-size: 16px; margin-top: 24px; margin-bottom: 8px; color: #1a1a1a; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">§ 7. POSTANOWIENIA KOŃCOWE</h2>
<p>W sprawach nieuregulowanych niniejszą umową mają zastosowanie przepisy Kodeksu Pracy i Kodeksu Cywilnego. Wszelkie zmiany umowy wymagają formy pisemnej pod rygorem nieważności. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron.</p>

<p style="margin-top: 12px; font-size: 12px; color: #999; border-top: 1px dashed #e0e0e0; padding-top: 8px;">
  Klauzula informacyjna RODO: Administratorem danych osobowych jest {{firma_nazwa}}. Dane przetwarzane są na podstawie art. 6 ust. 1 lit. b) RODO w celu realizacji umowy o pracę.
</p>

<div style="display: flex; justify-content: space-between; margin-top: 60px; gap: 40px;">
  <div style="flex: 1; text-align: center;">
    <div style="border-top: 1px solid #333; padding-top: 8px;">
      <p style="margin: 0; font-size: 13px;"><strong>Pracodawca</strong></p>
      <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{firma_nazwa}}</p>
    </div>
  </div>
  <div style="flex: 1; text-align: center;">
    <div style="border-top: 1px solid #333; padding-top: 8px;">
      <p style="margin: 0; font-size: 13px;"><strong>Pracownik</strong></p>
      <p style="margin: 4px 0 0; font-size: 12px; color: #666;">{{pracownik_imie_nazwisko}}</p>
    </div>
  </div>
</div>
</div>`
  }
];
