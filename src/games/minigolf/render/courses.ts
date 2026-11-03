import { isUnlocked } from '../../../services/economy';
import type { BurstStyle } from '../../shared/fx';

/** Visual do campo (mesmos buracos e mesma física em todos). */
export interface CourseTheme {
  id: string;
  name: string;
  tier: 'free' | 'premium';
  /** Efeito quando a bola cai no buraco (só visual; campos grátis = 'simples'). */
  burst: BurstStyle;
  description: string;
  sea: [string, string, string];
  glow: string;
  shore: [string, string];
  water: [string, string];
  wall: [string, string];
  grass: [string, string];
  block: [string, string];
  leaf: [string, string];
  trunk: string;
}

export const COURSE_THEMES: CourseTheme[] = [
  { id: 'tropical', burst: 'simples', name: 'Ilha Tropical', tier: 'free', description: 'Pôr do sol no mar.', sea: ['#2a6f97', '#1f5c86', '#174a6e'], glow: 'rgba(255,170,90,0.55)', shore: ['#d9b77a', '#ecd29a'], water: ['#2f86b8', '#236c99'], wall: ['#7a3f1c', '#b8743f'], grass: ['#3fae49', '#4bbd53'], block: ['#8a4b22', '#c07a42'], leaf: ['#2f8a3a', '#3fa548'], trunk: '#7a4a24' },
  { id: 'floresta', burst: 'simples', name: 'Floresta', tier: 'free', description: 'Clareira entre pinheiros.', sea: ['#1d3b2a', '#16301f', '#0f2316'], glow: 'rgba(200,255,170,0.25)', shore: ['#6b5434', '#857049'], water: ['#2e6f7a', '#225761'], wall: ['#4a2e17', '#7a5531'], grass: ['#2f8a3e', '#379646'], block: ['#5b3a1e', '#8a6038'], leaf: ['#1e5c2a', '#2c7a36'], trunk: '#4a2e17' },
  { id: 'deserto', burst: 'simples', name: 'Deserto', tier: 'free', description: 'Oásis sob o sol forte.', sea: ['#d9a35f', '#c98d48', '#b07636'], glow: 'rgba(255,240,200,0.5)', shore: ['#e9c98d', '#f4dcaa'], water: ['#2fa3b8', '#22869a'], wall: ['#8c4f2a', '#c27a45'], grass: ['#74b04a', '#82bd55'], block: ['#a3622f', '#d28c4f'], leaf: ['#4f8a2f', '#62a03a'], trunk: '#7a4a24' },
  { id: 'noturno', burst: 'simples', name: 'Noturno', tier: 'free', description: 'Campo iluminado à noite.', sea: ['#141c3a', '#0f1630', '#0a1024'], glow: 'rgba(160,200,255,0.3)', shore: ['#8d8fa8', '#a9abc2'], water: ['#24497a', '#1a3a66'], wall: ['#3a2a4a', '#6a5584'], grass: ['#2a7a52', '#31875c'], block: ['#40305a', '#6d5a8f'], leaf: ['#1d5a45', '#256b52'], trunk: '#3a2a2a' },
  { id: 'halloween', burst: 'abobora', name: 'Halloween', tier: 'premium', description: 'Abóboras e noite roxa.', sea: ['#2a1240', '#1f0c33', '#140823'], glow: 'rgba(255,150,50,0.4)', shore: ['#5a3a6a', '#74507f'], water: ['#3a1d5a', '#2c1647'], wall: ['#2a1229', '#ff9f32'], grass: ['#4a2a6a', '#553078'], block: ['#271329', '#ff8a1f'], leaf: ['#ff8a1f', '#d96a10'], trunk: '#1d0f20' },
];

export const courseById = (id: string | undefined) => COURSE_THEMES.find((t) => t.id === id) ?? COURSE_THEMES[0];
export const isCourseAvailable = (t: CourseTheme) => isUnlocked(`golf.course.${t.id}`);
