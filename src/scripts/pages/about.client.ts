import { setupParallax } from './parallax';

export function initAboutPage() {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		const target = document.getElementById('stats-card');
		if (target) {
			target.style.opacity = '1';
			target.style.transform = 'translateY(0)';
		}
		return;
	}
	setupParallax({ desktopRise: 140, coarsePointerRise: 64, revealTarget: true });
}
