import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  AVATAR_PRESETS,
  COUNTRY_DIAL_CODES,
  PreferredLanguage,
  ProfileRole,
  VOCATION_OPTIONS,
  VocationSpecialty,
} from '../constants/registration';
import { zaureService } from '../firebaseClient';
import { Circle, UserProfile } from '../types';

const DRAFT_STORAGE_KEY = 'zaure_registration_draft_v1';

export interface RegistrationDraft {
  nom: string;
  email: string;
  countryCode: string;
  dialCode: string;
  phoneLocal: string;
  password: string;
  passwordConfirm: string;
  specialty: VocationSpecialty;
  role: ProfileRole;
  bio: string;
  langue: PreferredLanguage;
  avatarUrl: string;
  selectedCircleIds: string[];
  autoSelectedCirclesApplied: boolean;
  step1Validated: boolean;
  step2Validated: boolean;
}

const DEFAULT_DRAFT: RegistrationDraft = {
  nom: '',
  email: '',
  countryCode: 'NE',
  dialCode: '+227',
  phoneLocal: '',
  password: '',
  passwordConfirm: '',
  specialty: 'medecine',
  role: 'verifie',
  bio: '',
  langue: 'fr',
  avatarUrl: AVATAR_PRESETS[0].url,
  selectedCircleIds: [],
  autoSelectedCirclesApplied: false,
  step1Validated: false,
  step2Validated: false,
};

function loadSavedDraft(): RegistrationDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<RegistrationDraft>;
    return {
      ...DEFAULT_DRAFT,
      ...parsed,
      selectedCircleIds: Array.isArray(parsed.selectedCircleIds) ? parsed.selectedCircleIds : [],
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function persistDraft(draft: RegistrationDraft) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Handle storage quota edge case (e.g. if an unusually large avatar string exceeded storage)
    try {
      const compactDraft = { ...draft, avatarUrl: AVATAR_PRESETS[0].url };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(compactDraft));
    } catch {
      // Ignore if sessionStorage is unavailable
    }
  }
}

export function buildInternationalPhone(dialCode: string, phoneLocal: string): string {
  const cleanDial = dialCode.trim();
  const rawLocal = phoneLocal.trim();
  if (!rawLocal) return '';
  // If user pasted a full +... number in local field, normalize cleanly
  if (rawLocal.startsWith('+')) {
    return '+' + rawLocal.replace(/[^\d]/g, '');
  }
  const digits = rawLocal.replace(/[^\d]/g, '').replace(/^0+(?=\d{6,})/, '');
  if (!digits) return '';
  if (cleanDial === '+') {
    return '+' + digits;
  }
  const dialDigits = cleanDial.replace(/[^\d]/g, '');
  if (digits.startsWith(dialDigits) && digits.length >= dialDigits.length + 7) {
    return '+' + digits;
  }
  return `+${dialDigits}${digits}`;
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isStep1DataValid(draft: RegistrationDraft): string | null {
  if (!draft.nom.trim() || draft.nom.trim().length < 2) {
    return 'Veuillez renseigner votre nom et prénom (au moins 2 caractères).';
  }
  if (!draft.email.trim() || !isValidEmailFormat(draft.email)) {
    return 'Veuillez saisir une adresse e-mail valide.';
  }
  const fullPhone = buildInternationalPhone(draft.dialCode, draft.phoneLocal);
  const digitsCount = fullPhone.replace(/[^\d]/g, '').length;
  if (!fullPhone.startsWith('+') || digitsCount < 8 || digitsCount > 15) {
    return 'Veuillez saisir un numéro de téléphone valide avec l’indicatif du pays.';
  }
  if (!draft.password || draft.password.length < 6) {
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  if (!draft.passwordConfirm) {
    return 'Veuillez confirmer votre mot de passe.';
  }
  if (draft.password !== draft.passwordConfirm) {
    return 'Les deux mots de passe ne correspondent pas.';
  }
  return null;
}

export function isStep2DataValid(draft: RegistrationDraft): string | null {
  if (!draft.specialty) {
    return 'Veuillez sélectionner votre profil ou vocation.';
  }
  if (!draft.langue) {
    return 'Veuillez choisir votre langue préférée.';
  }
  return null;
}

interface RegistrationContextValue {
  draft: RegistrationDraft;
  fullPhoneNumber: string;
  isStep1Complete: boolean;
  isStep2Complete: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  emailAlreadyInUse: boolean;
  setErrorMessage: (msg: string | null) => void;
  updateFields: (partial: Partial<RegistrationDraft>) => void;
  selectCountry: (countryCode: string) => void;
  handlePhoneLocalChange: (value: string) => void;
  selectSpecialty: (spec: VocationSpecialty) => void;
  toggleCircleSelect: (circleId: string) => void;
  autoSelectInitialCircles: (circles: Circle[]) => void;
  validateAndCompleteStep1: () => Promise<boolean>;
  validateAndCompleteStep2: (circles: Circle[]) => boolean;
  finalizeRegistration: (onSuccess: (user: UserProfile) => void) => Promise<boolean>;
  clearDraft: () => void;
}

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export const RegistrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [draft, setDraft] = useState<RegistrationDraft>(() => loadSavedDraft());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailAlreadyInUse, setEmailAlreadyInUse] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    persistDraft(draft);
  }, [draft]);

  const updateFields = useCallback((partial: Partial<RegistrationDraft>) => {
    setErrorMessage(null);
    if (partial.email !== undefined) {
      setEmailAlreadyInUse(false);
    }
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const selectCountry = useCallback((countryCode: string) => {
    const match = COUNTRY_DIAL_CODES.find((c) => c.code === countryCode);
    if (!match) return;
    setErrorMessage(null);
    setDraft((prev) => ({
      ...prev,
      countryCode: match.code,
      dialCode: match.dial,
    }));
  }, []);

  const handlePhoneLocalChange = useCallback((value: string) => {
    setErrorMessage(null);
    const trimmed = value.trimStart();
    if (trimmed.startsWith('+')) {
      // Detect matching country prefix automatically if user pastes full international format
      const sorted = [...COUNTRY_DIAL_CODES]
        .filter((c) => c.dial !== '+')
        .sort((a, b) => b.dial.length - a.dial.length);
      const compact = '+' + trimmed.replace(/[^\d]/g, '');
      const matched = sorted.find((c) => compact.startsWith(c.dial));
      if (matched) {
        setDraft((prev) => ({
          ...prev,
          countryCode: matched.code,
          dialCode: matched.dial,
          phoneLocal: compact.slice(matched.dial.length),
        }));
        return;
      }
      setDraft((prev) => ({
        ...prev,
        countryCode: 'OTHER',
        dialCode: '+',
        phoneLocal: compact.slice(1),
      }));
      return;
    }

    setDraft((prev) => ({
      ...prev,
      phoneLocal: value.replace(/[^\d\s-]/g, ''),
    }));
  }, []);

  const selectSpecialty = useCallback((spec: VocationSpecialty) => {
    const option = VOCATION_OPTIONS.find((v) => v.id === spec);
    if (!option) return;
    setErrorMessage(null);
    setDraft((prev) => {
      const hasDefaultOrEmptyBio =
        !prev.bio.trim() ||
        VOCATION_OPTIONS.some((v) => v.defaultBio === prev.bio.trim()) ||
        prev.bio.startsWith('Étudiant') ||
        prev.bio.startsWith('Enseignant') ||
        prev.bio.startsWith('Mentor') ||
        prev.bio.startsWith('Chercheur') ||
        prev.bio.startsWith('Apprenant') ||
        prev.bio.startsWith('Membre');

      return {
        ...prev,
        specialty: spec,
        role: option.role,
        bio: hasDefaultOrEmptyBio ? option.defaultBio : prev.bio,
      };
    });
  }, []);

  const toggleCircleSelect = useCallback((circleId: string) => {
    setDraft((prev) => {
      const exists = prev.selectedCircleIds.includes(circleId);
      return {
        ...prev,
        autoSelectedCirclesApplied: true,
        selectedCircleIds: exists
          ? prev.selectedCircleIds.filter((id) => id !== circleId)
          : [...prev.selectedCircleIds, circleId],
      };
    });
  }, []);

  const autoSelectInitialCircles = useCallback((circles: Circle[]) => {
    setDraft((prev) => {
      if (prev.autoSelectedCirclesApplied || prev.selectedCircleIds.length > 0 || circles.length === 0) {
        return prev;
      }
      const medCircles = circles.filter(
        (c) =>
          c.categorie === 'Médecine' ||
          c.nom.toLowerCase().includes('santé') ||
          c.nom.toLowerCase().includes('méd')
      );
      const suggestedIds =
        medCircles.length > 0
          ? medCircles.map((c) => c.id)
          : circles.slice(0, 2).map((c) => c.id);

      return {
        ...prev,
        selectedCircleIds: suggestedIds,
        autoSelectedCirclesApplied: true,
      };
    });
  }, []);

  const validateAndCompleteStep1 = useCallback(async (): Promise<boolean> => {
    setErrorMessage(null);
    setEmailAlreadyInUse(false);
    const err = isStep1DataValid(draft);
    if (err) {
      setErrorMessage(err);
      return false;
    }

    setIsSubmitting(true);
    try {
      const check = await zaureService.checkEmailAvailable(draft.email);
      if (!check.available) {
        setEmailAlreadyInUse(true);
        setErrorMessage(
          check.error ||
            'Cette adresse e-mail est déjà utilisée par un autre compte. Veuillez vous connecter.'
        );
        return false;
      }

      const nextDraft: RegistrationDraft = {
        ...draft,
        email: draft.email.trim().toLowerCase(),
        step1Validated: true,
      };
      persistDraft(nextDraft);
      setDraft(nextDraft);
      return true;
    } finally {
      setIsSubmitting(false);
    }
  }, [draft]);

  const validateAndCompleteStep2 = useCallback(
    (circles: Circle[]): boolean => {
      setErrorMessage(null);
      const err = isStep2DataValid(draft);
      if (err) {
        setErrorMessage(err);
        return false;
      }

      const selectedOpt = VOCATION_OPTIONS.find((v) => v.id === draft.specialty);
      const nextBio = draft.bio.trim() ? draft.bio : selectedOpt?.defaultBio || 'Membre actif sur Zaure.';
      let nextCircleIds = draft.selectedCircleIds;
      let autoApplied = draft.autoSelectedCirclesApplied;
      if (!autoApplied && nextCircleIds.length === 0 && circles.length > 0) {
        const medCircles = circles.filter(
          (c) =>
            c.categorie === 'Médecine' ||
            c.nom.toLowerCase().includes('santé') ||
            c.nom.toLowerCase().includes('méd')
        );
        nextCircleIds =
          medCircles.length > 0
            ? medCircles.map((c) => c.id)
            : circles.slice(0, 2).map((c) => c.id);
        autoApplied = true;
      }

      const nextDraft: RegistrationDraft = {
        ...draft,
        bio: nextBio,
        selectedCircleIds: nextCircleIds,
        autoSelectedCirclesApplied: autoApplied,
        step1Validated: true,
        step2Validated: true,
      };
      persistDraft(nextDraft);
      setDraft(nextDraft);
      return true;
    },
    [draft]
  );

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setDraft(DEFAULT_DRAFT);
    setErrorMessage(null);
    setEmailAlreadyInUse(false);
  }, []);

  const finalizeRegistration = useCallback(
    async (onSuccess: (user: UserProfile) => void): Promise<boolean> => {
      if (submittingRef.current) return false;
      setErrorMessage(null);
      setEmailAlreadyInUse(false);

      const step1Err = isStep1DataValid(draft);
      if (step1Err) {
        setErrorMessage(step1Err);
        return false;
      }

      submittingRef.current = true;
      setIsSubmitting(true);

      try {
        const selectedOpt = VOCATION_OPTIONS.find((v) => v.id === draft.specialty);
        const finalBio = draft.bio.trim() || selectedOpt?.defaultBio || 'Membre actif sur Zaure.';
        const fullPhone = buildInternationalPhone(draft.dialCode, draft.phoneLocal);

        const { user, error } = await zaureService.signUp(
          draft.nom.trim(),
          draft.email.trim().toLowerCase(),
          finalBio,
          draft.role,
          draft.langue,
          draft.password,
          draft.avatarUrl || AVATAR_PRESETS[0].url,
          fullPhone
        );

        if (error) {
          if (
            error.toLowerCase().includes('déjà utilisée') ||
            error.toLowerCase().includes('already')
          ) {
            setEmailAlreadyInUse(true);
          }
          setErrorMessage(error);
          return false;
        }

        if (user) {
          if (draft.selectedCircleIds.length > 0) {
            await Promise.all(
              draft.selectedCircleIds.map((cId) => zaureService.joinCircle(cId, user.id).catch(() => false))
            );
          }
          clearDraft();
          onSuccess(user);
          return true;
        }

        setErrorMessage("La création du compte n'a pas pu aboutir. Veuillez réessayer.");
        return false;
      } catch (err: any) {
        setErrorMessage(err?.message || 'Erreur lors de la création de votre compte.');
        return false;
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [draft, clearDraft]
  );

  const fullPhoneNumber = buildInternationalPhone(draft.dialCode, draft.phoneLocal);
  const isStep1Complete = draft.step1Validated && isStep1DataValid(draft) === null;
  const isStep2Complete = isStep1Complete && draft.step2Validated && isStep2DataValid(draft) === null;

  return (
    <RegistrationContext.Provider
      value={{
        draft,
        fullPhoneNumber,
        isStep1Complete,
        isStep2Complete,
        isSubmitting,
        errorMessage,
        emailAlreadyInUse,
        setErrorMessage,
        updateFields,
        selectCountry,
        handlePhoneLocalChange,
        selectSpecialty,
        toggleCircleSelect,
        autoSelectInitialCircles,
        validateAndCompleteStep1,
        validateAndCompleteStep2,
        finalizeRegistration,
        clearDraft,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
};

export function useRegistration() {
  const ctx = useContext(RegistrationContext);
  if (!ctx) {
    throw new Error('useRegistration must be used inside a RegistrationProvider');
  }
  return ctx;
}
