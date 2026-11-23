import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_AVATAR_URL,
} from '../constants/registration';
import { zaureService } from '../firebaseClient';
import { UserProfile } from '../types';

const LEGACY_DRAFT_STORAGE_KEY = 'zaure_registration_draft_v1';
const DRAFT_STORAGE_KEY = 'zaure_registration_draft_v2';

export interface RegistrationDraft {
  nom: string;
  email: string;
  countryCode: string;
  dialCode: string;
  phoneLocal: string;
  password: string;
  passwordConfirm: string;
  acceptedTerms: boolean;
}

const DEFAULT_DRAFT: RegistrationDraft = {
  nom: '',
  email: '',
  countryCode: 'NE',
  dialCode: '+227',
  phoneLocal: '',
  password: '',
  passwordConfirm: '',
  acceptedTerms: false,
};

function loadSavedDraft(): RegistrationDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<RegistrationDraft>;
    return {
      ...DEFAULT_DRAFT,
      nom: typeof parsed.nom === 'string' ? parsed.nom : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      countryCode: typeof parsed.countryCode === 'string' ? parsed.countryCode : DEFAULT_DRAFT.countryCode,
      dialCode: typeof parsed.dialCode === 'string' ? parsed.dialCode : DEFAULT_DRAFT.dialCode,
      phoneLocal: typeof parsed.phoneLocal === 'string' ? parsed.phoneLocal : '',
      password: typeof parsed.password === 'string' ? parsed.password : '',
      passwordConfirm: typeof parsed.passwordConfirm === 'string' ? parsed.passwordConfirm : '',
      acceptedTerms: Boolean(parsed.acceptedTerms),
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function persistDraft(draft: RegistrationDraft) {
  try {
    // Do not persist raw passwords unnecessarily beyond active form, keep other fields resilient
    const safeDraft: RegistrationDraft = {
      ...draft,
      password: '',
      passwordConfirm: '',
    };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(safeDraft));
  } catch {
    // Ignore if sessionStorage is unavailable
  }
}

export function buildInternationalPhone(dialCode: string, phoneLocal: string): string {
  const cleanDial = dialCode.trim();
  const rawLocal = phoneLocal.trim();
  if (!rawLocal) return '';
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

export function validateRegistrationDraft(draft: RegistrationDraft): string | null {
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
  if (!draft.acceptedTerms) {
    return "Veuillez accepter les conditions d'utilisation et la politique de confidentialité.";
  }
  return null;
}

interface RegistrationContextValue {
  draft: RegistrationDraft;
  fullPhoneNumber: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  emailAlreadyInUse: boolean;
  setErrorMessage: (msg: string | null) => void;
  updateFields: (partial: Partial<RegistrationDraft>) => void;
  selectCountry: (countryCode: string) => void;
  handlePhoneLocalChange: (value: string) => void;
  submitRegistration: (onSuccess: (user: UserProfile) => void) => Promise<boolean>;
  signInWithGoogle: (onSuccess: (user: UserProfile) => void) => Promise<boolean>;
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

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setDraft(DEFAULT_DRAFT);
    setErrorMessage(null);
    setEmailAlreadyInUse(false);
  }, []);

  const submitRegistration = useCallback(
    async (onSuccess: (user: UserProfile) => void): Promise<boolean> => {
      if (submittingRef.current) return false;
      setErrorMessage(null);
      setEmailAlreadyInUse(false);

      const validationError = validateRegistrationDraft(draft);
      if (validationError) {
        setErrorMessage(validationError);
        return false;
      }

      submittingRef.current = true;
      setIsSubmitting(true);

      try {
        const normalizedEmail = draft.email.trim().toLowerCase();
        const fullPhone = buildInternationalPhone(draft.dialCode, draft.phoneLocal);

        const check = await zaureService.checkEmailAvailable(normalizedEmail);
        if (!check.available) {
          setEmailAlreadyInUse(true);
          setErrorMessage(
            check.error ||
              'Cette adresse e-mail est déjà associée à un compte Zaure. Veuillez vous connecter.'
          );
          return false;
        }

        const { user, error } = await zaureService.signUp(
          draft.nom.trim(),
          normalizedEmail,
          '',
          'utilisateur',
          'fr',
          draft.password,
          DEFAULT_AVATAR_URL,
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

  const signInWithGoogle = useCallback(
    async (onSuccess: (user: UserProfile) => void): Promise<boolean> => {
      if (submittingRef.current) return false;
      setErrorMessage(null);
      setEmailAlreadyInUse(false);
      submittingRef.current = true;
      setIsSubmitting(true);

      try {
        const { user, error } = await zaureService.signInWithGoogle();
        if (error) {
          setErrorMessage(error);
          return false;
        }
        if (user) {
          clearDraft();
          onSuccess(user);
          return true;
        }
        setErrorMessage('La connexion avec Google n’a pas pu aboutir.');
        return false;
      } catch (err: any) {
        setErrorMessage(err?.message || 'Échec de la connexion avec Google.');
        return false;
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [clearDraft]
  );

  const fullPhoneNumber = buildInternationalPhone(draft.dialCode, draft.phoneLocal);

  return (
    <RegistrationContext.Provider
      value={{
        draft,
        fullPhoneNumber,
        isSubmitting,
        errorMessage,
        emailAlreadyInUse,
        setErrorMessage,
        updateFields,
        selectCountry,
        handlePhoneLocalChange,
        submitRegistration,
        signInWithGoogle,
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
