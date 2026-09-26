import defaultBackground from '../assets/blog-placeholder-1.webp';
import blogSettings from '../data/blog-settings.json';

/**
 * Hero copy and background settings for one page.
 */
export interface HeroSectionConfig {
  /**
   * Main hero headline text.
   */
  text: string;
  /**
   * Optional hero subtitle text.
   */
  subtitle?: string;
  /**
   * Hero background image URL.
   */
  backgroundImage: string;
}

/**
 * Centralized hero configuration for all top-level pages and post fallback.
 */
export interface HeroConfig {
  home: HeroSectionConfig;
  blog: HeroSectionConfig;
  tags: HeroSectionConfig;
  about: HeroSectionConfig;
  /**
   * Default hero image shared by all article pages.
   */
  postDefaultBackground: string;
}

export const heroConfig: HeroConfig = {
  home: {
    text: '你好，我是 yoyo。',
    subtitle: '在华中科技大学学习电子科学与技术，关注高性能处理器的电源架构。',
    backgroundImage: defaultBackground.src,
  },
  blog: {
    text: blogSettings.blogHero.title,
    subtitle: blogSettings.blogHero.subtitle,
    backgroundImage: blogSettings.blogHero.backgroundImage || defaultBackground.src,
  },
  tags: {
    text: 'Tags',
    subtitle: 'Explore topics by category and tag.',
    backgroundImage: defaultBackground.src,
  },
  about: {
    text: 'About',
    subtitle: '华中科技大学集成电路学院 · 电子科学与技术本科生',
    backgroundImage: defaultBackground.src,
  },
  postDefaultBackground: blogSettings.defaultPostHero || defaultBackground.src,
};
