import healthCoverImg from '../../assets/images/community_health_cover_1794865572039.jpg';
import scienceCoverImg from '../../assets/images/community_science_cover_1794865572060.jpg';
import cultureCoverImg from '../../assets/images/community_culture_cover_1794865573368.jpg';
import emblemAvatarImg from '../../assets/images/community_emblem_avatar_1794865572283.jpg';

export const COMMUNITY_COVER_PRESETS = [
  { id: 'health', label: 'Santé & Médecine', url: healthCoverImg },
  { id: 'science', label: 'Sciences & Agro', url: scienceCoverImg },
  { id: 'culture', label: 'Culture & Savoirs', url: cultureCoverImg }
];

export const COMMUNITY_AVATAR_PRESETS = [
  { id: 'emblem', label: 'Emblème Zaure', url: emblemAvatarImg },
  { id: 'health', label: 'Santé', url: healthCoverImg },
  { id: 'science', label: 'Sciences', url: scienceCoverImg },
  { id: 'culture', label: 'Bibliothèque', url: cultureCoverImg }
];

export const COMMUNITY_CATEGORIES = [
  'Médecine & Santé',
  'Sciences & Tech',
  'Langues & Culture',
  'Éducation & Études',
  'Agriculture & Écologie',
  'Entrepreneuriat',
  'Vie communautaire'
];

export function getDefaultCoverByCategory(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes('sant') || lower.includes('méd')) return healthCoverImg;
  if (lower.includes('scien') || lower.includes('agro') || lower.includes('tech')) return scienceCoverImg;
  return cultureCoverImg;
}

export function getDefaultAvatar(): string {
  return emblemAvatarImg;
}
