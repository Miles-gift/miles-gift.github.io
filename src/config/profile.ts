import type { ImageMetadata } from 'astro';
import avatar from '../assets/yoyo-avatar.png';

/**
 * Allowed social entry keys in profile configuration.
 */
export type ProfileSocialKey = 'github' | 'x' | 'email' | 'website';

/**
 * One social link item rendered on `/about`.
 */
export interface ProfileSocialLink {
  key: ProfileSocialKey;
  label: string;
  url: string;
}

/**
 * Personal profile settings used by About page and article author schema.
 */
export interface ProfileConfig {
  /**
   * Optional avatar URL for About page and structured data.
   */
  avatar?: string | ImageMetadata;
  /**
   * Display name used across the site.
   */
  name: string;
  /**
   * Short headline/title shown on About page.
   */
  title: string;
  /**
   * Short bio text shown on About page and in schema.
   */
  bio: string;
  /**
   * Optional location text.
   */
  location?: string;
  /**
   * Optional contact email.
   */
  email?: string;
  /**
   * Personal GitHub profile URL (separate from repo URL).
   */
  githubProfileUrl: string;
  /**
   * Social links displayed in About page social row.
   */
  socials: ProfileSocialLink[];
}

export const profileConfig: ProfileConfig = {
  avatar,
  name: 'yoyo',
  title: '华中科技大学集成电路学院 · 电子科学与技术本科生',
  bio: '本科大四，预计 2027 年毕业。希望继续探索高性能处理器电源架构，长期关注 AI 芯片与集成电路设计。课余喜欢健身、寻找和品尝美食、打乒乓球。',
  location: '中国 · 湖北 · 武汉 · 华中科技大学',
  githubProfileUrl: 'https://github.com/Miles-gift',
  socials: [{ key: 'github', label: 'GitHub · Miles-gift', url: 'https://github.com/Miles-gift' }],
};
