const revealSelector = 'p, ul, ol, blockquote, h2, h3, h4, h5, h6';

export function setupArticleScrollReveal(): (() => void) | null {
	const article = document.querySelector<HTMLElement>('.article-reading .prose');
	if (
		!article
		|| window.matchMedia('(prefers-reduced-motion: reduce)').matches
		|| !('IntersectionObserver' in window)
	) {
		return null;
	}

	const items = Array.from(article.children).filter(
		(element): element is HTMLElement =>
			element instanceof HTMLElement && element.matches(revealSelector),
	);
	if (items.length === 0) return null;

	article.classList.add('article-reveal-ready');
	items.forEach((item) => item.classList.add('article-reveal-item'));

	const observer = new IntersectionObserver(
		(entries, activeObserver) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add('is-visible');
				activeObserver.unobserve(entry.target);
			}
		},
		{
			root: document.getElementById('main-content'),
			rootMargin: '0px 0px -7% 0px',
			threshold: 0.04,
		},
	);

	items.forEach((item) => observer.observe(item));

	return () => {
		observer.disconnect();
		article.classList.remove('article-reveal-ready');
		items.forEach((item) => item.classList.remove('article-reveal-item', 'is-visible'));
	};
}
