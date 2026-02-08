import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft, Save, FileSpreadsheet, Calculator, ChevronDown, ChevronRight,
  Loader2, AlertCircle, CheckCircle2, Info, X, XCircle, RefreshCw, Settings,
  Download, Upload, Eye, HelpCircle, Zap, Trash2, FileCheck, FilePlus, FileEdit,
  Plus, Check, Pencil, Eraser
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
      { code: 'ext_wall_type', label: 'Rodzaj ścian zewnętrznych', type: 'select', required: true, placeholder: 'Wybierz...' },
      { code: 'int_wall_type', label: 'Rodzaj ścian wewnętrznych', type: 'select', required: true, placeholder: 'Wybierz...' },
      { code: 'ceiling_height', label: 'Wysokość sufitu (m)', type: 'decimal', required: true, placeholder: '2.80' }
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
      { code: 'ext_wall_type', label: 'Rodzaj ścian zewnętrznych', type: 'select', required: true, placeholder: 'Wybierz...' },
      { code: 'int_wall_type', label: 'Rodzaj ścian wewnętrznych', type: 'select', required: true, placeholder: 'Wybierz...' },
      { code: 'ceiling_height', label: 'Wysokość sufitu (m)', type: 'decimal', required: true, placeholder: '2.80' }
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
      { code: 'ext_wall_type', label: 'Rodzaj ścian zewnętrznych', type: 'select', required: true, placeholder: 'Wybierz...' },
      { code: 'int_wall_type', label: 'Rodzaj ścian wewnętrznych', type: 'select', required: true, placeholder: 'Wybierz...' },
      { code: 'hall_ceiling_height', label: 'Wysokość Hali (m)', type: 'decimal', required: true, placeholder: '8.00' }
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
      { code: 'ext_wall_type', label: 'Rodzaj ścian zewnętrznych', type: 'select', required: true, placeholder: 'Wybierz...' },
      { code: 'int_wall_type', label: 'Rodzaj ścian wewnętrznych', type: 'select', required: true, placeholder: 'Wybierz...' },
      { code: 'hall_ceiling_height', label: 'Wysokość Hali (m)', type: 'decimal', required: true, placeholder: '8.00' }
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

// Empty template for creating from scratch
const EMPTY_TEMPLATE: KosztorysFormTemplate = {
  form_type: 'CUSTOM' as KosztorysFormType,
  title: 'NOWY FORMULARZ',
  general_fields: [],
  room_groups: [],
  work_categories: []
};

interface FormularyPageProps {
  requestId?: string;
}

export const FormularyPage: React.FC<FormularyPageProps> = ({ requestId: propRequestId }) => {
  const { state } = useAppContext();
  const { currentUser } = state;

  // Get request ID from URL or props (exclude query params)
  const urlRequestId = window.location.hash.match(/formulary\/([^/?]+)/)?.[1];
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
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Edit mode for form structure
  const [isEditMode, setIsEditMode] = useState(false);

  // Inline editing state
  const [editingItem, setEditingItem] = useState<{ type: 'group' | 'room' | 'category' | 'workType', code: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [showAddModal, setShowAddModal] = useState<{ type: 'group' | 'room' | 'category' | 'workType', parentCode?: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Inline adding state (instead of modal)
  const [inlineAdding, setInlineAdding] = useState<{ type: 'group' | 'room' | 'category' | 'workType', parentCode?: string } | null>(null);
  const [inlineAddValue, setInlineAddValue] = useState('');

  // Save as template state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateObjectType, setTemplateObjectType] = useState<string>('');
  const [templateWorkType, setTemplateWorkType] = useState<string>('');
  const [templateDescription, setTemplateDescription] = useState<string>('');

  // Dictionary data for select fields
  const [workTypesForTemplate, setWorkTypesForTemplate] = useState<{ id: string; code: string; name: string }[]>([]);
  const [extWallTypes, setExtWallTypes] = useState<{ id: string; name: string }[]>([]);
  const [intWallTypes, setIntWallTypes] = useState<{ id: string; name: string }[]>([]);

  // Multi work type support
  const [requestWorkTypes, setRequestWorkTypes] = useState<{ code: string; name: string }[]>([]);
  const [activeWorkType, setActiveWorkType] = useState<string>('');
  const [formsByWorkType, setFormsByWorkType] = useState<Record<string, {
    form: KosztorysForm | null;
    template: KosztorysFormTemplate | null;
    answers: Map<string, boolean>;
    generalData: Partial<KosztorysFormGeneralData>;
  }>>({});

  // Template change modal
  const [showTemplateChangeWarning, setShowTemplateChangeWarning] = useState(false);
  const [showTemplateSelectModal, setShowTemplateSelectModal] = useState(false);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasChangesRef = useRef(false);

  useEffect(() => {
    if (currentUser && requestId) {
      loadRequest();
      loadDictionaries();
    }
  }, [currentUser, requestId]);

  const loadDictionaries = async () => {
    if (!currentUser) return;
    try {
      // Load external wall types
      const { data: extWalls } = await supabase
        .from('kosztorys_wall_types')
        .select('id, name')
        .eq('company_id', currentUser.company_id)
        .eq('wall_category', 'external')
        .eq('is_active', true)
        .order('name');

      if (extWalls && extWalls.length > 0) {
        setExtWallTypes(extWalls);
      } else {
        // Fallback defaults
        setExtWallTypes([
          { id: 'plyta_warstwowa', name: 'Płyta warstwowa' },
          { id: 'cegla_ceramiczna', name: 'Cegła ceramiczna' },
          { id: 'beton', name: 'Beton' },
          { id: 'pustak', name: 'Pustak' },
          { id: 'silka', name: 'Silka' },
          { id: 'inne', name: 'Inne' }
        ]);
      }

      // Load internal wall types
      const { data: intWalls } = await supabase
        .from('kosztorys_wall_types')
        .select('id, name')
        .eq('company_id', currentUser.company_id)
        .eq('wall_category', 'internal')
        .eq('is_active', true)
        .order('name');

      if (intWalls && intWalls.length > 0) {
        setIntWallTypes(intWalls);
      } else {
        // Fallback defaults
        setIntWallTypes([
          { id: 'gipskarton', name: 'Gipskarton' },
          { id: 'cegla', name: 'Cegła' },
          { id: 'pustak', name: 'Pustak' },
          { id: 'beton', name: 'Beton' },
          { id: 'silka', name: 'Silka' },
          { id: 'inne', name: 'Inne' }
        ]);
      }

      // Load work types for template modal
      const { data: workTypesData } = await supabase
        .from('kosztorys_work_types')
        .select('id, code, name')
        .eq('company_id', currentUser.company_id)
        .eq('is_active', true)
        .order('code');

      if (workTypesData && workTypesData.length > 0) {
        setWorkTypesForTemplate(workTypesData);
      } else {
        // Fallback defaults
        setWorkTypesForTemplate([
          { id: 'ie', code: 'IE', name: 'IE - Elektryka' },
          { id: 'it', code: 'IT', name: 'IT - Teletechnika' }
        ]);
      }
    } catch (err) {
      console.error('Error loading dictionaries:', err);
      // Set fallback defaults
      setExtWallTypes([
        { id: 'plyta_warstwowa', name: 'Płyta warstwowa' },
        { id: 'cegla_ceramiczna', name: 'Cegła ceramiczna' },
        { id: 'beton', name: 'Beton' },
        { id: 'pustak', name: 'Pustak' },
        { id: 'silka', name: 'Silka' },
        { id: 'inne', name: 'Inne' }
      ]);
      setIntWallTypes([
        { id: 'gipskarton', name: 'Gipskarton' },
        { id: 'cegla', name: 'Cegła' },
        { id: 'pustak', name: 'Pustak' },
        { id: 'beton', name: 'Beton' },
        { id: 'silka', name: 'Silka' },
        { id: 'inne', name: 'Inne' }
      ]);
      setWorkTypesForTemplate([
        { id: 'ie', code: 'IE', name: 'IE - Elektryka' },
        { id: 'it', code: 'IT', name: 'IT - Teletechnika' }
      ]);
    }
  };

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
      // Load request with work types
      const { data: requestData, error: reqError } = await supabase
        .from('kosztorys_requests')
        .select(`
          *,
          work_types:kosztorys_request_work_types(work_type_id, work_type:kosztorys_work_types(id, code, name))
        `)
        .eq('id', requestId)
        .single();

      if (reqError) throw reqError;
      setRequest(requestData);

      // Extract work types from request
      const workTypes: { code: string; name: string }[] = [];
      if (requestData.work_types && requestData.work_types.length > 0) {
        requestData.work_types.forEach((wt: any) => {
          if (wt.work_type) {
            workTypes.push({ code: wt.work_type.code, name: wt.work_type.name });
          }
        });
      } else {
        // Fallback to installation_types
        if (requestData.installation_types?.includes('IE')) {
          workTypes.push({ code: 'IE', name: 'Instalacje elektryczne' });
        }
        if (requestData.installation_types?.includes('IT')) {
          workTypes.push({ code: 'IT', name: 'Instalacje teletechniczne' });
        }
        if (workTypes.length === 0) {
          workTypes.push({ code: 'IE', name: 'Instalacje elektryczne' });
        }
      }
      setRequestWorkTypes(workTypes);

      // Parse URL params for templates
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const templatesParam = urlParams.get('templates');
      const singleTemplate = urlParams.get('template');
      const isNewEmpty = urlParams.get('new') === 'true';
      let workTypeTemplatesMap: Record<string, string> = {};

      if (templatesParam) {
        try {
          workTypeTemplatesMap = JSON.parse(decodeURIComponent(templatesParam));
        } catch (e) {
          console.error('Error parsing templates param:', e);
        }
      } else if (singleTemplate) {
        // Apply single template to first work type
        workTypes.forEach(wt => {
          workTypeTemplatesMap[wt.code] = singleTemplate as KosztorysFormType;
        });
      }

      // Load or create forms for each work type
      const formsMap: Record<string, any> = {};

      for (const wt of workTypes) {
        // Determine form type for this work type
        let formType = workTypeTemplatesMap[wt.code] as KosztorysFormType;
        if (!formType && !isNewEmpty) {
          formType = getFormType(requestData.object_type, wt.code);
        }

        // Use empty template if new=true
        const templateToUse = isNewEmpty ? EMPTY_TEMPLATE : (FORM_TEMPLATES[formType] || EMPTY_TEMPLATE);
        const formTypeToSave = isNewEmpty ? 'CUSTOM' : formType;

        // Load existing form for this work type
        const { data: formData } = await supabase
          .from('kosztorys_forms')
          .select(`
            *,
            general_data:kosztorys_form_general_data(*),
            answers:kosztorys_form_answers(*)
          `)
          .eq('request_id', requestId)
          .eq('form_type', formTypeToSave)
          .eq('is_current', true)
          .maybeSingle();

        if (formData && !isNewEmpty) {
          const answerMap = new Map<string, boolean>();
          if (formData.answers) {
            formData.answers.forEach((a: KosztorysFormAnswer) => {
              answerMap.set(`${a.room_code}:${a.work_type_code}`, a.is_marked);
            });
          }
          formsMap[wt.code] = {
            form: formData,
            template: templateToUse,
            answers: answerMap,
            generalData: formData.general_data || {}
          };
        } else {
          // Create new form
          const { data: newForm, error: createError } = await supabase
            .from('kosztorys_forms')
            .insert({
              request_id: requestId,
              form_type: formTypeToSave,
              version: 1,
              is_current: true,
              status: 'draft',
              created_by_id: currentUser.id
            })
            .select()
            .single();

          if (createError) throw createError;
          formsMap[wt.code] = {
            form: newForm,
            template: templateToUse,
            answers: new Map(),
            generalData: {}
          };
        }
      }

      setFormsByWorkType(formsMap);

      // Set active work type and current form/template/answers
      const firstWorkType = workTypes[0]?.code || 'IE';
      setActiveWorkType(firstWorkType);

      if (formsMap[firstWorkType]) {
        setForm(formsMap[firstWorkType].form);
        setTemplate(formsMap[firstWorkType].template);
        setAnswers(formsMap[firstWorkType].answers);
        setGeneralData(formsMap[firstWorkType].generalData);

        // Expand all groups
        if (formsMap[firstWorkType].template) {
          const allGroups = new Set(formsMap[firstWorkType].template.room_groups.map((g: any) => g.code));
          setExpandedGroups(allGroups);
        }

        // Auto-enable edit mode for empty templates
        if (isNewEmpty || formsMap[firstWorkType].template?.room_groups?.length === 0) {
          setIsEditMode(true);
        }
      }
    } catch (err) {
      console.error('Error loading form:', err);
    } finally {
      setLoading(false);
    }
  };

  // Switch active work type
  const switchWorkType = (workTypeCode: string) => {
    // Save current state
    if (activeWorkType && formsByWorkType[activeWorkType]) {
      setFormsByWorkType(prev => ({
        ...prev,
        [activeWorkType]: {
          ...prev[activeWorkType],
          answers: answers,
          generalData: generalData
        }
      }));
    }

    // Load new work type
    const newData = formsByWorkType[workTypeCode];
    if (newData) {
      setActiveWorkType(workTypeCode);
      setForm(newData.form);
      setTemplate(newData.template);
      setAnswers(newData.answers);
      setGeneralData(newData.generalData);

      // Expand all groups for new template
      if (newData.template) {
        const allGroups = new Set(newData.template.room_groups.map((g: any) => g.code));
        setExpandedGroups(allGroups);
      }
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

  // Inline editing functions - only allowed in edit mode
  const startEditing = (type: 'group' | 'room' | 'category' | 'workType', code: string, currentName: string) => {
    if (!isEditMode) return; // Block editing if not in edit mode
    setEditingItem({ type, code });
    setEditingValue(currentName);
  };

  const saveEditing = () => {
    if (!editingItem || !template) return;

    const newTemplate = JSON.parse(JSON.stringify(template)) as KosztorysFormTemplate;

    switch (editingItem.type) {
      case 'group':
        const group = newTemplate.room_groups.find(g => g.code === editingItem.code);
        if (group) group.name = editingValue;
        break;
      case 'room':
        for (const g of newTemplate.room_groups) {
          const room = g.rooms.find(r => r.code === editingItem.code);
          if (room) {
            room.name = editingValue;
            break;
          }
        }
        break;
      case 'category':
        const cat = newTemplate.work_categories.find(c => c.code === editingItem.code);
        if (cat) cat.name = editingValue;
        break;
      case 'workType':
        for (const c of newTemplate.work_categories) {
          const wt = c.work_types.find(w => w.code === editingItem.code);
          if (wt) {
            wt.name = editingValue;
            break;
          }
        }
        break;
    }

    setTemplate(newTemplate);
    setEditingItem(null);
    setEditingValue('');
    hasChangesRef.current = true;
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditingValue('');
  };

  const handleAddItem = () => {
    if (!showAddModal || !template || !newItemName.trim()) return;

    const newTemplate = JSON.parse(JSON.stringify(template)) as KosztorysFormTemplate;
    const code = newItemName.toUpperCase().replace(/\s+/g, '_').slice(0, 20) + '_' + Date.now().toString(36);

    switch (showAddModal.type) {
      case 'group':
        newTemplate.room_groups.push({
          code,
          name: newItemName,
          rooms: []
        });
        break;
      case 'room':
        if (showAddModal.parentCode) {
          const group = newTemplate.room_groups.find(g => g.code === showAddModal.parentCode);
          if (group) {
            group.rooms.push({ code, name: newItemName });
          }
        }
        break;
      case 'category':
        newTemplate.work_categories.push({
          code,
          name: newItemName,
          work_types: []
        });
        break;
      case 'workType':
        if (showAddModal.parentCode) {
          const category = newTemplate.work_categories.find(c => c.code === showAddModal.parentCode);
          if (category) {
            category.work_types.push({ code, name: newItemName, description: '' });
          }
        }
        break;
    }

    setTemplate(newTemplate);
    setShowAddModal(null);
    setNewItemName('');
    hasChangesRef.current = true;
  };

  // Handle inline adding (without modal)
  const handleInlineAdd = () => {
    if (!inlineAdding || !template || !inlineAddValue.trim()) return;

    const newTemplate = JSON.parse(JSON.stringify(template)) as KosztorysFormTemplate;
    const code = inlineAddValue.toUpperCase().replace(/\s+/g, '_').slice(0, 20) + '_' + Date.now().toString(36);

    switch (inlineAdding.type) {
      case 'group':
        newTemplate.room_groups.push({
          code,
          name: inlineAddValue,
          rooms: []
        });
        break;
      case 'room':
        if (inlineAdding.parentCode) {
          const group = newTemplate.room_groups.find(g => g.code === inlineAdding.parentCode);
          if (group) {
            group.rooms.push({ code, name: inlineAddValue });
          }
        }
        break;
      case 'category':
        newTemplate.work_categories.push({
          code,
          name: inlineAddValue,
          work_types: []
        });
        break;
      case 'workType':
        if (inlineAdding.parentCode) {
          const category = newTemplate.work_categories.find(c => c.code === inlineAdding.parentCode);
          if (category) {
            category.work_types.push({ code, name: inlineAddValue, description: '' });
          }
        }
        break;
    }

    setTemplate(newTemplate);
    setInlineAdding(null);
    setInlineAddValue('');
    hasChangesRef.current = true;
  };

  const cancelInlineAdd = () => {
    setInlineAdding(null);
    setInlineAddValue('');
  };

  // Delete functions for form structure
  const deleteGroup = (groupCode: string) => {
    if (!template || !isEditMode) return;
    if (!confirm('Czy na pewno chcesz usunąć tę grupę i wszystkie jej elementy?')) return;

    const newTemplate = JSON.parse(JSON.stringify(template)) as KosztorysFormTemplate;
    newTemplate.room_groups = newTemplate.room_groups.filter(g => g.code !== groupCode);
    setTemplate(newTemplate);
    hasChangesRef.current = true;
  };

  const deleteRoom = (groupCode: string, roomCode: string) => {
    if (!template || !isEditMode) return;
    if (!confirm('Czy na pewno chcesz usunąć ten element?')) return;

    const newTemplate = JSON.parse(JSON.stringify(template)) as KosztorysFormTemplate;
    const group = newTemplate.room_groups.find(g => g.code === groupCode);
    if (group) {
      group.rooms = group.rooms.filter(r => r.code !== roomCode);
    }
    setTemplate(newTemplate);
    hasChangesRef.current = true;
  };

  const deleteCategory = (categoryCode: string) => {
    if (!template || !isEditMode) return;
    if (!confirm('Czy na pewno chcesz usunąć tę kategorię i wszystkie jej rodzaje prac?')) return;

    const newTemplate = JSON.parse(JSON.stringify(template)) as KosztorysFormTemplate;
    newTemplate.work_categories = newTemplate.work_categories.filter(c => c.code !== categoryCode);
    setTemplate(newTemplate);
    hasChangesRef.current = true;
  };

  const deleteWorkType = (categoryCode: string, workTypeCode: string) => {
    if (!template || !isEditMode) return;
    if (!confirm('Czy na pewno chcesz usunąć ten rodzaj pracy?')) return;

    const newTemplate = JSON.parse(JSON.stringify(template)) as KosztorysFormTemplate;
    const category = newTemplate.work_categories.find(c => c.code === categoryCode);
    if (category) {
      category.work_types = category.work_types.filter(w => w.code !== workTypeCode);
    }
    setTemplate(newTemplate);
    hasChangesRef.current = true;
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
            {isEditMode && (
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                Tryb edycji
              </span>
            )}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition ${
                isEditMode
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
              }`}
              title={isEditMode ? 'Wyłącz tryb edycji' : 'Włącz tryb edycji formularza'}
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center justify-center w-10 h-10 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              title="Wyczyść formularz"
            >
              <Eraser className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={saving}
              className="flex items-center justify-center w-10 h-10 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
              title="Zapisz"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
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
            {isEditMode && (
              <button
                onClick={() => {
                  if (!template) return;
                  const newField = {
                    code: `field_${Date.now()}`,
                    label: 'Nowe pole',
                    type: 'text' as const,
                    required: false,
                    placeholder: ''
                  };
                  const newTemplate = { ...template, general_fields: [...template.general_fields, newField] };
                  setTemplate(newTemplate);
                  hasChangesRef.current = true;
                }}
                className="ml-auto p-1 text-blue-600 hover:bg-blue-50 rounded"
                title="Dodaj pole"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {template.general_fields.map((field, fieldIndex) => (
              <div key={field.code} className="relative group">
                {isEditMode ? (
                  <div className="mb-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => {
                        const newFields = [...template.general_fields];
                        newFields[fieldIndex] = { ...field, label: e.target.value };
                        setTemplate({ ...template, general_fields: newFields });
                        hasChangesRef.current = true;
                      }}
                      className="flex-1 px-2 py-0.5 text-sm font-medium border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        const newFields = [...template.general_fields];
                        newFields[fieldIndex] = { ...field, required: !field.required };
                        setTemplate({ ...template, general_fields: newFields });
                        hasChangesRef.current = true;
                      }}
                      className={`p-0.5 rounded ${field.required ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:bg-slate-100'}`}
                      title={field.required ? 'Pole wymagane - kliknij aby zmienić' : 'Pole opcjonalne - kliknij aby uczynić wymaganym'}
                    >
                      <span className="text-xs font-bold">*</span>
                    </button>
                    <button
                      onClick={() => {
                        const newFields = template.general_fields.filter((_, i) => i !== fieldIndex);
                        setTemplate({ ...template, general_fields: newFields });
                        hasChangesRef.current = true;
                      }}
                      className="p-0.5 text-red-500 hover:bg-red-50 rounded"
                      title="Usuń pole"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                )}
                {field.type === 'select' ? (
                  <select
                    value={generalData[field.code as keyof typeof generalData] || ''}
                    onChange={e => handleGeneralDataChange(field.code, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{field.placeholder || 'Wybierz...'}</option>
                    {field.code === 'ext_wall_type' && extWallTypes.map(wt => (
                      <option key={wt.id} value={wt.name}>{wt.name}</option>
                    ))}
                    {field.code === 'int_wall_type' && intWallTypes.map(wt => (
                      <option key={wt.id} value={wt.name}>{wt.name}</option>
                    ))}
                  </select>
                ) : (
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
                )}
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
          </div>
          <div className="flex items-center gap-2">
            {validation.errors.length > 0 && (
              <div className="relative group">
                <span className="flex items-center gap-1 text-red-600 text-sm cursor-help">
                  <AlertCircle className="w-4 h-4" />
                  {validation.errors.length} błędów
                </span>
                <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-white border border-red-200 shadow-lg rounded-lg p-3 w-72 z-50">
                  <div className="text-xs font-semibold text-red-700 mb-2 border-b border-red-100 pb-1">
                    Lista błędów:
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {validation.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-600 flex items-start gap-1">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="relative group">
                <span className="flex items-center gap-1 text-amber-600 text-sm cursor-help">
                  <AlertCircle className="w-4 h-4" />
                  {validation.warnings.length} ostrzeżeń
                </span>
                <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-white border border-amber-200 shadow-lg rounded-lg p-3 w-72 z-50">
                  <div className="text-xs font-semibold text-amber-700 mb-2 border-b border-amber-100 pb-1">
                    Lista ostrzeżeń:
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {validation.warnings.map((warn, i) => (
                      <div key={i} className="text-xs text-amber-600 flex items-start gap-1">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {validation.isValid && validation.warnings.length === 0 && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Formularz poprawny
              </span>
            )}
          </div>
        </div>

        {/* Work Type Tabs - only show if multiple work types */}
        {requestWorkTypes.length > 1 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-600 mr-2">Rodzaj prac:</span>
              {requestWorkTypes.map(wt => (
                <button
                  key={wt.code}
                  onClick={() => switchWorkType(wt.code)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                    activeWorkType === wt.code
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {wt.name || wt.code}
                </button>
              ))}
              {/* Change template button */}
              <button
                onClick={() => setShowTemplateChangeWarning(true)}
                className="ml-auto px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1"
                title="Zmień szablon dla aktywnego typu prac"
              >
                <RefreshCw className="w-4 h-4" />
                Zmień szablon
              </button>
            </div>
          </div>
        )}

        {/* Matrix */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
          {/* Empty state when no data */}
          {template.room_groups.length === 0 && template.work_categories.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Pusty formularz</h3>
              <p className="text-slate-500 mb-6 max-w-md">
                Ten formularz jest pusty. Użyj trybu edycji, aby dodać działy i kategorie prac.
              </p>
              {!isEditMode && (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Pencil className="w-4 h-4" />
                  Włącz tryb edycji
                </button>
              )}
              {isEditMode && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (!template) return;
                      const newGroup = {
                        code: `GROUP_${Date.now()}`,
                        name: 'Nowa grupa',
                        rooms: []
                      };
                      const newTemplate = { ...template, room_groups: [...template.room_groups, newGroup] };
                      setTemplate(newTemplate);
                      hasChangesRef.current = true;
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj dział
                  </button>
                  <button
                    onClick={() => {
                      if (!template) return;
                      const newCategory = {
                        code: `CAT_${Date.now()}`,
                        name: 'Nowa kategoria',
                        work_types: []
                      };
                      const newTemplate = { ...template, work_categories: [...template.work_categories, newCategory] };
                      setTemplate(newTemplate);
                      hasChangesRef.current = true;
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj kategorię prac
                  </button>
                </div>
              )}
            </div>
          ) : (
          <div className="overflow-auto flex-1" style={{ maxHeight: 'calc(100vh - 400px)' }}>
            <table className="w-full border-collapse">
              {/* Header with work categories */}
              <thead className="sticky top-0 z-40 bg-white">
                {/* Category row */}
                <tr className="bg-slate-100">
                  <th className="sticky left-0 z-50 bg-slate-100 min-w-[250px] px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  </th>
                  {template.work_categories.map((category, catIndex) => {
                    // Color palette for categories
                    const categoryColors = [
                      'bg-blue-100 text-blue-800',
                      'bg-indigo-100 text-indigo-800',
                      'bg-purple-100 text-purple-800',
                      'bg-violet-100 text-violet-800',
                      'bg-fuchsia-100 text-fuchsia-800',
                      'bg-pink-100 text-pink-800',
                      'bg-rose-100 text-rose-800',
                      'bg-cyan-100 text-cyan-800',
                      'bg-teal-100 text-teal-800',
                      'bg-emerald-100 text-emerald-800'
                    ];
                    const colorClass = categoryColors[catIndex % categoryColors.length];
                    const isEditing = editingItem?.type === 'category' && editingItem.code === category.code;
                    return (
                      <th
                        key={category.code}
                        colSpan={category.work_types.length + (isEditMode ? 1 : 0)}
                        className={`px-2 py-2 text-center text-xs font-semibold border-b border-r border-slate-200 ${colorClass} ${isEditMode ? 'cursor-pointer hover:opacity-80' : ''} group`}
                        data-category-index={catIndex}
                        onClick={(e) => {
                          if (!isEditing && isEditMode) {
                            e.stopPropagation();
                            startEditing('category', category.code, category.name);
                          }
                        }}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-full px-1 py-0.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditing();
                                if (e.key === 'Escape') cancelEditing();
                              }}
                            />
                            <button onClick={saveEditing} className="p-0.5 hover:bg-white/50 rounded">
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                                deleteCategory(category.code);
                              }}
                              className="p-0.5 hover:bg-red-100 rounded text-red-600"
                              title="Usuń kategorię"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <span>{category.name}</span>
                            {isEditMode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCategory(category.code);
                                }}
                                className="p-0.5 hover:bg-red-100 rounded text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Usuń kategorię"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                  {isEditMode && (
                    <th className="px-2 py-2 bg-slate-100 border-b border-slate-200 min-w-[120px]">
                      {inlineAdding?.type === 'category' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={inlineAddValue}
                            onChange={(e) => setInlineAddValue(e.target.value)}
                            className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            placeholder="Nazwa..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && inlineAddValue.trim()) handleInlineAdd();
                              if (e.key === 'Escape') cancelInlineAdd();
                            }}
                          />
                          <button
                            onClick={handleInlineAdd}
                            disabled={!inlineAddValue.trim()}
                            className="p-0.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={cancelInlineAdd}
                            className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setInlineAdding({ type: 'category' });
                            setInlineAddValue('');
                          }}
                          className="p-1 hover:bg-white/50 rounded text-slate-500 hover:text-slate-700"
                          title="Dodaj kategorię"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </th>
                  )}
                </tr>
                {/* Work types row */}
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-50 bg-slate-50 min-w-[250px] px-3 py-1 text-left text-xs text-slate-500 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">

                  </th>
                  {template.work_categories.flatMap((category, catIndex) => {
                    // Match category colors for work type cells
                    const categoryBgColors = [
                      'bg-blue-50',
                      'bg-indigo-50',
                      'bg-purple-50',
                      'bg-violet-50',
                      'bg-fuchsia-50',
                      'bg-pink-50',
                      'bg-rose-50',
                      'bg-cyan-50',
                      'bg-teal-50',
                      'bg-emerald-50'
                    ];
                    const bgColorClass = categoryBgColors[catIndex % categoryBgColors.length];
                    const workTypeElements = category.work_types.map(workType => {
                      const isEditing = editingItem?.type === 'workType' && editingItem.code === workType.code;
                      return (
                        <th
                          key={workType.code}
                          className={`px-1 py-2 text-center min-w-[80px] border-b border-r border-slate-200 group relative ${isEditMode ? 'cursor-pointer hover:opacity-80' : ''} ${bgColorClass}`}
                          title={workType.description}
                          onClick={() => {
                            if (!isEditing && isEditMode) {
                              startEditing('workType', workType.code, workType.name);
                            }
                          }}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="w-full px-1 py-0.5 text-[10px] rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditing();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                              />
                              <button onClick={saveEditing} className="p-0.5 hover:bg-white/50 rounded">
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEditing();
                                  deleteWorkType(category.code, workType.code);
                                }}
                                className="p-0.5 hover:bg-red-100 rounded text-red-600"
                                title="Usuń"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="text-[10px] text-slate-600 font-normal leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                                {workType.name}
                              </div>
                              {isEditMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteWorkType(category.code, workType.code);
                                  }}
                                  className="absolute -top-1 -right-1 p-0.5 bg-red-100 hover:bg-red-200 rounded text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Usuń"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </th>
                      );
                    });
                    // Add the "add work type" button or inline input only in edit mode
                    if (isEditMode) {
                      const isAddingToThisCategory = inlineAdding?.type === 'workType' && inlineAdding.parentCode === category.code;
                      workTypeElements.push(
                        <th
                          key={`add-${category.code}`}
                          className={`px-1 py-2 text-center border-b border-r border-slate-200 ${bgColorClass} ${isAddingToThisCategory ? 'min-w-[100px]' : 'min-w-[40px]'}`}
                        >
                          {isAddingToThisCategory ? (
                            <div className="flex items-center gap-0.5">
                              <input
                                type="text"
                                value={inlineAddValue}
                                onChange={(e) => setInlineAddValue(e.target.value)}
                                className="w-full px-1 py-0.5 text-[10px] border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                placeholder="Nazwa..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && inlineAddValue.trim()) handleInlineAdd();
                                  if (e.key === 'Escape') cancelInlineAdd();
                                }}
                              />
                              <button
                                onClick={handleInlineAdd}
                                disabled={!inlineAddValue.trim()}
                                className="p-0.5 text-green-600 hover:bg-white/50 rounded disabled:opacity-50"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={cancelInlineAdd}
                                className="p-0.5 text-red-600 hover:bg-white/50 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setInlineAdding({ type: 'workType', parentCode: category.code });
                                setInlineAddValue('');
                              }}
                              className="p-0.5 hover:bg-white/50 rounded text-slate-400 hover:text-slate-600"
                              title="Dodaj rodzaj pracy"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </th>
                      );
                    }
                    return workTypeElements;
                  })}
                  {isEditMode && <th className="bg-slate-50 border-b border-slate-200 w-8"></th>}
                </tr>
              </thead>

              <tbody>
                {template.room_groups.map(group => {
                  const isGroupEditing = editingItem?.type === 'group' && editingItem.code === group.code;
                  return (
                  <React.Fragment key={group.code}>
                    {/* Group header */}
                    <tr
                      className="bg-amber-50 cursor-pointer hover:bg-amber-100"
                      onClick={() => toggleGroupExpand(group.code)}
                    >
                      <td
                        className="sticky left-0 z-30 bg-amber-50 px-3 py-2 font-semibold text-slate-900 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[250px]"
                      >
                        <div className="flex items-center gap-2">
                          {expandedGroups.has(group.code) ? (
                            <ChevronDown className="w-4 h-4 text-amber-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-amber-600" />
                          )}
                          {isGroupEditing ? (
                            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditing();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                              />
                              <button onClick={saveEditing} className="p-1 hover:bg-amber-200 rounded">
                                <Check className="w-4 h-4 text-green-600" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEditing();
                                  deleteGroup(group.code);
                                }}
                                className="p-1 hover:bg-red-200 rounded text-red-600"
                                title="Usuń grupę"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className={isEditMode ? "hover:bg-amber-200 px-1 rounded cursor-text" : "px-1"}
                              onClick={(e) => {
                                if (isEditMode) {
                                  e.stopPropagation();
                                  startEditing('group', group.code, group.name);
                                }
                              }}
                            >
                              {group.name}
                            </span>
                          )}
                          {isEditMode && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineAdding({ type: 'room', parentCode: group.code });
                                  setInlineAddValue('');
                                }}
                                className="ml-auto p-1 hover:bg-amber-200 rounded text-amber-600 hover:text-amber-800"
                                title="Dodaj element"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteGroup(group.code);
                                }}
                                className="p-1 hover:bg-red-200 rounded text-red-600"
                                title="Usuń grupę"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td
                        className="bg-amber-50 border-b border-slate-200"
                        colSpan={template.work_categories.reduce((acc, c) => acc + c.work_types.length, 0) + (isEditMode ? template.work_categories.length : 0) + 1}
                      />
                    </tr>

                    {/* Room rows */}
                    {expandedGroups.has(group.code) && group.rooms.map(room => {
                      const isRoomEditing = editingItem?.type === 'room' && editingItem.code === room.code;
                      return (
                      <tr key={room.code} className="hover:bg-slate-50">
                        <td className="sticky left-0 z-30 bg-white px-3 py-2 text-sm text-slate-700 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {isRoomEditing ? (
                            <div className="flex items-center gap-1 pl-6" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditing();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                              />
                              <button onClick={saveEditing} className="p-1 hover:bg-slate-200 rounded">
                                <Check className="w-4 h-4 text-green-600" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group">
                              <span
                                className={isEditMode ? "pl-6 hover:bg-slate-100 px-1 rounded cursor-text flex-1" : "pl-6 px-1 flex-1"}
                                onClick={() => {
                                  if (isEditMode) {
                                    startEditing('room', room.code, room.name);
                                  }
                                }}
                              >
                                {room.name}
                              </span>
                              {isEditMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRoom(group.code, room.code);
                                  }}
                                  className="p-1 hover:bg-red-100 rounded text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Usuń element"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        {template.work_categories.flatMap((category, catIndex) => {
                          // Light category background colors for cells
                          const categoryBgColors = [
                            'bg-blue-50/30',
                            'bg-indigo-50/30',
                            'bg-purple-50/30',
                            'bg-violet-50/30',
                            'bg-fuchsia-50/30',
                            'bg-pink-50/30',
                            'bg-rose-50/30',
                            'bg-cyan-50/30',
                            'bg-teal-50/30',
                            'bg-emerald-50/30'
                          ];
                          const bgColorClass = categoryBgColors[catIndex % categoryBgColors.length];
                          const cells = category.work_types.map(workType => {
                            const isMarked = getCellValue(room.code, workType.code);
                            return (
                              <td
                                key={`${room.code}-${workType.code}`}
                                className={`text-center p-1 border-b border-r border-slate-100 cursor-pointer transition-colors ${
                                  isMarked
                                    ? 'bg-green-100 hover:bg-green-200'
                                    : `${bgColorClass} hover:bg-blue-50`
                                }`}
                                onClick={() => handleCellClick(room.code, workType.code)}
                              >
                                {isMarked && (
                                  <span className="text-green-600 font-bold text-lg">✓</span>
                                )}
                              </td>
                            );
                          });
                          // Add empty cell for the "add work type" column - only in edit mode
                          if (isEditMode) {
                            cells.push(
                              <td key={`${room.code}-add-${category.code}`} className="border-b border-slate-100" />
                            );
                          }
                          return cells;
                        })}
                        {isEditMode && <td className="border-b border-slate-100" />}
                      </tr>
                    )})}
                    {/* Inline add room row */}
                    {expandedGroups.has(group.code) && isEditMode && inlineAdding?.type === 'room' && inlineAdding.parentCode === group.code && (
                      <tr className="bg-blue-50/50">
                        <td className="sticky left-0 z-30 bg-blue-50/50 px-3 py-2 text-sm border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-1 pl-6">
                            <input
                              type="text"
                              value={inlineAddValue}
                              onChange={(e) => setInlineAddValue(e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              placeholder="Nazwa nowego elementu..."
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && inlineAddValue.trim()) handleInlineAdd();
                                if (e.key === 'Escape') cancelInlineAdd();
                              }}
                            />
                            <button
                              onClick={handleInlineAdd}
                              disabled={!inlineAddValue.trim()}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              title="Dodaj"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelInlineAdd}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Anuluj"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        {template.work_categories.flatMap((category) => {
                          const cells = category.work_types.map(workType => (
                            <td key={`add-${workType.code}`} className="border-b border-slate-100 bg-blue-50/30" />
                          ));
                          if (isEditMode) {
                            cells.push(<td key={`add-add-${category.code}`} className="border-b border-slate-100 bg-blue-50/30" />);
                          }
                          return cells;
                        })}
                        {isEditMode && <td className="border-b border-slate-100 bg-blue-50/30" />}
                      </tr>
                    )}
                  </React.Fragment>
                )})}
                {/* Add group row - only in edit mode */}
                {isEditMode && (
                  <tr className="bg-slate-50">
                    <td
                      className="sticky left-0 z-30 bg-slate-50 px-3 py-2 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                    >
                      {inlineAdding?.type === 'group' ? (
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 text-amber-600" />
                          <input
                            type="text"
                            value={inlineAddValue}
                            onChange={(e) => setInlineAddValue(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Nazwa nowej grupy..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && inlineAddValue.trim()) handleInlineAdd();
                              if (e.key === 'Escape') cancelInlineAdd();
                            }}
                          />
                          <button
                            onClick={handleInlineAdd}
                            disabled={!inlineAddValue.trim()}
                            className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            title="Dodaj"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelInlineAdd}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Anuluj"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setInlineAdding({ type: 'group' });
                            setInlineAddValue('');
                          }}
                          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded"
                        >
                          <Plus className="w-4 h-4" />
                          Dodaj pomieszczenie/grupę
                        </button>
                      )}
                    </td>
                    <td
                      className="bg-slate-50 border-b border-slate-200"
                      colSpan={template.work_categories.reduce((acc, c) => acc + c.work_types.length, 0) + (isEditMode ? template.work_categories.length : 0) + 1}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
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

      {/* Save Options Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Zapisz formularz</h3>
              <p className="text-sm text-slate-500 mt-1">Wybierz sposób zapisania</p>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  handleSave();
                  setShowSaveModal(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition text-left"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Zapisz dla tego zapytania</div>
                  <div className="text-sm text-slate-500">Zapisz wypełniony formularz dla bieżącego zapytania</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setTemplateName(request?.investment_name || '');
                  setTemplateObjectType(request?.object_type || '');
                  setTemplateWorkType(request?.installation_types || '');
                  setShowSaveTemplateModal(true);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-green-300 transition text-left"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FilePlus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Zapisz jako nowy szablon</div>
                  <div className="text-sm text-slate-500">Utwórz nowy szablon formularza do wielokrotnego użycia</div>
                </div>
              </button>
              <button
                onClick={() => {
                  // TODO: Update selected template
                  handleSave();
                  setShowSaveModal(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-amber-300 transition text-left"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <FileEdit className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">Zmień wybrany formularz</div>
                  <div className="text-sm text-slate-500">Zaktualizuj istniejący szablon formularza</div>
                </div>
              </button>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Form Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eraser className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Wyczyść formularz?</h3>
              <p className="text-sm text-slate-500">
                Ta operacja usunie wszystkie zaznaczenia i dane ogólne formularza. Tej akcji nie można cofnąć.
              </p>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={() => {
                  // Clear all answers and general data
                  setAnswers(new Map());
                  setGeneralData({});
                  hasChangesRef.current = true;
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Wyczyść
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {showAddModal.type === 'group' && 'Dodaj dział'}
                {showAddModal.type === 'room' && 'Dodaj element'}
                {showAddModal.type === 'category' && 'Dodaj kategorię prac'}
                {showAddModal.type === 'workType' && 'Dodaj rodzaj pracy'}
              </h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Nazwa</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Wprowadź nazwę..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItemName.trim()) handleAddItem();
                  if (e.key === 'Escape') {
                    setShowAddModal(null);
                    setNewItemName('');
                  }
                }}
              />
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddModal(null);
                  setNewItemName('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddItem}
                disabled={!newItemName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Zapisz jako nowy szablon</h3>
              <p className="text-sm text-slate-500 mt-1">Utwórz szablon formularza do wielokrotnego użycia</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa szablonu *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="np. Szablon - Mieszkania IE"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Krótki opis szablonu..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Typ obiektu</label>
                <select
                  value={templateObjectType}
                  onChange={(e) => setTemplateObjectType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="residential">Mieszkaniowe</option>
                  <option value="industrial">Przemysłowe</option>
                  <option value="office">Biurowe</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rodzaj prac</label>
                <select
                  value={templateWorkType}
                  onChange={(e) => setTemplateWorkType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wybierz...</option>
                  {workTypesForTemplate.map((wt) => (
                    <option key={wt.id} value={wt.code}>{wt.code} - {wt.name}</option>
                  ))}
                </select>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Szablon zawiera:</div>
                <div className="text-sm text-slate-700">
                  <span className="font-medium">{template?.room_groups.length || 0}</span> działów,{' '}
                  <span className="font-medium">{template?.work_categories.length || 0}</span> kategorii prac
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateName('');
                  setTemplateDescription('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={async () => {
                  if (!templateName.trim() || !currentUser || !template) return;

                  try {
                    // Save the template to the database
                    const { error } = await supabase
                      .from('kosztorys_form_templates')
                      .insert({
                        company_id: currentUser.company_id,
                        name: templateName.trim(),
                        form_type: template.form_type,
                        object_type: templateObjectType,
                        work_type: templateWorkType,
                        template_data: {
                          title: template.title,
                          description: templateDescription.trim() || null,
                          general_fields: template.general_fields,
                          room_groups: template.room_groups,
                          work_categories: template.work_categories
                        },
                        is_active: true,
                        created_by_id: currentUser.id
                      });

                    if (error) throw error;

                    // Also save the current form
                    await handleSave();

                    setShowSaveTemplateModal(false);
                    setTemplateName('');
                    setTemplateDescription('');
                    alert('Szablon został zapisany pomyślnie!');
                  } catch (err) {
                    console.error('Error saving template:', err);
                    alert('Błąd podczas zapisywania szablonu');
                  }
                }}
                disabled={!templateName.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Zapisz szablon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Change Warning Modal */}
      {showTemplateChangeWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                Zmiana szablonu
              </h2>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Czy na pewno chcesz zmienić szablon dla <strong>{requestWorkTypes.find(wt => wt.code === activeWorkType)?.name || activeWorkType}</strong>?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <strong>Uwaga!</strong> Wszystkie dane wprowadzone w bieżącym formularzu zostaną utracone.
                    Ta operacja jest nieodwracalna.
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowTemplateChangeWarning(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
              <button
                onClick={() => {
                  setShowTemplateChangeWarning(false);
                  setShowTemplateSelectModal(true);
                }}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Tak, zmień szablon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Select Modal */}
      {showTemplateSelectModal && (() => {
        const isIndustrial = request?.object_type === 'industrial';
        // Determine work type (IE/IT) based on active work type code
        const activeWorkTypeCode = activeWorkType.toUpperCase();
        const isIEWorkType = activeWorkTypeCode.includes('IE') || activeWorkTypeCode.includes('ELEKTR');
        const isITWorkType = activeWorkTypeCode.includes('IT') || activeWorkTypeCode.includes('TELE');

        // All templates with work type compatibility info
        const allTemplates = [
          { code: 'PREM-IE', name: 'Przemysłowe - Instalacje elektryczne', desc: 'Hale produkcyjne, magazyny, obiekty przemysłowe', forWorkTypes: ['IE'], forObjectTypes: ['industrial'] },
          { code: 'PREM-IT', name: 'Przemysłowe - Instalacje teletechniczne', desc: 'Systemy IT, teletechnika dla obiektów przemysłowych', forWorkTypes: ['IT'], forObjectTypes: ['industrial'] },
          { code: 'MIESZK-IE', name: 'Mieszkania / Biurowce - Instalacje elektryczne', desc: 'Budynki mieszkalne, biurowce, obiekty użyteczności publicznej', forWorkTypes: ['IE'], forObjectTypes: ['residential', 'office'] },
          { code: 'MIESZK-IT', name: 'Mieszkania / Biurowce - Instalacje teletechniczne', desc: 'Systemy IT, teletechnika dla budynków mieszkalnych i biurowych', forWorkTypes: ['IT'], forObjectTypes: ['residential', 'office'] }
        ];

        // Filter templates by object type AND work type
        const availableTemplates = allTemplates.filter(t => {
          // Check object type
          const matchesObjectType = t.forObjectTypes.includes(request?.object_type || 'residential');
          // Check work type - match IE to IE templates, IT to IT templates
          const targetWorkType = isIEWorkType ? 'IE' : isITWorkType ? 'IT' : 'IE';
          const matchesWorkType = t.forWorkTypes.includes(targetWorkType);
          return matchesObjectType && matchesWorkType;
        });

        const currentTemplateCode = formsByWorkType[activeWorkType]?.template?.form_type;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-900">Wybierz nowy szablon</h2>
                <p className="text-slate-600 mt-1">
                  Dla: <strong>{requestWorkTypes.find(wt => wt.code === activeWorkType)?.name || activeWorkType}</strong>
                </p>
              </div>
              <div className="p-6 space-y-3">
                {availableTemplates.map(tmpl => (
                  <button
                    key={tmpl.code}
                    onClick={() => {
                      // Change template
                      const newTemplateObj = FORM_TEMPLATES[tmpl.code as KosztorysFormType];
                      setFormsByWorkType(prev => ({
                        ...prev,
                        [activeWorkType]: {
                          ...prev[activeWorkType],
                          template: newTemplateObj,
                          answers: new Map(), // Clear answers
                          generalData: {} // Clear general data
                        }
                      }));
                      setTemplate(newTemplateObj);
                      setAnswers(new Map());
                      setGeneralData({});
                      if (newTemplateObj) {
                        const allGroups = new Set(newTemplateObj.room_groups.map(g => g.code));
                        setExpandedGroups(allGroups);
                      }
                      hasChangesRef.current = true;
                      setShowTemplateSelectModal(false);
                    }}
                    disabled={tmpl.code === currentTemplateCode}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border transition text-left ${
                      tmpl.code === currentTemplateCode
                        ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      tmpl.code === currentTemplateCode ? 'bg-slate-200' : 'bg-blue-100'
                    }`}>
                      <FileSpreadsheet className={`w-6 h-6 ${
                        tmpl.code === currentTemplateCode ? 'text-slate-400' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {tmpl.name}
                        {tmpl.code === currentTemplateCode && (
                          <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                            Aktualny
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">{tmpl.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-6 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setShowTemplateSelectModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default FormularyPage;
