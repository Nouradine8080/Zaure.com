import React, { useState, useRef } from 'react';
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Stethoscope, 
  GraduationCap, 
  Lightbulb, 
  Microscope, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  KeyRound,
  Camera
} from 'lucide-react';
import { zaureService } from '../firebaseClient';
import { Circle, UserProfile } from '../types';
import { compressImageFile } from '../utils/imageCompressor';

interface AuthPortalProps {
  onAuthSuccess: (user: UserProfile) => void;
  circles: Circle[];
}

const AVATAR_PRESETS = [
  {
    id: 'med-student-1',
    label: 'Étudiant Santé',
    url: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'med-student-2',
    label: 'Étudiante Santé',
    url: 'https://images.unsplash.com/photo-1594824813589-9800e84b2e15?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'scholar-1',
    label: 'Apprenant Universitaire',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'mentor-1',
    label: 'Mentor & Enseignant',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'practitioner-1',
    label: 'Praticienne Spécialiste',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'tech-1',
    label: 'Innovateur Digital',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'
  }
];

export default function AuthPortal({ onAuthSuccess, circles }: AuthPortalProps) {
  // Mode: 'login' | 'register' | 'forgot_password'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  
  // Registration step (1 to 3)
  const [signupStep, setSignupStep] = useState<number>(1);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nom, setNom] = useState('');
  const [bio, setBio] = useState('');
  const [role, setRole] = useState<'utilisateur' | 'mentor' | 'verifie'>('utilisateur');
  const [specialty, setSpecialty] = useState<'medecine' | 'mentor' | 'etudiant' | 'chercheur'>('medecine');
  const [langue, setLangue] = useState<'fr' | 'ha' | 'en'>('fr');
  const [avatarUrl, setAvatarUrl] = useState<string>(AVATAR_PRESETS[0].url);
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
  
  const regAvatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressingRegAvatar, setIsCompressingRegAvatar] = useState(false);

  const handleRegAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingRegAvatar(true);
      const dataUrl = await compressImageFile(file, 250, 250, 0.8);
      setAvatarUrl(dataUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du traitement de la photo.');
    } finally {
      setIsCompressingRegAvatar(false);
      if (regAvatarFileInputRef.current) regAvatarFileInputRef.current.value = '';
    }
  };

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Phone Auth States
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifierInstance, setRecaptchaVerifierInstance] = useState<any>(null);

  const handleSendSmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!phoneNumber.trim() || !phoneNumber.startsWith('+')) {
      setErrorMessage('Veuillez entrer un numéro de téléphone valide au format international (ex: +22790123456).');
      return;
    }

    setIsLoading(true);
    try {
      if (recaptchaVerifierInstance) {
        try {
          recaptchaVerifierInstance.clear();
        } catch {
          // ignore
        }
      }
      const verifier = zaureService.createRecaptchaVerifier('recaptcha-container');
      setRecaptchaVerifierInstance(verifier);

      const { confirmationResult: res, error } = await zaureService.signInWithPhone(phoneNumber.trim(), verifier);
      if (error) {
        setErrorMessage(error);
      } else if (res) {
        setConfirmationResult(res);
        setSuccessMessage('Code SMS envoyé avec succès !');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l’envoi du SMS.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!smsCode.trim() || smsCode.length < 6) {
      setErrorMessage('Veuillez entrer le code de vérification SMS à 6 chiffres.');
      return;
    }

    setIsLoading(true);
    try {
      const { user, error } = await zaureService.confirmPhoneCode(confirmationResult, smsCode.trim(), {
        nom: nom.trim() || 'Membre Zaure',
        role,
        bio: bio.trim() || 'Inscrit par téléphone sur Zaure',
        langue,
        avatarUrl
      });
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Code SMS incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowPassword(false);
    setConfirmationResult(null);
    setSmsCode('');
  };

  const handleSpecialtySelect = (spec: 'medecine' | 'mentor' | 'etudiant' | 'chercheur') => {
    setSpecialty(spec);
    if (spec === 'medecine') {
      setRole('verifie');
      if (!bio || bio.startsWith('Étudiant') || bio.startsWith('Mentor') || bio.startsWith('Chercheur') || bio.startsWith('Membre') || bio.startsWith('Apprenant')) {
        setBio('Étudiant en médecine passionné par la clinique, la pharmacologie et l\'entraide médicale.');
      }
    } else if (spec === 'mentor') {
      setRole('mentor');
      if (!bio || bio.startsWith('Étudiant') || bio.startsWith('Mentor') || bio.startsWith('Chercheur') || bio.startsWith('Membre') || bio.startsWith('Apprenant')) {
        setBio('Enseignant & mentor guidant les apprenants dans l\'assimilation des concepts clés.');
      }
    } else if (spec === 'chercheur') {
      setRole('verifie');
      if (!bio || bio.startsWith('Étudiant') || bio.startsWith('Mentor') || bio.startsWith('Chercheur') || bio.startsWith('Membre') || bio.startsWith('Apprenant')) {
        setBio('Chercheur et praticien partageant les avancées scientifiques et méthodologies.');
      }
    } else {
      setRole('utilisateur');
      if (!bio || bio.startsWith('Étudiant') || bio.startsWith('Mentor') || bio.startsWith('Chercheur') || bio.startsWith('Membre') || bio.startsWith('Apprenant')) {
        setBio('Apprenant curieux explorant les savoirs et participant aux cercles thématiques.');
      }
    }
  };

  const toggleCircleSelect = (circleId: string) => {
    setSelectedCircleIds(prev => 
      prev.includes(circleId) ? prev.filter(id => id !== circleId) : [...prev, circleId]
    );
  };

  // Step validation
  const handleNextStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (signupStep === 1) {
      if (!nom.trim()) {
        setErrorMessage('Veuillez renseigner votre nom complet.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Veuillez saisir une adresse email valide.');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
        return;
      }
      if (!phoneNumber.trim() || !phoneNumber.startsWith('+')) {
        setErrorMessage('Veuillez entrer un numéro de téléphone valide au format international (+227..., +225..., +223..., +221..., +226...).');
        return;
      }
      if (passwordConfirm && password !== passwordConfirm) {
        setErrorMessage('Les deux mots de passe ne correspondent pas.');
        return;
      }
      setSignupStep(2);
    } else if (signupStep === 2) {
      if (!bio.trim()) {
        handleSpecialtySelect(specialty);
      }
      // Auto-select medical circles if list empty
      if (selectedCircleIds.length === 0 && circles.length > 0) {
        const medCircles = circles.filter(c => 
          c.categorie === 'Médecine' || 
          c.nom.toLowerCase().includes('santé') || 
          c.nom.toLowerCase().includes('méd')
        );
        if (medCircles.length > 0) {
          setSelectedCircleIds(medCircles.map(c => c.id));
        } else {
          setSelectedCircleIds(circles.slice(0, 2).map(c => c.id));
        }
      }
      setSignupStep(3);
    }
  };

  // Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Veuillez saisir votre adresse email.');
      return;
    }
    if (!password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsLoading(true);
    try {
      const { user, error } = await zaureService.signIn(email.trim(), password);
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  // Register Submit (Final step)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (signupStep < 3) {
      handleNextStep();
      return;
    }

    setIsLoading(true);
    try {
      const finalBio = bio.trim() || (
        specialty === 'medecine' 
          ? 'Étudiant en médecine passionné par la clinique et l\'entraide médicale.' 
          : 'Membre actif sur Zaure.'
      );

      const { user, error } = await zaureService.signUp(
        nom.trim(),
        email.trim(),
        finalBio,
        role,
        langue,
        password,
        avatarUrl,
        phoneNumber.trim()
      );

      if (error) {
        setErrorMessage(error);
        setIsLoading(false);
        return;
      }

      if (user) {
        // Auto-join chosen circles
        if (selectedCircleIds.length > 0) {
          for (const cId of selectedCircleIds) {
            await zaureService.joinCircle(cId, user.id);
          }
        }
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la création de votre compte.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const { user, error } = await zaureService.signInWithGoogle();
      if (error) {
        setErrorMessage(error);
      } else if (user) {
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Échec de la connexion avec Google.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Reset Submit
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Veuillez renseigner une adresse email valide.');
      return;
    }

    setIsLoading(true);
    try {
      const { success, error } = await zaureService.sendPasswordReset(email);
      if (error) {
        setErrorMessage(error);
      } else if (success) {
        setSuccessMessage(`Un lien de réinitialisation sécurisé a été envoyé à ${email}. Vérifiez votre boîte de réception.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l\'envoi du lien de réinitialisation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col justify-between text-slate-800 font-sans selection:bg-blue-100">
      {/* Top Banner on Mobile */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
            Z
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black text-blue-600 tracking-tight">Zaure</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
          </div>
        </div>
        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
          Partage du Savoir
        </span>
      </header>

      {/* Main Split Layout Inspired by Facebook */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 lg:py-24 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-14">
        
        {/* Left Column: Brand & Value Proposition (Facebook-inspired) */}
        <section className="w-full lg:w-[54%] text-center lg:text-left pt-2 lg:pt-0">
          <div className="hidden lg:flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-sm">
              Z
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl lg:text-5xl font-black text-blue-600 tracking-tight">
                Zaure
              </h1>
              <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-[28px] font-bold text-slate-900 leading-snug lg:leading-normal max-w-xl mx-auto lg:mx-0">
            Avec Zaure, partagez vos savoirs, découvrez des cercles d'apprentissage et progressez au sein de la communauté.
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Une plateforme collaborative dédiée aux étudiants en médecine, chercheurs, enseignants et passionnés de sciences.
          </p>

          {/* Value Badges */}
          <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto lg:mx-0 text-left">
            <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">Savoirs Médicaux & Cliniques</p>
                <p className="text-[11px] text-slate-500 truncate">Fiches de sémiologie & pharmacologie</p>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">Capsules Vocales & Écrites</p>
                <p className="text-[11px] text-slate-500 truncate">Français, Hausa & Anglais</p>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">Cercles & Mentorat</p>
                <p className="text-[11px] text-slate-500 truncate">Groupes d'études par discipline</p>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">Sécurité Firebase</p>
                <p className="text-[11px] text-slate-500 truncate">Données chiffrées & profils vérifiés</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Facebook-Inspired Authentication Card */}
        <section className="w-full lg:w-[46%] max-w-[430px] mx-auto">
          
          {/* Main Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-xl sm:shadow-2xl border border-slate-200/90 relative">
            
            {/* Notifications / Errors */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium flex-1">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium flex-1">{successMessage}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* VUE 1 : CONNEXION DIRECTE                                */}
            {/* ======================================================== */}
            {authMode === 'login' && (
              <>
                <div className="flex p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => { setAuthMethod('email'); resetFormState(); }}
                    className={`flex-1 py-2 rounded-lg transition ${authMethod === 'email' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
                  >
                    Par Email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMethod('phone'); resetFormState(); }}
                    className={`flex-1 py-2 rounded-lg transition ${authMethod === 'phone' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
                  >
                    Par Téléphone (SMS)
                  </button>
                </div>

                {authMethod === 'email' ? (
                  <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                    <div>
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="Adresse e-mail universitaire ou personnelle"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full text-sm px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mot de passe"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full text-sm pl-4 pr-11 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 placeholder:text-slate-400 bg-slate-50 focus:bg-white transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          Connexion en cours...
                        </span>
                      ) : (
                        <span>Se connecter</span>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3.5">
                    {!confirmationResult ? (
                      <form onSubmit={handleSendSmsCode} className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Numéro de téléphone (Format international ex: +227...)
                          </label>
                          <input
                            type="tel"
                            placeholder="+227 90 12 34 56"
                            required
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full text-sm px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                          />
                        </div>

                        <div id="recaptcha-container" className="my-2 flex justify-center"></div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isLoading ? 'Envoi du SMS...' : 'Envoyer le code SMS'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifySmsCode} className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Code de vérification SMS (6 chiffres)
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="123456"
                            required
                            value={smsCode}
                            onChange={(e) => setSmsCode(e.target.value)}
                            className="w-full text-center tracking-widest text-lg font-mono px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-xl transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isLoading ? 'Vérification...' : 'Valider le code & Se connecter'}
                        </button>

                        <button
                          type="button"
                          onClick={() => { setConfirmationResult(null); setSmsCode(''); }}
                          className="w-full text-center text-xs text-blue-600 hover:underline pt-2 font-semibold"
                        >
                          ← Utiliser un autre numéro ou méthode
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setAuthMode('forgot_password');
                    }}
                    className="text-xs text-blue-700 hover:text-blue-800 font-semibold hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                {/* Divider Line */}
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase font-bold tracking-wider">OU</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 rounded-xl transition shadow-2xs flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.5 0 2.85.51 3.9 1.5l2.9-2.9C17.05 1.9 14.7 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.5 2.7C5.85 6.95 8.7 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.46-1.1 2.69-2.34 3.52l3.63 2.82c2.13-1.97 3.36-4.87 3.36-8.47z" />
                    <path fill="#FBBC05" d="M5 14.8c-.25-.75-.39-1.55-.39-2.38s.14-1.63.39-2.38L1.5 7.34C.55 9.24 0 11.36 0 13.6s.55 4.36 1.5 6.26l3.5-2.06z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.82c-1.01.68-2.3 1.09-3.9 1.09-3.3 0-6.15-1.91-7.15-4.78l-3.5 2.7C3.4 20.35 7.35 23 12 23z" />
                  </svg>
                  <span>Continuer avec Google</span>
                </button>

                {/* Create Account High-Impact Button (Facebook green/crimson style) */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setSignupStep(1);
                      setAuthMode('register');
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-extrabold text-sm rounded-xl transition shadow-sm inline-flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>Créer un nouveau compte</span>
                  </button>
                </div>
              </>
            )}

            {/* ======================================================== */}
            {/* VUE 2 : CRÉATION DE COMPTE À ÉTAPES                     */}
            {/* ======================================================== */}
            {authMode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                
                {/* Stepper Header */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">S'inscrire sur Zaure</h3>
                      <p className="text-xs text-slate-500">C'est rapide, gratuit et ouvert à tous.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        resetFormState();
                        setAuthMode('login');
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      Annuler
                    </button>
                  </div>

                  {/* Stepper Indicators */}
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mt-3 px-1">
                    <span className={signupStep === 1 ? 'text-blue-700 font-black' : signupStep > 1 ? 'text-emerald-600' : 'text-slate-400'}>
                      1. Identité
                    </span>
                    <span className="text-slate-300">›</span>
                    <span className={signupStep === 2 ? 'text-blue-700 font-black' : signupStep > 2 ? 'text-emerald-600' : 'text-slate-400'}>
                      2. Vocation
                    </span>
                    <span className="text-slate-300">›</span>
                    <span className={signupStep === 3 ? 'text-blue-700 font-black' : 'text-slate-400'}>
                      3. Cercles & Avatar
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-red-600 transition-all duration-300 rounded-full"
                      style={{ width: signupStep === 1 ? '33.3%' : signupStep === 2 ? '66.6%' : '100%' }}
                    />
                  </div>
                </div>

                {/* Étape 1 : Identité */}
                {signupStep === 1 && (
                  <div className="space-y-3 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Nom et Prénom <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="Ex: Mahamadou Garba"
                          required
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Adresse e-mail <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          placeholder="Ex: mahamadou@zaure.org"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Numéro de téléphone (SMS - Niger, CI, Mali, Sénégal, Burkina) <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {[
                          { code: '+227', label: '🇳🇪 NE' },
                          { code: '+225', label: '🇨🇮 CI' },
                          { code: '+223', label: '🇲🇱 ML' },
                          { code: '+221', label: '🇸🇳 SN' },
                          { code: '+226', label: '🇧🇫 BF' },
                        ].map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              const clean = phoneNumber.replace(/^\+\d+/, '').trim();
                              setPhoneNumber(c.code + (clean ? clean : ''));
                            }}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                              phoneNumber.startsWith(c.code)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {c.label} ({c.code})
                          </button>
                        ))}
                      </div>
                      <input
                        type="tel"
                        placeholder="+227 90 12 34 56"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Mot de passe <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 6 car."
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full text-xs pl-3.5 pr-8 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Confirmation
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Répétez"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleNextStep()}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2"
                      >
                        <span>Continuer vers l'étape 2 (Profil & Vocation)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Étape 2 : Vocation & Profil */}
                {signupStep === 2 && (
                  <div className="space-y-3 animate-fadeIn">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Sélectionnez votre profil :
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSpecialtySelect('medecine')}
                        className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                          specialty === 'medecine'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <Stethoscope className={`w-4 h-4 mt-0.5 ${specialty === 'medecine' ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 leading-tight">Étudiant Santé</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Médecine & Soins</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSpecialtySelect('mentor')}
                        className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                          specialty === 'mentor'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <GraduationCap className={`w-4 h-4 mt-0.5 ${specialty === 'mentor' ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 leading-tight">Enseignant</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Mentor & Cours</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSpecialtySelect('etudiant')}
                        className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                          specialty === 'etudiant'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <Lightbulb className={`w-4 h-4 mt-0.5 ${specialty === 'etudiant' ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 leading-tight">Apprenant</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Savoirs généraux</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSpecialtySelect('chercheur')}
                        className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                          specialty === 'chercheur'
                            ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <Microscope className={`w-4 h-4 mt-0.5 ${specialty === 'chercheur' ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 leading-tight">Chercheur</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Articles & Veille</p>
                        </div>
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700">Votre biographie</label>
                        <button
                          type="button"
                          onClick={() => setBio("Étudiant en médecine passionné par la clinique, la cardiologie et l'accès universel au savoir.")}
                          className="text-[10px] font-bold text-blue-700 hover:underline"
                        >
                          + Modèle médical
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Ex: Étudiant en médecine, Dakar..."
                        className="w-full text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Langue préférée</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setLangue('fr')}
                          className={`py-1.5 rounded-lg border text-xs font-bold transition ${
                            langue === 'fr' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          🇫🇷 Français
                        </button>
                        <button
                          type="button"
                          onClick={() => setLangue('ha')}
                          className={`py-1.5 rounded-lg border text-xs font-bold transition ${
                            langue === 'ha' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          🌍 Hausa
                        </button>
                        <button
                          type="button"
                          onClick={() => setLangue('en')}
                          className={`py-1.5 rounded-lg border text-xs font-bold transition ${
                            langue === 'en' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          🇬🇧 English
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setSignupStep(1)}
                        className="px-3.5 py-2 border border-slate-200 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-bold transition"
                      >
                        ← Retour
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNextStep()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
                      >
                        <span>Étape 3 (Cercles)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Étape 3 : Avatar & Cercles */}
                {signupStep === 3 && (
                  <div className="space-y-3 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Photo de profil / Avatar
                      </label>

                      <input
                        ref={regAvatarFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleRegAvatarFileChange}
                        className="hidden"
                      />

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 mb-2 flex items-center gap-3">
                        <img
                          src={avatarUrl}
                          alt="Aperçu avatar"
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => regAvatarFileInputRef.current?.click()}
                            disabled={isCompressingRegAvatar}
                            className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Camera className="w-3.5 h-3.5 text-blue-600" />
                            <span>
                              {isCompressingRegAvatar ? 'Traitement photo...' : '📸 Importez votre photo (Galerie)'}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Ou choisir un modèle :</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {AVATAR_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setAvatarUrl(preset.url)}
                            className={`relative rounded-xl overflow-hidden aspect-square border-2 transition ${
                              avatarUrl === preset.url
                                ? 'border-blue-600 ring-2 ring-blue-500/40 scale-105'
                                : 'border-transparent opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                            {avatarUrl === preset.url && (
                              <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Rejoindre vos premiers cercles :
                      </label>
                      <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {circles.map((c) => {
                          const isSelected = selectedCircleIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleCircleSelect(c.id)}
                              className={`p-2 rounded-xl border text-left transition flex items-center justify-between text-xs ${
                                isSelected 
                                  ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold' 
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={c.image} alt={c.nom} className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
                                <span className="truncate">{c.nom}</span>
                              </div>
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300 text-transparent'
                              }`}>
                                ✓
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setSignupStep(2)}
                        className="px-3.5 py-2 border border-slate-200 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-bold transition"
                      >
                        ← Retour
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            Création...
                          </span>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Finaliser mon inscription</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Back to Login link */}
                <div className="text-center pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setAuthMode('login');
                    }}
                    className="text-xs text-blue-700 hover:underline font-bold"
                  >
                    Vous avez déjà un compte ? Se connecter
                  </button>
                </div>
              </form>
            )}

            {/* ======================================================== */}
            {/* VUE 3 : MOT DE PASSE OUBLIÉ                             */}
            {/* ======================================================== */}
            {authMode === 'forgot_password' && (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Retrouvez votre compte</h3>
                    <p className="text-[11px] text-slate-500">Réinitialisation sécurisée par e-mail.</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Saisissez l'adresse e-mail associée à votre compte Zaure. Nous vous enverrons un lien officiel Firebase pour réinitialiser votre mot de passe.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Adresse e-mail du compte
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      placeholder="Ex: mahamadou@zaure.org"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900 bg-slate-50 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormState();
                      setAuthMode('login');
                    }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-bold transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Envoi...
                      </span>
                    ) : (
                      <span>Envoyer le lien</span>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>

          {/* Facebook-style Card Footer Note */}
          <div className="mt-6 text-center text-xs text-slate-500">
            <p>
              <strong className="text-slate-700 font-bold">Créer un espace</strong> pour une faculté de médecine, un laboratoire ou un groupe de recherche.
            </p>
          </div>
        </section>

      </main>

      {/* Footer (Facebook-style minimal footer) */}
      <footer className="bg-white border-t border-slate-200/80 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-600">Zaure Platform</span>
            <span>•</span>
            <span>Français</span>
            <span>•</span>
            <span>Hausa</span>
            <span>•</span>
            <span>English</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} Zaure • Firebase Authenticated Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
