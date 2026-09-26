const OUTBOUND_MARK = {
	type: 'element',
	tagName: 'svg',
	properties: {
		className: ['article-link__outbound-mark'],
		ariaHidden: 'true',
		focusable: 'false',
		viewBox: '0 0 16 16',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 1.6,
		strokeLinecap: 'round',
		strokeLinejoin: 'round',
	},
	children: [
		{ type: 'element', tagName: 'path', properties: { d: 'M6 3h7v7' }, children: [] },
		{ type: 'element', tagName: 'path', properties: { d: 'm13 3-8 8' }, children: [] },
		{ type: 'element', tagName: 'path', properties: { d: 'M11 9v4H3V5h4' }, children: [] },
	],
};

function hasImage(node) {
	if (!node || typeof node !== 'object') return false;
	if (node.type === 'element' && node.tagName === 'img') return true;
	return Array.isArray(node.children) && node.children.some(hasImage);
}

function hasVisibleText(node) {
	if (!node || typeof node !== 'object') return false;
	if (node.type === 'text') return Boolean(node.value?.trim());
	return Array.isArray(node.children) && node.children.some(hasVisibleText);
}

function getClassNames(value) {
	if (Array.isArray(value)) return value.filter((name) => typeof name === 'string');
	if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
	return [];
}

/**
 * Classifies article links by their resolved origin and adds a small,
 * screen-reader-hidden outbound marker to text links that leave the site.
 */
export function rehypeArticleLinks({ siteUrl }) {
	const siteOrigin = new URL(siteUrl).origin;

	return (tree) => {
		const visit = (node) => {
			if (node.type === 'element' && node.tagName === 'a') {
				const href = node.properties?.href;
				if (typeof href === 'string' && href.trim()) {
					const trimmedHref = href.trim();
					const isNonWebLink = /^(?:#|mailto:|tel:|data:|javascript:)/i.test(trimmedHref);

					if (!isNonWebLink) {
						let resolvedUrl;
						try {
							resolvedUrl = new URL(trimmedHref, siteUrl);
						} catch {
							resolvedUrl = null;
						}

						if (resolvedUrl && ['http:', 'https:'].includes(resolvedUrl.protocol)) {
							const external = resolvedUrl.origin !== siteOrigin;
							const properties = (node.properties ||= {});
							const classes = getClassNames(properties.className);
							const isDownload = Object.hasOwn(properties, 'download');

							if (external && !classes.includes('article-link--external')) {
								classes.push('article-link--external');
							}
							if (isDownload && !classes.includes('article-link--download')) {
								classes.push('article-link--download');
							}
							if (classes.length > 0) properties.className = classes;

							const hasMarker = Array.isArray(node.children)
								&& node.children.some((child) =>
									getClassNames(child.properties?.className).includes('article-link__outbound-mark'),
								);
							if (external && !isDownload && !hasImage(node) && hasVisibleText(node) && !hasMarker) {
								node.children ||= [];
								node.children.push({
									...OUTBOUND_MARK,
									properties: { ...OUTBOUND_MARK.properties },
									children: OUTBOUND_MARK.children.map((child) => ({
										...child,
										properties: { ...child.properties },
									})),
								});
							}

							if (properties.target === '_blank') {
								const rel = Array.isArray(properties.rel)
									? properties.rel
									: typeof properties.rel === 'string'
										? properties.rel.split(/\s+/)
										: [];
								properties.rel = [...new Set([...rel, 'noopener', 'noreferrer'])];
							}
						}
					}
				}
			}

			if (Array.isArray(node.children)) node.children.forEach(visit);
		};

		visit(tree);
	};
}

export default rehypeArticleLinks;
