export const REGISTRATION_ROUTES = {
  BASE: '/inscription',
  IDENTITE: '/inscription/identite',
  VOCATION: '/inscription/vocation',
  CERCLES_AVATAR: '/inscription/cercles-avatar',
} as const;

export type RegistrationRoute =
  | typeof REGISTRATION_ROUTES.IDENTITE
  | typeof REGISTRATION_ROUTES.VOCATION
  | typeof REGISTRATION_ROUTES.CERCLES_AVATAR;

export type VocationSpecialty = 'medecine' | 'mentor' | 'etudiant' | 'chercheur';
export type ProfileRole = 'utilisateur' | 'mentor' | 'verifie';
export type PreferredLanguage = 'fr' | 'ha' | 'en';

export interface CountryDialOption {
  code: string;
  name: string;
  dial: string;
  flag: string;
  placeholder: string;
}

export const COUNTRY_DIAL_CODES: CountryDialOption[] = [
  { code: 'NE', name: 'Niger', dial: '+227', flag: '🇳🇪', placeholder: '90 12 34 56' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', flag: '🇨🇮', placeholder: '07 12 34 56 78' },
  { code: 'ML', name: 'Mali', dial: '+223', flag: '🇲🇱', placeholder: '70 12 34 56' },
  { code: 'SN', name: 'Sénégal', dial: '+221', flag: '🇸🇳', placeholder: '77 123 45 67' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226', flag: '🇧🇫', placeholder: '70 12 34 56' },
  { code: 'TG', name: 'Togo', dial: '+228', flag: '🇹🇬', placeholder: '90 12 34 56' },
  { code: 'BJ', name: 'Bénin', dial: '+229', flag: '🇧🇯', placeholder: '97 12 34 56' },
  { code: 'GN', name: 'Guinée', dial: '+224', flag: '🇬🇳', placeholder: '620 12 34 56' },
  { code: 'CM', name: 'Cameroun', dial: '+237', flag: '🇨🇲', placeholder: '670 12 34 56' },
  { code: 'TD', name: 'Tchad', dial: '+235', flag: '🇹🇩', placeholder: '66 12 34 56' },
  { code: 'MA', name: 'Maroc', dial: '+212', flag: '🇲🇦', placeholder: '612 34 56 78' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  { code: 'OTHER', name: 'Autre pays', dial: '+', flag: '🌍', placeholder: '22790123456' },
];

export const AVATAR_PRESETS = [
  {
    id: 'med-student-1',
    label: 'Étudiant Santé',
    url: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'med-student-2',
    label: 'Étudiante Santé',
    url: 'https://images.unsplash.com/photo-1594824813589-9800e84b2e15?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'scholar-1',
    label: 'Apprenant Universitaire',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'mentor-1',
    label: 'Mentor & Enseignant',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'practitioner-1',
    label: 'Praticienne Spécialiste',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'tech-1',
    label: 'Innovateur Digital',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
  },
];

export interface VocationOption {
  id: VocationSpecialty;
  title: string;
  subtitle: string;
  badge: string;
  badgeClass: string;
  role: ProfileRole;
  defaultBio: string;
}

export const VOCATION_OPTIONS: VocationOption[] = [
  {
    id: 'medecine',
    title: 'Étudiant Santé',
    subtitle: 'Médecine, soins & fiches',
    badge: 'Praticien',
    badgeClass: 'bg-blue-100 text-blue-800',
    role: 'verifie',
    defaultBio:
      "Étudiant en médecine passionné par la clinique, la pharmacologie et l'entraide médicale.",
  },
  {
    id: 'mentor',
    title: 'Enseignant',
    subtitle: 'Mentor, cours & partage',
    badge: 'Mentor',
    badgeClass: 'bg-amber-100 text-amber-800',
    role: 'mentor',
    defaultBio:
      "Enseignant & mentor guidant les apprenants dans l'assimilation des concepts clés.",
  },
  {
    id: 'etudiant',
    title: 'Apprenant',
    subtitle: 'Savoirs généraux & entraide',
    badge: 'Membre',
    badgeClass: 'bg-slate-200 text-slate-700',
    role: 'utilisateur',
    defaultBio:
      'Apprenant curieux explorant les savoirs et participant aux cercles thématiques.',
  },
  {
    id: 'chercheur',
    title: 'Chercheur',
    subtitle: 'Articles, veille & protocoles',
    badge: 'Expert',
    badgeClass: 'bg-purple-100 text-purple-800',
    role: 'verifie',
    defaultBio:
      'Chercheur et praticien partageant les avancées scientifiques et méthodologies.',
  },
];

export const MEDICAL_BIO_TEMPLATE =
  "Étudiant en médecine passionné par la clinique, la cardiologie et l'accès universel au savoir.";
