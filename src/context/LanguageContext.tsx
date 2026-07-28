import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';

export type Language = 'fr' | 'ha' | 'en';

export const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Header & Common
    'app.title': 'Zauré',
    'app.subtitle': 'La plateforme de partage de savoirs communautaires',
    'nav.feed': 'Fil de Savoir',
    'nav.chat': 'Discussion Directe',
    'nav.settings': 'Paramètres',
    'nav.login': 'Connexion',
    'nav.logout': 'Déconnexion',
    'nav.signup': "S'inscrire",
    'common.close': 'Fermer',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.delete': 'Supprimer',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.all': 'Tous les cercles',
    'common.my_circles': 'Mes cercles rejoins',
    'common.public': 'Public',

    // Feed & Filters
    'feed.title': 'Fil des capsules de savoir',
    'feed.filter_all': 'Toutes les capsules',
    'feed.filter_joined': 'Uniquement mes cercles',
    'feed.empty_title': 'Aucune capsule disponible',
    'feed.empty_desc': 'Rejoignez des cercles ou publiez une capsule vocale/texte pour partager vos connaissances !',
    'feed.create_circle_btn': 'Nouveau Cercle',
    'feed.create_capsule_btn': 'Partager un Savoir',

    // Circles
    'circles.title': 'Cercles de Savoir',
    'circles.subtitle': "Espaces d'échange et d'apprentissage",
    'circles.empty': 'Aucun cercle de savoir pour le moment',
    'circles.empty_desc': 'Créer votre propre cercle pour démarrer la communauté !',
    'circles.join': 'Rejoindre',
    'circles.joined': 'Rejoint',
    'circles.joined_leave': 'Rejoint (Quitter)',
    'circles.leave': 'Quitter',
    'circles.members': 'membres',
    'circles.create_modal_title': 'Créer un nouveau Cercle de Savoir',
    'circles.name': 'Nom du cercle',
    'circles.desc': 'Description du cercle',
    'circles.cat': 'Catégorie',
    'circles.image_url': "URL de l'image (optionnel)",
    'circles.create_submit': 'Créer le cercle',

    // Capsule & Audio
    'capsule.audio_title': 'Capsule Audio',
    'capsule.text_title': 'Capsule Texte',
    'capsule.by': 'Par',
    'capsule.published_on': 'Publié le',
    'capsule.auto_trans': 'Traduction automatique',
    'capsule.translate_to': 'Traduire la capsule en',
    'capsule.react_useful': 'Utile',
    'capsule.react_thanks': 'Merci',
    'capsule.react_question': 'Question',
    'capsule.comment_placeholder': 'Écrire un commentaire...',
    'capsule.comment_submit': 'Commenter',
    'capsule.comments_count': 'Commentaires',
    'capsule.create_modal_title': 'Partager une Capsule de Savoir',
    'capsule.select_circle': 'Sélectionner un cercle',
    'capsule.type_text': 'Texte',
    'capsule.type_audio': 'Vocal / Audio',
    'capsule.content_placeholder': 'Rédigez votre capsule de savoir...',
    'capsule.original_lang': "Langue d'origine du contenu",
    'capsule.submit': 'Publier la capsule',

    // Audio Recorder
    'audio.record_btn': 'Enregistrer votre voix',
    'audio.recording': 'Enregistrement en cours...',
    'audio.stop_btn': 'Arrêter',
    'audio.play_btn': 'Écouter',
    'audio.rerecord': 'Recommencer',
    'audio.ready': 'Enregistrement vocal prêt !',

    // Chat
    'chat.title': 'Discussion Directe',
    'chat.select_user': 'Sélectionnez un membre pour discuter',
    'chat.no_conversation': 'Aucune conversation sélectionnée',
    'chat.no_messages': 'Aucun message pour le moment',
    'chat.placeholder': 'Écrivez votre message...',
    'chat.send': 'Envoyer',

    // Settings
    'settings.title': 'Paramètres & Préférences',
    'settings.tab_account': 'Mon Compte',
    'settings.tab_privacy': 'Confidentialité & Sécurité',
    'settings.tab_notif': 'Notifications',
    'settings.tab_content': 'Contenu & Langues',
    'settings.tab_circles': 'Cercles & Communauté',
    'settings.tab_access': 'Accessibilité & Données',
    'settings.tab_about': 'À propos & Aide',

    'settings.account.info': 'Informations du profil',
    'settings.account.fullname': 'Nom complet',
    'settings.account.bio': 'Biographie / Présentation',
    'settings.account.avatar': 'URL de votre photo de profil',
    'settings.account.pref_lang': 'Langue préférée du profil',
    'settings.account.save_profile': 'Enregistrer le profil',

    'settings.account.security': 'Sécurité du compte',
    'settings.account.email': 'Adresse email',
    'settings.account.update_email': "Changer l'email",
    'settings.account.password': 'Mot de passe',
    'settings.account.new_password': 'Nouveau mot de passe',
    'settings.account.update_password': 'Mettre à jour le mot de passe',

    'settings.account.danger': 'Zone dangereuse',
    'settings.account.delete_account': 'Supprimer définitivement le compte',
    'settings.account.delete_confirm': 'Pour confirmer, tapez SUPPRIMER ci-dessous :',

    'settings.privacy.title': 'Confidentialité du profil',
    'settings.privacy.profile_vis': 'Visibilité du profil',
    'settings.privacy.capsules_vis': 'Visibilité de vos capsules',
    'settings.privacy.messages': 'Messages autorisés de',
    'settings.privacy.mentorship': 'Demandes de mentorat',
    'settings.privacy.blocked_users': 'Utilisateurs bloqués',
    'settings.privacy.unblock': 'Débloquer',

    'settings.notif.title': 'Préférences de notifications',
    'settings.notif.capsules': 'Nouvelles capsules dans vos cercles',
    'settings.notif.messages': 'Nouveaux messages directs',
    'settings.notif.mentorship': 'Mises à jour de mentorat',
    'settings.notif.reactions': 'Réactions à vos capsules',
    'settings.notif.channel': 'Canal de réception',

    'settings.content.title': 'Langue et Affichage',
    'settings.content.interface_lang': "Langue de l'interface",
    'settings.content.auto_translate': 'Traduction automatique des capsules',
    'settings.content.offline_dl': 'Téléchargement pour accès hors ligne',

    'settings.circles.title': 'Gestion des Cercles',
    'settings.circles.joined_list': 'Vos cercles rejoints',
    'settings.circles.hide_sug': 'Masquer les suggestions de cercles',

    'settings.access.title': 'Accessibilité & Données',
    'settings.access.low_data': 'Mode faible consommation de données',
    'settings.access.text_size': "Taille du texte dans l'interface",

    'settings.about.title': 'À propos de Zauré',
    'settings.about.desc': 'Zauré est une plateforme communautaire de partage de savoirs, de capsules vocales et de mentorat.',
    'settings.about.faq': 'Foire aux questions (FAQ)',

    // Auth Modal
    'auth.login_title': 'Connexion à Zauré',
    'auth.signup_title': 'Créer un compte Zauré',
    'auth.email_label': 'Adresse Email',
    'auth.password_label': 'Mot de passe',
    'auth.name_label': 'Nom complet',
    'auth.bio_label': 'Biographie (optionnel)',
    'auth.role_label': 'Rôle',
    'auth.role_user': 'Utilisateur',
    'auth.role_mentor': 'Mentor',
    'auth.role_verified': 'Compte Vérifié',
    'auth.submit_login': 'Se connecter',
    'auth.submit_signup': "S'inscrire",
    'auth.switch_signup': "Pas de compte ? S'inscrire",
    'auth.switch_login': 'Déjà un compte ? Se connecter',

    // Languages names
    'lang.fr': 'Français',
    'lang.ha': 'Hausa (Haoussa)',
    'lang.en': 'English (Anglais)'
  },

  ha: {
    // Header & Common
    'app.title': 'Zauré',
    'app.subtitle': "Dandali na raba ilimi da fasaha tsakanin al'umma",
    'nav.feed': 'Filin Ilimi',
    'nav.chat': 'Hira Kai Tsaye',
    'nav.settings': 'Saituna',
    'nav.login': 'Shiga',
    'nav.logout': 'Fita',
    'nav.signup': 'Yi Rijista',
    'common.close': 'Rufe',
    'common.cancel': 'Soke',
    'common.save': 'Ajiye',
    'common.delete': 'Goge',
    'common.loading': 'Yana lodawa...',
    'common.error': 'Kuskure',
    'common.success': 'Kammala',
    'common.all': 'Dukkan Dairori',
    'common.my_circles': 'Dairorina',
    'common.public': 'A bayyane',

    // Feed & Filters
    'feed.title': 'Labaran Ilimi da Kapsul',
    'feed.filter_all': 'Dukkan Kapsul',
    'feed.filter_joined': 'Dairorina kawai',
    'feed.empty_title': 'Babu kapsul a halin yanzu',
    'feed.empty_desc': "Kasance cikin dairori ko wallafa kapsul na sauti ko rubutu domin raba iliminka!",
    'feed.create_circle_btn': 'Sabon Daira',
    'feed.create_capsule_btn': 'Raba Ilimi',

    // Circles
    'circles.title': 'Dairorin Ilimi',
    'circles.subtitle': 'Wuraren tattaunawa da koyo',
    'circles.empty': 'Babu dairar ilimi a halin yanzu',
    'circles.empty_desc': "Ka kirkiri daira taka domin fara al'umma!",
    'circles.join': 'Shiga',
    'circles.joined': 'Ka Shiga',
    'circles.joined_leave': 'Ka Shiga (Fita)',
    'circles.leave': 'Fita',
    'circles.members': 'mambobi',
    'circles.create_modal_title': 'Kirkiri Sabon Dairar Ilimi',
    'circles.name': 'Sunan Daira',
    'circles.desc': 'Bayanin Daira',
    'circles.cat': 'Rukuni',
    'circles.image_url': 'Mahaɗar Hoto (A zaɓe)',
    'circles.create_submit': 'Kirkiri Daira',

    // Capsule & Audio
    'capsule.audio_title': 'Kapsul na Sauti',
    'capsule.text_title': 'Kapsul na Rubutu',
    'capsule.by': 'Daga',
    'capsule.published_on': 'An wallafa a',
    'capsule.auto_trans': "Fassarar na'ura",
    'capsule.translate_to': 'Fassara kapsul zuwa',
    'capsule.react_useful': 'Mai amfani',
    'capsule.react_thanks': 'Na gode',
    'capsule.react_question': 'Tambaya',
    'capsule.comment_placeholder': 'Rubuta tsokaci...',
    'capsule.comment_submit': 'Aika',
    'capsule.comments_count': 'Tsokaci',
    'capsule.create_modal_title': 'Raba Kapsul na Ilimi',
    'capsule.select_circle': 'Zaɓi Daira',
    'capsule.type_text': 'Rubutu',
    'capsule.type_audio': 'Sauti / Muryoyi',
    'capsule.content_placeholder': 'Rubuta saƙon kapsul ɗinka...',
    'capsule.original_lang': 'Harshen asali na abun ciki',
    'capsule.submit': 'Wallafa Kapsul',

    // Audio Recorder
    'audio.record_btn': 'Yi rikodin muryarka',
    'audio.recording': 'Ana rikodin...',
    'audio.stop_btn': 'Dakatar',
    'audio.play_btn': 'Saurara',
    'audio.rerecord': 'Sake rikodi',
    'audio.ready': 'Rikodin muryarka ya shiryu!',

    // Chat
    'chat.title': 'Hira Kai Tsaye',
    'chat.select_user': 'Zaɓi mamba domin gudanar da hira',
    'chat.no_conversation': 'Babu hirar da aka zaɓa',
    'chat.no_messages': 'Babu saƙo a halin yanzu',
    'chat.placeholder': 'Rubuta saƙo...',
    'chat.send': 'Aika',

    // Settings
    'settings.title': 'Saituna da Zaɓuɓɓuka',
    'settings.tab_account': 'Asawunata',
    'settings.tab_privacy': 'Sirri da Tsaro',
    'settings.tab_notif': 'Sanarwa',
    'settings.tab_content': 'Abun ciki da Harshe',
    'settings.tab_circles': "Dairori da Al'umma",
    'settings.tab_access': 'Saukaka da Bayanai',
    'settings.tab_about': 'Game da Mu da Taimako',

    'settings.account.info': 'Bayanin Bayani na Kanka',
    'settings.account.fullname': 'Cikakken Suna',
    'settings.account.bio': 'Bayanin Kanka',
    'settings.account.avatar': 'Hoto na Bayani (Mahaɗa)',
    'settings.account.pref_lang': 'Harshen da aka fi so',
    'settings.account.save_profile': 'Ajiye Sauye-sauye',

    'settings.account.security': 'Tsaron Asawuna',
    'settings.account.email': 'Adireshin Email',
    'settings.account.update_email': 'Gyara Email',
    'settings.account.password': 'Kalmar Sirri',
    'settings.account.new_password': 'Sabon Kalmar Sirri',
    'settings.account.update_password': 'Sake Sabunta Kalmar Sirri',

    'settings.account.danger': 'Wuri Mai Haɗari',
    'settings.account.delete_account': 'Goge Asawuna Baki Ɗaya',
    'settings.account.delete_confirm': 'Domin tabbatarwa, rubuta GOGE a ƙasa:',

    'settings.privacy.title': 'Sirrin Bayanan Kanka',
    'settings.privacy.profile_vis': 'Gani Na Bayananka',
    'settings.privacy.capsules_vis': 'Gani Na Kapsul Ɗinka',
    'settings.privacy.messages': 'Bada damar saƙo daga',
    'settings.privacy.mentorship': 'Neman Bada Shawara (Mentorat)',
    'settings.privacy.blocked_users': 'Mambobi da aka toshe',
    'settings.privacy.unblock': 'Cire Toshe',

    'settings.notif.title': 'Zaɓin Sanarwa',
    'settings.notif.capsules': 'Sabbin kapsul a dairorinka',
    'settings.notif.messages': 'Sabbin saƙonni kai tsaye',
    'settings.notif.mentorship': 'Sabuntawa akan Mentorat',
    'settings.notif.reactions': 'Maikata ga kapsul ɗinka',
    'settings.notif.channel': 'Hanyar Karɓar Sanarwa',

    'settings.content.title': 'Harshe da Bayani',
    'settings.content.interface_lang': 'Harshen Manhajarta',
    'settings.content.auto_translate': 'Fassarar kapsul ta atomatik',
    'settings.content.offline_dl': 'Sauke domin amfani ba tare da yanar gizo ba',

    'settings.circles.title': 'Gudanar da Dairori',
    'settings.circles.joined_list': 'Dairorin da ka shiga',
    'settings.circles.hide_sug': 'Ɓoye shawarwarin dairori',

    'settings.access.title': 'Saukakewe da Bayanai',
    'settings.access.low_data': 'Yanayin rage amfani da data',
    'settings.access.text_size': 'Girman rubutu a manhaja',

    'settings.about.title': 'Game da Zauré',
    'settings.about.desc': "Zauré dandali ne na al'umma domin raba ilimi, capsules na sauti da shawarwari.",
    'settings.about.faq': 'Tambayoyi da ake yawan yi (FAQ)',

    // Auth Modal
    'auth.login_title': 'Shiga Zauré',
    'auth.signup_title': 'Ƙirƙiri Asawunar Zauré',
    'auth.email_label': 'Adireshin Email',
    'auth.password_label': 'Kalmar Sirri',
    'auth.name_label': 'Cikakken Suna',
    'auth.bio_label': 'Bayanin Kanka (A zaɓe)',
    'auth.role_label': 'Matasayi',
    'auth.role_user': 'Mai Amfani',
    'auth.role_mentor': 'Jagora (Mentor)',
    'auth.role_verified': 'Asawuna Tabbatacciya',
    'auth.submit_login': 'Shiga',
    'auth.submit_signup': 'Yi Rijista',
    'auth.switch_signup': 'Ba ka da asawuna? Yi rijista',
    'auth.switch_login': 'Kuna da asawuna? Shiga',

    // Languages names
    'lang.fr': 'Français (Faransanci)',
    'lang.ha': 'Hausa',
    'lang.en': 'English (Turanci)'
  },

  en: {
    // Header & Common
    'app.title': 'Zauré',
    'app.subtitle': 'Community Knowledge Sharing Platform',
    'nav.feed': 'Knowledge Feed',
    'nav.chat': 'Direct Chat',
    'nav.settings': 'Settings',
    'nav.login': 'Sign In',
    'nav.logout': 'Sign Out',
    'nav.signup': 'Sign Up',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.all': 'All Circles',
    'common.my_circles': 'My Circles',
    'common.public': 'Public',

    // Feed & Filters
    'feed.title': 'Knowledge Capsules Feed',
    'feed.filter_all': 'All Capsules',
    'feed.filter_joined': 'My Circles Only',
    'feed.empty_title': 'No capsules available',
    'feed.empty_desc': 'Join knowledge circles or publish a audio/text capsule to share your knowledge!',
    'feed.create_circle_btn': 'New Circle',
    'feed.create_capsule_btn': 'Share Knowledge',

    // Circles
    'circles.title': 'Knowledge Circles',
    'circles.subtitle': 'Spaces for discussion and learning',
    'circles.empty': 'No knowledge circles yet',
    'circles.empty_desc': 'Create your own circle to start the community!',
    'circles.join': 'Join',
    'circles.joined': 'Joined',
    'circles.joined_leave': 'Joined (Leave)',
    'circles.leave': 'Leave',
    'circles.members': 'members',
    'circles.create_modal_title': 'Create a new Knowledge Circle',
    'circles.name': 'Circle Name',
    'circles.desc': 'Circle Description',
    'circles.cat': 'Category',
    'circles.image_url': 'Image URL (optional)',
    'circles.create_submit': 'Create Circle',

    // Capsule & Audio
    'capsule.audio_title': 'Audio Capsule',
    'capsule.text_title': 'Text Capsule',
    'capsule.by': 'By',
    'capsule.published_on': 'Published on',
    'capsule.auto_trans': 'Automatic Translation',
    'capsule.translate_to': 'Translate capsule to',
    'capsule.react_useful': 'Useful',
    'capsule.react_thanks': 'Thanks',
    'capsule.react_question': 'Question',
    'capsule.comment_placeholder': 'Write a comment...',
    'capsule.comment_submit': 'Comment',
    'capsule.comments_count': 'Comments',
    'capsule.create_modal_title': 'Share a Knowledge Capsule',
    'capsule.select_circle': 'Select a Circle',
    'capsule.type_text': 'Text',
    'capsule.type_audio': 'Voice / Audio',
    'capsule.content_placeholder': 'Write your knowledge capsule...',
    'capsule.original_lang': 'Original content language',
    'capsule.submit': 'Publish Capsule',

    // Audio Recorder
    'audio.record_btn': 'Record your voice',
    'audio.recording': 'Recording in progress...',
    'audio.stop_btn': 'Stop',
    'audio.play_btn': 'Listen',
    'audio.rerecord': 'Re-record',
    'audio.ready': 'Voice recording ready!',

    // Chat
    'chat.title': 'Direct Discussion',
    'chat.select_user': 'Select a member to start chatting',
    'chat.no_conversation': 'No conversation selected',
    'chat.no_messages': 'No messages yet',
    'chat.placeholder': 'Type your message...',
    'chat.send': 'Send',

    // Settings
    'settings.title': 'Settings & Preferences',
    'settings.tab_account': 'My Account',
    'settings.tab_privacy': 'Privacy & Security',
    'settings.tab_notif': 'Notifications',
    'settings.tab_content': 'Content & Languages',
    'settings.tab_circles': 'Circles & Community',
    'settings.tab_access': 'Accessibility & Data',
    'settings.tab_about': 'About & Help',

    'settings.account.info': 'Profile Information',
    'settings.account.fullname': 'Full Name',
    'settings.account.bio': 'Bio / Introduction',
    'settings.account.avatar': 'Profile Picture URL',
    'settings.account.pref_lang': 'Preferred Profile Language',
    'settings.account.save_profile': 'Save Profile',

    'settings.account.security': 'Account Security',
    'settings.account.email': 'Email Address',
    'settings.account.update_email': 'Change Email',
    'settings.account.password': 'Password',
    'settings.account.new_password': 'New Password',
    'settings.account.update_password': 'Update Password',

    'settings.account.danger': 'Danger Zone',
    'settings.account.delete_account': 'Permanently Delete Account',
    'settings.account.delete_confirm': 'To confirm, type DELETE below:',

    'settings.privacy.title': 'Profile Privacy',
    'settings.privacy.profile_vis': 'Profile Visibility',
    'settings.privacy.capsules_vis': 'Capsules Visibility',
    'settings.privacy.messages': 'Allowed Messages From',
    'settings.privacy.mentorship': 'Mentorship Requests',
    'settings.privacy.blocked_users': 'Blocked Users',
    'settings.privacy.unblock': 'Unblock',

    'settings.notif.title': 'Notification Preferences',
    'settings.notif.capsules': 'New capsules in your circles',
    'settings.notif.messages': 'New direct messages',
    'settings.notif.mentorship': 'Mentorship updates',
    'settings.notif.reactions': 'Reactions to your capsules',
    'settings.notif.channel': 'Notification Channel',

    'settings.content.title': 'Language and Display',
    'settings.content.interface_lang': 'Interface Language',
    'settings.content.auto_translate': 'Automatic Capsule Translation',
    'settings.content.offline_dl': 'Offline Access Download',

    'settings.circles.title': 'Circle Management',
    'settings.circles.joined_list': 'Your Joined Circles',
    'settings.circles.hide_sug': 'Hide Circle Suggestions',

    'settings.access.title': 'Accessibility & Data',
    'settings.access.low_data': 'Low Data Consumption Mode',
    'settings.access.text_size': 'Interface Text Size',

    'settings.about.title': 'About Zauré',
    'settings.about.desc': 'Zauré is a community knowledge sharing platform with audio capsules and mentorship.',
    'settings.about.faq': 'Frequently Asked Questions (FAQ)',

    // Auth Modal
    'auth.login_title': 'Sign In to Zauré',
    'auth.signup_title': 'Create a Zauré Account',
    'auth.email_label': 'Email Address',
    'auth.password_label': 'Password',
    'auth.name_label': 'Full Name',
    'auth.bio_label': 'Bio (optional)',
    'auth.role_label': 'Role',
    'auth.role_user': 'User',
    'auth.role_mentor': 'Mentor',
    'auth.role_verified': 'Verified Account',
    'auth.submit_login': 'Sign In',
    'auth.submit_signup': 'Sign Up',
    'auth.switch_signup': "Don't have an account? Sign Up",
    'auth.switch_login': 'Already have an account? Sign In',

    // Languages names
    'lang.fr': 'French',
    'lang.ha': 'Hausa',
    'lang.en': 'English'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'fr',
  setLanguage: () => {},
  t: (key: string, defaultText?: string) => defaultText || key,
});

export const LanguageProvider: React.FC<{
  currentUser?: UserProfile | null;
  children: React.ReactNode;
}> = ({ currentUser, children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (currentUser?.langue_preferee) {
      return currentUser.langue_preferee;
    }
    return 'fr';
  });

  useEffect(() => {
    if (currentUser?.langue_preferee) {
      setLanguageState(currentUser.langue_preferee);
    }
  }, [currentUser?.langue_preferee]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, defaultText?: string): string => {
    const dict = translations[language] || translations.fr;
    if (dict[key]) return dict[key];
    const fallbackDict = translations.fr;
    if (fallbackDict[key]) return fallbackDict[key];
    return defaultText || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
