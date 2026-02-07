import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft, Save, FileSpreadsheet, Calculator, ChevronDown, ChevronRight,
  Loader2, AlertCircle, CheckCircle2, Info, X, RefreshCw, Settings,
  Download, Upload, Eye, HelpCircle, Zap
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  KosztorysRequest, KosztorysForm, KosztorysFormGeneralData,
  KosztorysFormAnswer, KosztorysFormType, KosztorysRoomGroup,
  KosztorysWorkCategory, KosztorysFormTemplate
} from '../../types';

// Form templates based on document analysis
const FORM_TEMPLATES: Record<KosztorysFormType, KosztorysFormTemplate> = {
  'MIESZK-IE': {
    form_type: 'MIESZK-IE',
    title: 'FORMULARZ WYKONYWANYCH PRAC - MIESZKANIA I BIUROWCE - IE',
    general_fields: [
      { code: 'apartments_count', label: 'Ilość mieszkań / powierzchnia', type: 'text', required: true, placeholder: 'np. 120 mieszkań, 8500 m²' },
      { code: 'ext_wall_type', label: 'Rodzaj ścian zewnętrznych', type: 'text', required: true, placeholder: 'np. Cegła ceramiczna' },
      { code: 'int_wall_type', label: 'Rodzaj ścian wewnętrznych', type: 'text', required: true, placeholder: 'np. Gipskarton' },
      { code: 'ceiling_height', label: 'Wysokość sufitu (m)', type: 'decimal', required: true, placeholder: '2.80' },
      { code: 'consumable_material', label: 'Materiał eksploatacyjny', type: 'text', required: false, placeholder: 'Standard' }
    ],
    room_groups: [
      {
        code: 'UZIOM', name: 'Uziom',
        rooms: [
          { code: 'UZIOM_FUND', name: 'Uziom fundamentowy' }
        ]
      },
      {
        code: 'GARAZ', name: 'Garaż podziemny',
        rooms: [
          { code: 'GARAZ_OSW_PODST', name: 'Oświetlenie podstawowe' },
          { code: 'GARAZ_OSW_EWAK', name: 'Oświetlenie ewakuacyjne' },
          { code: 'GARAZ_OSW_AWAR', name: 'Oświetlenie awaryjne' },
          { code: 'GARAZ_WYLACZ', name: 'Wyłączniki' },
          { code: 'GARAZ_GNIAZDA', name: 'Gniazda' },
          { code: 'GARAZ_GNIAZDA_SIL', name: 'Gniazda siłowe' },
          { code: 'GARAZ_LADOW', name: 'Stacje ładowania EV' },
          { code: 'GARAZ_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'GARAZ_WENT', name: 'Wentylacja' },
          { code: 'GARAZ_CZUJNIKI', name: 'Czujniki ruchu/obecności' },
          { code: 'GARAZ_BRAMY', name: 'Bramy' },
          { code: 'GARAZ_TRASY', name: 'Trasy kablowe' },
          { code: 'GARAZ_PPOZ', name: 'Ochrona przeciwpożarowa' }
        ]
      },
      {
        code: 'KOMORE', name: 'Komórki lokatorskie',
        rooms: [
          { code: 'KOMORE_OSW', name: 'Oświetlenie podstawowe' },
          { code: 'KOMORE_OSW_AWAR', name: 'Oświetlenie awaryjne' },
          { code: 'KOMORE_WYLACZ', name: 'Wyłączniki' }
        ]
      },
      {
        code: 'TECH', name: 'Pomieszczenia techniczne',
        rooms: [
          { code: 'TECH_OSW', name: 'Oświetlenie podstawowe' },
          { code: 'TECH_OSW_AWAR', name: 'Oświetlenie awaryjne' },
          { code: 'TECH_WYLACZ', name: 'Wyłączniki' },
          { code: 'TECH_GNIAZDA', name: 'Gniazda' },
          { code: 'TECH_GNIAZDA_SIL', name: 'Gniazda siłowe' },
          { code: 'TECH_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'TECH_ROZD_SN', name: 'Rozdzielnia SN' },
          { code: 'TECH_ROZD_GRN', name: 'Rozdzielnia GRN' },
          { code: 'TECH_TRAFO', name: 'Stacja transformatorowa' },
          { code: 'TECH_TELE', name: 'Zasilanie szaf teletechnicznych' },
          { code: 'TECH_WENT', name: 'Wentylacja' },
          { code: 'TECH_KLIMA', name: 'Klimatyzacja' },
          { code: 'TECH_HYDRO', name: 'Zasilanie hydroforu' },
          { code: 'TECH_POMPY', name: 'Zasilanie pomp' },
          { code: 'TECH_CIEPLO', name: 'Zasilanie węzła cieplnego' },
          { code: 'TECH_UZIEMY', name: 'Punkty uziemienia' },
          { code: 'TECH_WLZ', name: 'Zasilanie pomieszczenia (WLZ)' },
          { code: 'TECH_STER', name: 'Zasilanie sterowania' },
          { code: 'TECH_WYROWNAW', name: 'Szyna wyrównawcza' },
          { code: 'TECH_ZK', name: 'Zasilanie od ZK' },
          { code: 'TECH_TRASY', name: 'Trasy kablowe' },
          { code: 'TECH_PPOZ', name: 'Zabezpieczenie ppoż.' }
        ]
      },
      {
        code: 'KLATKI', name: 'Klatki schodowe',
        rooms: [
          { code: 'KLATKI_OSW', name: 'Oświetlenie podstawowe' },
          { code: 'KLATKI_OSW_AWAR', name: 'Oświetlenie awaryjne' },
          { code: 'KLATKI_OSW_EWAK', name: 'Oświetlenie ewakuacyjne' },
          { code: 'KLATKI_WYLACZ', name: 'Wyłączniki' },
          { code: 'KLATKI_GNIAZDA', name: 'Gniazda' },
          { code: 'KLATKI_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'KLATKI_CZUJNIKI', name: 'Czujniki ruchu' },
          { code: 'KLATKI_WENT', name: 'Wentylacja' }
        ]
      },
      {
        code: 'WINDA', name: 'Winda',
        rooms: [
          { code: 'WINDA_OSW', name: 'Oświetlenie' },
          { code: 'WINDA_ZASIL', name: 'Zasilanie windy' }
        ]
      },
      {
        code: 'SZYBY', name: 'Szyby instalacyjne',
        rooms: [
          { code: 'SZYBY_GNIAZDA', name: 'Gniazda serwisowe' },
          { code: 'SZYBY_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'SZYBY_UZIEMY', name: 'Punkty uziemienia' },
          { code: 'SZYBY_TRASY', name: 'Trasy kablowe' }
        ]
      },
      {
        code: 'KORYT', name: 'Korytarze',
        rooms: [
          { code: 'KORYT_OSW', name: 'Oświetlenie podstawowe' },
          { code: 'KORYT_OSW_AWAR', name: 'Oświetlenie awaryjne' },
          { code: 'KORYT_OSW_EWAK', name: 'Oświetlenie ewakuacyjne' },
          { code: 'KORYT_WYLACZ', name: 'Wyłączniki' },
          { code: 'KORYT_GNIAZDA', name: 'Gniazda' },
          { code: 'KORYT_CZUJNIKI', name: 'Czujniki ruchu' },
          { code: 'KORYT_WENT', name: 'Wentylacja' },
          { code: 'KORYT_STER', name: 'Zasilanie sterowania' },
          { code: 'KORYT_TRASY', name: 'Trasy kablowe' }
        ]
      },
      {
        code: 'MIESZK', name: 'Mieszkania',
        rooms: [
          { code: 'MIESZK_OSW', name: 'Oświetlenie' },
          { code: 'MIESZK_WYLACZ', name: 'Wyłączniki' },
          { code: 'MIESZK_GNIAZDA', name: 'Gniazda' },
          { code: 'MIESZK_STER', name: 'Punkty sterowania' },
          { code: 'MIESZK_DZWONEK', name: 'Przycisk dzwonka' },
          { code: 'MIESZK_ROLETY', name: 'Rolety' },
          { code: 'MIESZK_TM', name: 'Tablica mieszkaniowa (TM)' },
          { code: 'MIESZK_OGRZEW', name: 'Zasilanie ogrzewania' },
          { code: 'MIESZK_UZIEMY', name: 'Punkty uziemienia' },
          { code: 'MIESZK_WLZ', name: 'Zasilanie mieszkania (WLZ)' },
          { code: 'MIESZK_TT', name: 'Zasilanie tablicy teletechnicznej (TT)' },
          { code: 'MIESZK_WENT', name: 'Wentylacja' },
          { code: 'MIESZK_INDUK', name: 'Płyta indukcyjna' },
          { code: 'MIESZK_WYPUST', name: 'Wypust zasilania' }
        ]
      },
      {
        code: 'DACH', name: 'Dach',
        rooms: [
          { code: 'DACH_ZMIERZCH', name: 'Czujnik zmierzchowy' },
          { code: 'DACH_KLIMA', name: 'Klimatyzacja' },
          { code: 'DACH_WENT', name: 'Wentylacja dachowa' },
          { code: 'DACH_GRZALKI', name: 'Zasilanie grzałek' },
          { code: 'DACH_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'DACH_UZIEMY', name: 'Punkty uziemienia' },
          { code: 'DACH_TRASY', name: 'Trasy kablowe' },
          { code: 'DACH_WYPUST', name: 'Wypust dachowy' }
        ]
      },
      {
        code: 'PIORUN', name: 'Instalacja odgromowa',
        rooms: [
          { code: 'PIORUN_ZWODY_PION', name: 'Zwody pionowe' },
          { code: 'PIORUN_ZWODY_POZ', name: 'Zwody poziome' },
          { code: 'PIORUN_MASZTY', name: 'Maszty odgromowe' },
          { code: 'PIORUN_IGLY', name: 'Igły' },
          { code: 'PIORUN_SKRZYNKI', name: 'Skrzynki połączeniowe' }
        ]
      },
      {
        code: 'PZT', name: 'Tereny zewnętrzne (PZT)',
        rooms: [
          { code: 'PZT_OPRAWY', name: 'Oprawy naścienne' },
          { code: 'PZT_SLUPKI', name: 'Słupki oświetleniowe' },
          { code: 'PZT_ZMIERZCH', name: 'Czujnik zmierzchowy' },
          { code: 'PZT_LATARNIE', name: 'Latarnie' },
          { code: 'PZT_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'PZT_KANALIZ', name: 'Kanalizacja kablowa' },
          { code: 'PZT_STUDZIENKI', name: 'Studzienki kablowe' },
          { code: 'PZT_STER', name: 'Punkt sterowania' },
          { code: 'PZT_PWP', name: 'PWP' },
          { code: 'PZT_LADOW', name: 'Stacja ładowania' },
          { code: 'PZT_SZLABAN', name: 'Szlaban/brama' },
          { code: 'PZT_FUNDAM', name: 'Fundamenty pod słupy' }
        ]
      }
    ],
    work_categories: [
      {
        code: 'PRZYG', name: 'Przygotowanie',
        work_types: [
          { code: 'BRUZD', name: 'Bruzdowanie', description: 'Wykonanie bruzd w ścianach pod instalację' },
          { code: 'BRUZD_WYK', name: 'Wykończenie bruzd', description: 'Zakrycie i wyrównanie bruzd po montażu' },
          { code: 'OKAB_STROP', name: 'Okablowanie w stropie', description: 'Prowadzenie kabli w stropie' },
          { code: 'PRZEWIERTY', name: 'Wykonanie przewiertów', description: 'Przebicia w ścianach i stropach' },
          { code: 'MAT_GLOWNY', name: 'Materiał główny', description: 'Podstawowy materiał instalacyjny' },
          { code: 'MAT_DROBNY', name: 'Materiał drobny', description: 'Materiały pomocnicze' }
        ]
      },
      {
        code: 'TRASY', name: 'Montaż tras kablowych',
        work_types: [
          { code: 'UCHW_DED', name: 'Uchwyt dedykowany', description: 'Montaż uchwytów specjalizowanych' },
          { code: 'UCHW_NDED', name: 'Uchwyt niededykowany', description: 'Montaż uchwytów uniwersalnych' },
          { code: 'KORYT_SCIANA', name: 'Mocowanie koryt do ściany', description: 'Montaż koryt na ścianie' },
          { code: 'KORYT_SUFIT', name: 'Mocowanie koryt do sufitu', description: 'Montaż koryt na suficie' },
          { code: 'WIESZAK_BLACHA', name: 'Mocowanie wieszaków do blach', description: 'Montaż na blachach profilowanych' },
          { code: 'SZPILKA', name: 'Szpilka', description: 'Montaż szpilek montażowych' },
          { code: 'LINKA', name: 'Linka', description: 'Montaż na linkach' },
          { code: 'CEOWNIK', name: 'Ceownik', description: 'Montaż ceowników' },
          { code: 'LACZN_DED', name: 'Łączniki dedykowane', description: 'Łączniki specjalizowane' },
          { code: 'LACZN_NDED', name: 'Łączniki niededykowane', description: 'Łączniki uniwersalne' },
          { code: 'POKRYWY', name: 'Pokrywy', description: 'Montaż pokryw koryt' },
          { code: 'OSTREKRAW', name: 'Zabezpieczenie ostrych krawędzi', description: 'Ochrona kabli' },
          { code: 'OCYNK', name: 'Ocynkowanie ciętych elementów', description: 'Zabezpieczenie antykorozyjne' }
        ]
      },
      {
        code: 'OKAB', name: 'Okablowanie',
        work_types: [
          { code: 'OKAB_MAT_GL', name: 'Materiał główny', description: 'Kable i przewody' },
          { code: 'OKAB_MAT_DR', name: 'Materiał drobny', description: 'Materiały pomocnicze' },
          { code: 'OKAB_PODTYNK', name: 'Podtynkowe', description: 'Prowadzenie kabli podtynkowo' },
          { code: 'OKAB_NATYNK', name: 'Natynkowe', description: 'Prowadzenie kabli natynkowo' },
          { code: 'OKAB_UCHWYT', name: 'Na uchwytach', description: 'Prowadzenie na uchwytach' },
          { code: 'OKAB_TRASY', name: 'Po trasach kablowych', description: 'Prowadzenie w korytach' },
          { code: 'OKAB_RURKI', name: 'W rurkach/gofra', description: 'Prowadzenie w rurkach ochronnych' },
          { code: 'OKAB_SCIANA', name: 'Po ścianie', description: 'Prowadzenie wzdłuż ściany' },
          { code: 'OKAB_SUFIT', name: 'Po suficie', description: 'Prowadzenie wzdłuż sufitu' },
          { code: 'OKAB_PODLOGA', name: 'Po podłodze', description: 'Prowadzenie w podłodze' }
        ]
      },
      {
        code: 'MONT', name: 'Montaż odbiorników',
        work_types: [
          { code: 'MONT_MAT_GL', name: 'Materiał główny', description: 'Urządzenia i osprzęt' },
          { code: 'MONT_MAT_DR', name: 'Materiał drobny', description: 'Materiały montażowe' },
          { code: 'MONT_ROZD_NAT', name: 'Rozdzielnia natynkowa', description: 'Montaż rozdzielnicy natynkowej' },
          { code: 'MONT_ROZD_POD', name: 'Rozdzielnia podtynkowa', description: 'Montaż rozdzielnicy podtynkowej' },
          { code: 'MONT_PREFAB', name: 'Prefabrykacja', description: 'Przygotowanie i montaż prefabrykatów' },
          { code: 'MONT_KLEMY', name: 'Klemy/Wago/Keystone', description: 'Montaż złączek i terminali' },
          { code: 'MONT_PUSZKA', name: 'Montaż puszki', description: 'Instalacja puszek połączeniowych' },
          { code: 'MONT_MOCOW', name: 'Mocowanie', description: 'Różne typy mocowań' },
          { code: 'MONT_URZ_NAT', name: 'Urządzenie natynkowe', description: 'Montaż urządzeń natynkowych' },
          { code: 'MONT_URZ_POD', name: 'Urządzenie podtynkowe', description: 'Montaż urządzeń podtynkowych' }
        ]
      },
      {
        code: 'URUCH', name: 'Uruchomienie',
        work_types: [
          { code: 'URUCH_MAT_GL', name: 'Materiał główny', description: 'Materiały do uruchomienia' },
          { code: 'URUCH_MAT_DR', name: 'Materiał drobny', description: 'Materiały pomocnicze' },
          { code: 'URUCH_PODLACZ', name: 'Podłączenie do sieci', description: 'Podłączenie instalacji do zasilania' },
          { code: 'URUCH_PROGR', name: 'Programowanie/Konfiguracja', description: 'Ustawienia i konfiguracja systemów' },
          { code: 'URUCH_POMIARY', name: 'Pomiary', description: 'Pomiary elektryczne' },
          { code: 'URUCH_DOKUM', name: 'Dokumentacja powykonawcza', description: 'Przygotowanie dokumentacji' }
        ]
      },
      {
        code: 'ZEWN', name: 'Prace zewnętrzne',
        work_types: [
          { code: 'ZEWN_MAT_GL', name: 'Materiał główny', description: 'Materiały do prac zewnętrznych' },
          { code: 'ZEWN_MAT_DR', name: 'Materiał drobny', description: 'Materiały pomocnicze' },
          { code: 'ZEWN_WYKOP', name: 'Wykonanie wykopu', description: 'Roboty ziemne - wykop' },
          { code: 'ZEWN_PODLOZE', name: 'Przygotowanie podłoża', description: 'Przygotowanie podłoża pod kable' },
          { code: 'ZEWN_ZASYPKA', name: 'Zasypka', description: 'Zasypanie wykopów' },
          { code: 'ZEWN_NAWIERZCH', name: 'Odtworzenie nawierzchni', description: 'Przywrócenie nawierzchni' },
          { code: 'ZEWN_TRAWNIK', name: 'Odtworzenie trawnika', description: 'Przywrócenie trawnika' },
          { code: 'ZEWN_USZCZELN', name: 'Uszczelnienie gazowo-wodne', description: 'Uszczelnienie przejść' }
        ]
      },
      {
        code: 'SPRZET', name: 'Sprzęt/Narzędzia',
        work_types: [
          { code: 'SPRZET_MASZ', name: 'Maszyny budowlane', description: 'Wynajem maszyn' },
          { code: 'SPRZET_SPRZET', name: 'Sprzęt budowlany', description: 'Wynajem sprzętu' }
        ]
      }
    ]
  },
  'MIESZK-IT': {
    form_type: 'MIESZK-IT',
    title: 'FORMULARZ WYKONYWANYCH PRAC - MIESZKANIA I BIUROWCE - IT',
    general_fields: [
      { code: 'apartments_count', label: 'Ilość mieszkań / powierzchnia', type: 'text', required: true, placeholder: 'np. 120 mieszkań, 8500 m²' },
      { code: 'ext_wall_type', label: 'Rodzaj ścian zewnętrznych', type: 'text', required: true, placeholder: 'np. Cegła ceramiczna' },
      { code: 'int_wall_type', label: 'Rodzaj ścian wewnętrznych', type: 'text', required: true, placeholder: 'np. Gipskarton' },
      { code: 'ceiling_height', label: 'Wysokość sufitu (m)', type: 'decimal', required: true, placeholder: '2.80' },
      { code: 'consumable_material', label: 'Materiał eksploatacyjny', type: 'text', required: false, placeholder: 'Standard' }
    ],
    room_groups: [
      {
        code: 'GARAZ_IT', name: 'Garaż podziemny',
        rooms: [
          { code: 'GARAZ_IT_SAP', name: 'SAP (System alarmu pożarowego)' },
          { code: 'GARAZ_IT_SSO', name: 'SSO (System sygnalizacji optycznej)' },
          { code: 'GARAZ_IT_DSO', name: 'DSO (Dźwiękowy system ostrzegawczy)' },
          { code: 'GARAZ_IT_SSWIN', name: 'SSWiN (System antywłamaniowy)' },
          { code: 'GARAZ_IT_CCTV', name: 'CCTV (Monitoring)' },
          { code: 'GARAZ_IT_KD', name: 'KD (Kontrola dostępu)' },
          { code: 'GARAZ_IT_DOMOF', name: 'Domofon' },
          { code: 'GARAZ_IT_BMS', name: 'BMS' },
          { code: 'GARAZ_IT_SDG', name: 'SDG (Detekcja gazu)' }
        ]
      },
      {
        code: 'TECH_IT', name: 'Pomieszczenia techniczne',
        rooms: [
          { code: 'TECH_IT_SAP', name: 'SAP' },
          { code: 'TECH_IT_SSO', name: 'SSO' },
          { code: 'TECH_IT_DSO', name: 'DSO' },
          { code: 'TECH_IT_SSWIN', name: 'SSWiN' },
          { code: 'TECH_IT_CCTV', name: 'CCTV' },
          { code: 'TECH_IT_KD', name: 'KD' },
          { code: 'TECH_IT_DOMOF', name: 'Domofon' },
          { code: 'TECH_IT_BMS', name: 'BMS' },
          { code: 'TECH_IT_RTV', name: 'RTV i SAT' },
          { code: 'TECH_IT_RACK', name: 'Szafa RACK' }
        ]
      },
      {
        code: 'KLATKI_IT', name: 'Klatki schodowe',
        rooms: [
          { code: 'KLATKI_IT_SAP', name: 'SAP' },
          { code: 'KLATKI_IT_SSO', name: 'SSO' },
          { code: 'KLATKI_IT_DSO', name: 'DSO' },
          { code: 'KLATKI_IT_ROP', name: 'ROP (Ręczny ostrzegacz pożarowy)' },
          { code: 'KLATKI_IT_CSP', name: 'CSP (Centrala sygnalizacji pożarowej)' },
          { code: 'KLATKI_IT_SSWIN', name: 'SSWiN' },
          { code: 'KLATKI_IT_CCTV', name: 'CCTV' },
          { code: 'KLATKI_IT_KD', name: 'KD' },
          { code: 'KLATKI_IT_DOMOF', name: 'Domofon' },
          { code: 'KLATKI_IT_BMS', name: 'BMS' }
        ]
      },
      {
        code: 'MIESZK_IT', name: 'Mieszkania',
        rooms: [
          { code: 'MIESZK_IT_RTV', name: 'RTV i SAT' },
          { code: 'MIESZK_IT_NET', name: 'Internet' },
          { code: 'MIESZK_IT_TEL', name: 'Telefonia' },
          { code: 'MIESZK_IT_DOMOF', name: 'Domofon' },
          { code: 'MIESZK_IT_BMS', name: 'BMS (Smart Home)' }
        ]
      }
    ],
    work_categories: [
      {
        code: 'PRZYG_IT', name: 'Przygotowanie',
        work_types: [
          { code: 'BRUZD_IT', name: 'Bruzdowanie', description: 'Wykonanie bruzd pod instalację teletechniczną' },
          { code: 'BRUZD_WYK_IT', name: 'Wykończenie bruzd', description: 'Zakrycie bruzd' },
          { code: 'PRZEWIERTY_IT', name: 'Wykonanie przewiertów', description: 'Przebicia dla kabli' },
          { code: 'MAT_GLOWNY_IT', name: 'Materiał główny', description: 'Kable i urządzenia' },
          { code: 'MAT_DROBNY_IT', name: 'Materiał drobny', description: 'Materiały pomocnicze' }
        ]
      },
      {
        code: 'TRASY_IT', name: 'Montaż tras kablowych',
        work_types: [
          { code: 'KORYT_IT', name: 'Koryta kablowe', description: 'Montaż koryt' },
          { code: 'RURKI_IT', name: 'Rurki i gofry', description: 'Montaż rur ochronnych' },
          { code: 'MOCOW_IT', name: 'Mocowania', description: 'Uchwyty i podpory' }
        ]
      },
      {
        code: 'OKAB_IT', name: 'Okablowanie',
        work_types: [
          { code: 'OKAB_UTP', name: 'Kable UTP/FTP', description: 'Prowadzenie kabli sieciowych' },
          { code: 'OKAB_KONC', name: 'Koncentryk', description: 'Prowadzenie kabli koncentrycznych' },
          { code: 'OKAB_SWIAT', name: 'Światłowód', description: 'Prowadzenie światłowodów' },
          { code: 'OKAB_ALARM', name: 'Kable alarmowe', description: 'Prowadzenie kabli systemów alarmowych' }
        ]
      },
      {
        code: 'MONT_IT', name: 'Montaż urządzeń',
        work_types: [
          { code: 'MONT_CZUJKI', name: 'Czujki', description: 'Montaż czujek pożarowych/ruchu' },
          { code: 'MONT_KAMERY', name: 'Kamery', description: 'Montaż kamer CCTV' },
          { code: 'MONT_CZYTNIKI', name: 'Czytniki KD', description: 'Montaż czytników dostępu' },
          { code: 'MONT_GLOSNIKI', name: 'Głośniki DSO', description: 'Montaż głośników' },
          { code: 'MONT_PANEL', name: 'Panel domofonu', description: 'Montaż paneli' },
          { code: 'MONT_GNIAZDKA', name: 'Gniazda RJ45', description: 'Montaż gniazd sieciowych' },
          { code: 'MONT_RACK', name: 'Szafa RACK', description: 'Montaż szaf teleinformatycznych' }
        ]
      },
      {
        code: 'URUCH_IT', name: 'Uruchomienie',
        work_types: [
          { code: 'URUCH_KONFIG', name: 'Konfiguracja', description: 'Konfiguracja systemów' },
          { code: 'URUCH_INTEGR', name: 'Integracja', description: 'Integracja systemów' },
          { code: 'URUCH_TESTY', name: 'Testy', description: 'Testowanie systemów' },
          { code: 'URUCH_DOKUM_IT', name: 'Dokumentacja', description: 'Dokumentacja powykonawcza' }
        ]
      }
    ]
  },
  'PREM-IE': {
    form_type: 'PREM-IE',
    title: 'FORMULARZ WYKONYWANYCH PRAC - PRZEMYSŁOWE - IE',
    general_fields: [
      { code: 'hall_area', label: 'Powierzchnia hali (m²)', type: 'decimal', required: true, placeholder: 'np. 5000' },
      { code: 'office_area', label: 'Powierzchnia biur (m²)', type: 'decimal', required: false, placeholder: 'np. 500' },
      { code: 'ext_wall_type', label: 'Rodzaj ścian zewnętrznych', type: 'text', required: true, placeholder: 'np. Płyty warstwowe' },
      { code: 'int_wall_type', label: 'Rodzaj ścian wewnętrznych', type: 'text', required: true, placeholder: 'np. Gipskarton' },
      { code: 'hall_ceiling_height', label: 'Wysokość sufitu hali (m)', type: 'decimal', required: true, placeholder: '8.00' },
      { code: 'office_ceiling_height', label: 'Wysokość sufitu biur (m)', type: 'decimal', required: false, placeholder: '3.00' },
      { code: 'consumable_material', label: 'Materiał eksploatacyjny', type: 'text', required: false, placeholder: 'Standard' }
    ],
    room_groups: [
      {
        code: 'HALA', name: 'Hala produkcyjna',
        rooms: [
          { code: 'HALA_OSW', name: 'Oświetlenie podstawowe' },
          { code: 'HALA_OSW_AWAR', name: 'Oświetlenie awaryjne' },
          { code: 'HALA_GNIAZDA', name: 'Gniazda' },
          { code: 'HALA_GNIAZDA_SIL', name: 'Gniazda siłowe' },
          { code: 'HALA_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'HALA_MASZYNY', name: 'Zasilanie maszyn' },
          { code: 'HALA_SUWNICA', name: 'Zasilanie suwnicy' },
          { code: 'HALA_WENT', name: 'Wentylacja' },
          { code: 'HALA_TRASY', name: 'Trasy kablowe' },
          { code: 'HALA_UZIEMY', name: 'Punkty uziemienia' }
        ]
      },
      {
        code: 'MAGAZYN', name: 'Magazyn',
        rooms: [
          { code: 'MAGAZYN_OSW', name: 'Oświetlenie' },
          { code: 'MAGAZYN_OSW_AWAR', name: 'Oświetlenie awaryjne' },
          { code: 'MAGAZYN_GNIAZDA', name: 'Gniazda' },
          { code: 'MAGAZYN_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'MAGAZYN_TRASY', name: 'Trasy kablowe' }
        ]
      },
      {
        code: 'BIURA_PREM', name: 'Biura',
        rooms: [
          { code: 'BIURA_OSW', name: 'Oświetlenie' },
          { code: 'BIURA_WYLACZ', name: 'Wyłączniki' },
          { code: 'BIURA_GNIAZDA', name: 'Gniazda' },
          { code: 'BIURA_ROZDZIELNIE', name: 'Rozdzielnie' },
          { code: 'BIURA_KLIMA', name: 'Klimatyzacja' }
        ]
      },
      {
        code: 'SOCJAL', name: 'Pomieszczenia socjalne',
        rooms: [
          { code: 'SOCJAL_OSW', name: 'Oświetlenie' },
          { code: 'SOCJAL_GNIAZDA', name: 'Gniazda' },
          { code: 'SOCJAL_BOJLER', name: 'Zasilanie bojlera' }
        ]
      }
    ],
    work_categories: [
      {
        code: 'PRZYG_PREM', name: 'Przygotowanie',
        work_types: [
          { code: 'BRUZD_PREM', name: 'Bruzdowanie', description: 'Wykonanie bruzd' },
          { code: 'PRZEWIERTY_PREM', name: 'Przewierty', description: 'Przebicia przez ściany' },
          { code: 'MAT_GLOWNY_PREM', name: 'Materiał główny', description: 'Podstawowe materiały' },
          { code: 'MAT_DROBNY_PREM', name: 'Materiał drobny', description: 'Materiały pomocnicze' }
        ]
      },
      {
        code: 'TRASY_PREM', name: 'Trasy kablowe',
        work_types: [
          { code: 'KORYT_DRABI', name: 'Koryta drabinkowe', description: 'Montaż koryt drabinkowych' },
          { code: 'KORYT_PERFOR', name: 'Koryta perforowane', description: 'Montaż koryt perforowanych' },
          { code: 'WIESZAKI', name: 'Wieszaki', description: 'Montaż wieszaków' },
          { code: 'PODPORY', name: 'Podpory', description: 'Montaż podpór' }
        ]
      },
      {
        code: 'OKAB_PREM', name: 'Okablowanie',
        work_types: [
          { code: 'OKAB_SILOWE', name: 'Kable siłowe', description: 'Prowadzenie kabli siłowych' },
          { code: 'OKAB_STEROW', name: 'Kable sterownicze', description: 'Prowadzenie kabli sterowniczych' },
          { code: 'OKAB_POTR', name: 'Po trasach', description: 'Prowadzenie w korytach' }
        ]
      },
      {
        code: 'MONT_PREM', name: 'Montaż',
        work_types: [
          { code: 'MONT_ROZD', name: 'Rozdzielnie', description: 'Montaż rozdzielnic' },
          { code: 'MONT_OPRAWY', name: 'Oprawy oświetleniowe', description: 'Montaż oświetlenia' },
          { code: 'MONT_GNIAZDA', name: 'Gniazda', description: 'Montaż gniazd' }
        ]
      },
      {
        code: 'URUCH_PREM', name: 'Uruchomienie',
        work_types: [
          { code: 'URUCH_PODL', name: 'Podłączenie', description: 'Podłączenie do sieci' },
          { code: 'URUCH_POM', name: 'Pomiary', description: 'Pomiary elektryczne' },
          { code: 'URUCH_DOK', name: 'Dokumentacja', description: 'Dokumentacja powykonawcza' }
        ]
      }
    ]
  },
  'PREM-IT': {
    form_type: 'PREM-IT',
    title: 'FORMULARZ WYKONYWANYCH PRAC - PRZEMYSŁOWE - IT',
    general_fields: [
      { code: 'hall_area', label: 'Powierzchnia hali (m²)', type: 'decimal', required: true, placeholder: 'np. 5000' },
      { code: 'office_area', label: 'Powierzchnia biur (m²)', type: 'decimal', required: false, placeholder: 'np. 500' },
      { code: 'ext_wall_type', label: 'Rodzaj ścian zewnętrznych', type: 'text', required: true, placeholder: 'np. Płyty warstwowe' },
      { code: 'int_wall_type', label: 'Rodzaj ścian wewnętrznych', type: 'text', required: true, placeholder: 'np. Gipskarton' },
      { code: 'hall_ceiling_height', label: 'Wysokość sufitu hali (m)', type: 'decimal', required: true, placeholder: '8.00' }
    ],
    room_groups: [
      {
        code: 'HALA_IT', name: 'Hala produkcyjna',
        rooms: [
          { code: 'HALA_IT_SAP', name: 'SAP' },
          { code: 'HALA_IT_DSO', name: 'DSO' },
          { code: 'HALA_IT_CCTV', name: 'CCTV' },
          { code: 'HALA_IT_KD', name: 'KD' },
          { code: 'HALA_IT_BMS', name: 'BMS' }
        ]
      },
      {
        code: 'BIURA_IT', name: 'Biura',
        rooms: [
          { code: 'BIURA_IT_NET', name: 'Sieć LAN' },
          { code: 'BIURA_IT_TEL', name: 'Telefonia' },
          { code: 'BIURA_IT_CCTV', name: 'CCTV' },
          { code: 'BIURA_IT_KD', name: 'KD' }
        ]
      }
    ],
    work_categories: [
      {
        code: 'OKAB_IT_PREM', name: 'Okablowanie',
        work_types: [
          { code: 'OKAB_UTP_PREM', name: 'Kable UTP', description: 'Prowadzenie kabli sieciowych' },
          { code: 'OKAB_SWIAT_PREM', name: 'Światłowody', description: 'Prowadzenie światłowodów' }
        ]
      },
      {
        code: 'MONT_IT_PREM', name: 'Montaż',
        work_types: [
          { code: 'MONT_CZUJKI_PREM', name: 'Czujki pożarowe', description: 'Montaż czujek SAP' },
          { code: 'MONT_KAMERY_PREM', name: 'Kamery', description: 'Montaż kamer CCTV' },
          { code: 'MONT_RACK_PREM', name: 'Szafy RACK', description: 'Montaż szaf' }
        ]
      }
    ]
  }
};

interface FormularyPageProps {
  requestId?: string;
}

export const FormularyPage: React.FC<FormularyPageProps> = ({ requestId: propRequestId }) => {
  const { state } = useAppContext();
  const { currentUser } = state;

  // Get request ID from URL or props
  const urlRequestId = window.location.hash.match(/formulary\/([^/]+)/)?.[1];
  const requestId = propRequestId || urlRequestId;

  const [request, setRequest] = useState<KosztorysRequest | null>(null);
  const [form, setForm] = useState<KosztorysForm | null>(null);
  const [generalData, setGeneralData] = useState<Partial<KosztorysFormGeneralData>>({});
  const [answers, setAnswers] = useState<Map<string, boolean>>(new Map());
  const [template, setTemplate] = useState<KosztorysFormTemplate | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showValidation, setShowValidation] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<any>(null);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasChangesRef = useRef(false);

  useEffect(() => {
    if (currentUser && requestId) {
      loadRequest();
    }
  }, [currentUser, requestId]);

  useEffect(() => {
    // Auto-save every 30 seconds
    const interval = setInterval(() => {
      if (hasChangesRef.current && form) {
        handleSave(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [form]);

  const loadRequest = async () => {
    if (!currentUser || !requestId) return;
    setLoading(true);

    try {
      // Load request
      const { data: requestData, error: reqError } = await supabase
        .from('kosztorys_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqError) throw reqError;
      setRequest(requestData);

      // Determine form type
      const formType = getFormType(requestData.object_type, requestData.installation_types);
      setTemplate(FORM_TEMPLATES[formType]);

      // Expand all groups by default
      const allGroups = new Set(FORM_TEMPLATES[formType].room_groups.map(g => g.code));
      setExpandedGroups(allGroups);

      // Load existing form if any
      const { data: formData } = await supabase
        .from('kosztorys_forms')
        .select(`
          *,
          general_data:kosztorys_form_general_data(*),
          answers:kosztorys_form_answers(*)
        `)
        .eq('request_id', requestId)
        .eq('form_type', formType)
        .eq('is_current', true)
        .single();

      if (formData) {
        setForm(formData);
        if (formData.general_data) {
          setGeneralData(formData.general_data);
        }
        if (formData.answers) {
          const answerMap = new Map<string, boolean>();
          formData.answers.forEach((a: KosztorysFormAnswer) => {
            answerMap.set(`${a.room_code}:${a.work_type_code}`, a.is_marked);
          });
          setAnswers(answerMap);
        }
      } else {
        // Create new form
        const { data: newForm, error: createError } = await supabase
          .from('kosztorys_forms')
          .insert({
            request_id: requestId,
            form_type: formType,
            version: 1,
            is_current: true,
            status: 'draft',
            created_by_id: currentUser.id
          })
          .select()
          .single();

        if (createError) throw createError;
        setForm(newForm);
      }
    } catch (err) {
      console.error('Error loading form:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFormType = (objectType: string, installationTypes: string): KosztorysFormType => {
    const isIndustrial = objectType === 'industrial';
    const isIE = installationTypes.includes('IE');

    if (isIndustrial) {
      return isIE ? 'PREM-IE' : 'PREM-IT';
    } else {
      return isIE ? 'MIESZK-IE' : 'MIESZK-IT';
    }
  };

  const handleGeneralDataChange = (field: string, value: string | number) => {
    setGeneralData(prev => ({ ...prev, [field]: value }));
    hasChangesRef.current = true;
  };

  const handleCellClick = (roomCode: string, workTypeCode: string) => {
    const key = `${roomCode}:${workTypeCode}`;
    setAnswers(prev => {
      const newMap = new Map(prev);
      newMap.set(key, !prev.get(key));
      return newMap;
    });
    hasChangesRef.current = true;
  };

  const getCellValue = (roomCode: string, workTypeCode: string): boolean => {
    return answers.get(`${roomCode}:${workTypeCode}`) || false;
  };

  const handleSave = async (isAutoSave = false) => {
    if (!form || !currentUser) return;
    if (!isAutoSave) setSaving(true);

    try {
      // Save general data
      const generalDataRecord = {
        form_id: form.id,
        ...generalData
      };

      if (generalData.id) {
        await supabase
          .from('kosztorys_form_general_data')
          .update(generalDataRecord)
          .eq('id', generalData.id);
      } else {
        const { data } = await supabase
          .from('kosztorys_form_general_data')
          .insert(generalDataRecord)
          .select()
          .single();
        if (data) {
          setGeneralData(prev => ({ ...prev, id: data.id }));
        }
      }

      // Save answers (batch upsert)
      const answersToSave: Partial<KosztorysFormAnswer>[] = [];
      answers.forEach((isMarked, key) => {
        const [roomCode, workTypeCode] = key.split(':');
        const roomGroup = template?.room_groups.find(g =>
          g.rooms.some(r => r.code === roomCode)
        )?.name || '';
        const workCategory = template?.work_categories.find(c =>
          c.work_types.some(w => w.code === workTypeCode)
        )?.name || '';

        answersToSave.push({
          form_id: form.id,
          room_code: roomCode,
          room_group: roomGroup,
          work_type_code: workTypeCode,
          work_category: workCategory,
          is_marked: isMarked
        });
      });

      // Delete old answers and insert new ones
      await supabase
        .from('kosztorys_form_answers')
        .delete()
        .eq('form_id', form.id);

      if (answersToSave.length > 0) {
        await supabase
          .from('kosztorys_form_answers')
          .insert(answersToSave);
      }

      // Update form timestamp
      await supabase
        .from('kosztorys_forms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', form.id);

      setLastSaved(new Date());
      hasChangesRef.current = false;
    } catch (err) {
      console.error('Error saving form:', err);
      if (!isAutoSave) {
        alert('Błąd podczas zapisywania formularza');
      }
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  const handleValidate = () => {
    setShowValidation(true);
  };

  const handleGenerateEstimate = async () => {
    if (!form || !request || !currentUser) return;

    setGenerating(true);
    setGenerationResult(null);

    try {
      // Import the generator dynamically
      const { generateAndSaveEstimate } = await import('../../lib/estimateGenerator');

      // First save the form
      await handleSave();

      // Generate and save the estimate
      const result = await generateAndSaveEstimate(
        form.id,
        request.id,
        currentUser.company_id!,
        currentUser.id!
      );

      setGenerationResult(result);

      if (result.success && result.estimateId) {
        // Update form status
        await supabase
          .from('kosztorys_forms')
          .update({ status: 'completed' })
          .eq('id', form.id);

        // Navigate to estimates page after short delay
        setTimeout(() => {
          window.location.hash = `#/construction/estimates?request=${request.id}`;
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error generating estimate:', error);
      setGenerationResult({
        success: false,
        items: [],
        materials: [],
        equipment: [],
        totals: { workTotal: 0, materialTotal: 0, equipmentTotal: 0, laborHoursTotal: 0, grandTotal: 0 },
        warnings: [],
        errors: [error.message || 'Błąd generowania kosztorysu']
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleGroupExpand = (groupCode: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupCode)) {
        newSet.delete(groupCode);
      } else {
        newSet.add(groupCode);
      }
      return newSet;
    });
  };

  const getMarkedCount = () => {
    let count = 0;
    answers.forEach(v => { if (v) count++; });
    return count;
  };

  const getTotalPossible = () => {
    if (!template) return 0;
    let total = 0;
    template.room_groups.forEach(g => {
      total += g.rooms.length * template.work_categories.reduce((acc, c) => acc + c.work_types.length, 0);
    });
    return total;
  };

  const validation = useMemo(() => {
    if (!template) return { isValid: true, errors: [], warnings: [] };

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required general fields
    template.general_fields.forEach(field => {
      if (field.required && !generalData[field.code as keyof typeof generalData]) {
        errors.push(`Pole "${field.label}" jest wymagane`);
      }
    });

    // Check if at least one cell is marked
    if (getMarkedCount() === 0) {
      errors.push('Zaznacz przynajmniej jedną pozycję w matrycy');
    }

    // Check logical dependencies (warnings only)
    // Example: if installation is marked but no cable routing
    template.room_groups.forEach(group => {
      group.rooms.forEach(room => {
        const hasInstallation = template.work_categories
          .find(c => c.code.includes('MONT'))
          ?.work_types.some(w => getCellValue(room.code, w.code));

        const hasCabling = template.work_categories
          .find(c => c.code.includes('OKAB'))
          ?.work_types.some(w => getCellValue(room.code, w.code));

        if (hasInstallation && !hasCabling) {
          warnings.push(`${group.name} > ${room.name}: Zaznaczono montaż, ale nie zaznaczono okablowania`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [template, generalData, answers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!request || !template) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-slate-600">Nie znaleziono zapytania lub błąd ładowania formularza</p>
        <button
          onClick={() => window.history.back()}
          className="mt-4 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          Wróć
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">{request.investment_name}</h1>
            <p className="text-sm text-slate-500">
              {request.request_number} • {template.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-slate-400">
                Zapisano: {lastSaved.toLocaleTimeString('pl-PL')}
              </span>
            )}
            <button
              onClick={handleValidate}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Eye className="w-4 h-4" />
              Sprawdź
            </button>
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Zapisz
            </button>
            <button
              onClick={handleGenerateEstimate}
              disabled={!validation.isValid || generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              {generating ? 'Generowanie...' : 'Generuj kosztorys'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {/* General data */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-slate-400" />
            Dane techniczne obiektu
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {template.general_fields.map(field => (
              <div key={field.code}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type={field.type === 'decimal' ? 'number' : 'text'}
                  step={field.type === 'decimal' ? '0.01' : undefined}
                  value={generalData[field.code as keyof typeof generalData] || ''}
                  onChange={e => handleGeneralDataChange(
                    field.code,
                    field.type === 'decimal' ? parseFloat(e.target.value) || 0 : e.target.value
                  )}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">
              Zaznaczono: <strong className="text-blue-600">{getMarkedCount()}</strong> pozycji
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">
              Możliwych: {getTotalPossible()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {validation.errors.length > 0 && (
              <span className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {validation.errors.length} błędów
              </span>
            )}
            {validation.warnings.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {validation.warnings.length} ostrzeżeń
              </span>
            )}
            {validation.isValid && validation.warnings.length === 0 && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Formularz poprawny
              </span>
            )}
          </div>
        </div>

        {/* Matrix */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              {/* Header with work categories */}
              <thead>
                {/* Category row */}
                <tr className="bg-slate-100">
                  <th className="sticky left-0 z-20 bg-slate-100 min-w-[250px] px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-r border-slate-200">
                    Pomieszczenie / Element
                  </th>
                  {template.work_categories.map(category => (
                    <th
                      key={category.code}
                      colSpan={category.work_types.length}
                      className="px-2 py-2 text-center text-xs font-semibold text-slate-700 border-b border-r border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50"
                    >
                      {category.name}
                    </th>
                  ))}
                </tr>
                {/* Work types row */}
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-20 bg-slate-50 min-w-[250px] px-3 py-1 text-left text-xs text-slate-500 border-b border-r border-slate-200">

                  </th>
                  {template.work_categories.flatMap(category =>
                    category.work_types.map(workType => (
                      <th
                        key={workType.code}
                        className="px-1 py-1 text-center min-w-[40px] border-b border-r border-slate-200 group relative"
                        title={workType.description}
                      >
                        <div className="text-[10px] text-slate-500 font-normal leading-tight writing-mode-vertical transform -rotate-45 origin-center h-16 flex items-end justify-center whitespace-nowrap overflow-hidden">
                          {workType.name}
                        </div>
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              <tbody>
                {template.room_groups.map(group => (
                  <React.Fragment key={group.code}>
                    {/* Group header */}
                    <tr
                      className="bg-amber-50 cursor-pointer hover:bg-amber-100"
                      onClick={() => toggleGroupExpand(group.code)}
                    >
                      <td
                        className="sticky left-0 z-10 bg-amber-50 px-3 py-2 font-semibold text-slate-900 border-b border-r border-slate-200"
                        colSpan={1 + template.work_categories.reduce((acc, c) => acc + c.work_types.length, 0)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedGroups.has(group.code) ? (
                            <ChevronDown className="w-4 h-4 text-amber-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-amber-600" />
                          )}
                          {group.name}
                          <span className="text-xs text-slate-400 font-normal">
                            ({group.rooms.length} elementów)
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Room rows */}
                    {expandedGroups.has(group.code) && group.rooms.map(room => (
                      <tr key={room.code} className="hover:bg-slate-50">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 text-sm text-slate-700 border-b border-r border-slate-200">
                          <span className="pl-6">{room.name}</span>
                        </td>
                        {template.work_categories.flatMap(category =>
                          category.work_types.map(workType => {
                            const isMarked = getCellValue(room.code, workType.code);
                            return (
                              <td
                                key={`${room.code}-${workType.code}`}
                                className={`text-center p-1 border-b border-r border-slate-100 cursor-pointer transition-colors ${
                                  isMarked
                                    ? 'bg-green-100 hover:bg-green-200'
                                    : 'hover:bg-blue-50'
                                }`}
                                onClick={() => handleCellClick(room.code, workType.code)}
                              >
                                {isMarked && (
                                  <span className="text-green-600 font-bold text-lg">✓</span>
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Legenda</h4>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <span className="text-slate-600">Praca zaznaczona</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-50 rounded border border-slate-200"></div>
              <span className="text-slate-600">Praca nie zaznaczona</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-50 rounded border border-amber-200"></div>
              <span className="text-slate-600">Nagłówek grupy (kliknij aby zwinąć/rozwinąć)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Modal */}
      {showValidation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">Walidacja formularza</h3>
              <button onClick={() => setShowValidation(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {validation.isValid && validation.warnings.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold text-slate-900 mb-2">Formularz poprawny!</h4>
                  <p className="text-slate-600">Możesz wygenerować kosztorys.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {validation.errors.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold text-red-700 mb-3">
                        <AlertCircle className="w-5 h-5" />
                        Błędy ({validation.errors.length})
                      </h4>
                      <ul className="space-y-2">
                        {validation.errors.map((error, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {validation.warnings.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold text-amber-700 mb-3">
                        <AlertCircle className="w-5 h-5" />
                        Ostrzeżenia ({validation.warnings.length})
                      </h4>
                      <ul className="space-y-2">
                        {validation.warnings.map((warning, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowValidation(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generation Result Modal */}
      {generationResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-6 h-6 text-blue-600" />
                Wynik generowania kosztorysu
              </h2>
              <button onClick={() => setGenerationResult(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {generationResult.success ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-800">Kosztorys wygenerowany pomyślnie</h3>
                      <p className="text-sm text-green-600">Przekierowanie na stronę kosztorysu...</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-500">Pozycje kosztorysowe</div>
                      <div className="text-2xl font-bold text-slate-900">{generationResult.items.length}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-500">Roboczogodziny</div>
                      <div className="text-2xl font-bold text-slate-900">{generationResult.totals.laborHoursTotal.toFixed(1)} h</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-500">Materiały</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {generationResult.totals.materialTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-500">Sprzęt</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {generationResult.totals.equipmentTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-sm text-blue-600">Razem</div>
                    <div className="text-3xl font-bold text-blue-800">
                      {generationResult.totals.grandTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                    </div>
                  </div>

                  {generationResult.warnings.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <h4 className="flex items-center gap-2 font-semibold text-amber-700 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        Ostrzeżenia ({generationResult.warnings.length})
                      </h4>
                      <ul className="text-sm text-amber-600 space-y-1">
                        {generationResult.warnings.map((w: string, i: number) => (
                          <li key={i}>• {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                    <div>
                      <h3 className="font-semibold text-red-800">Błąd generowania</h3>
                      <p className="text-sm text-red-600">Nie udało się wygenerować kosztorysu</p>
                    </div>
                  </div>
                  {generationResult.errors.length > 0 && (
                    <ul className="text-sm text-red-600 space-y-1 bg-red-50 p-4 rounded-lg">
                      {generationResult.errors.map((e: string, i: number) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setGenerationResult(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for vertical text */}
      <style>{`
        .writing-mode-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
};

export default FormularyPage;
