import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { splitPostSource } from './content.mjs';

function walk(node, visit) {
	visit(node);
	for (const child of node.children || []) walk(child, visit);
}

function markdownImage(node, url, title = node.title) {
	const alt = String(node.alt || '').replaceAll('\\', '\\\\').replaceAll(']', '\\]');
	const suffix = title ? ` "${String(title).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"` : '';
	return `![${alt}](<${url}>${suffix})`;
}

function htmlReferences(value, baseOffset, baseLine) {
	const refs = [];
	const tagPattern = /<(?:img|Image|source)\b[^>]*>/gi;
	for (const tagMatch of value.matchAll(tagPattern)) {
		const tag = tagMatch[0];
		const tagOffset = baseOffset + tagMatch.index;
		const line = baseLine + (value.slice(0, tagMatch.index).match(/\n/g) || []).length;
		const srcPattern = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(["'])(.*?)\3\s*\}|\{[^}]*\}|([^\s/>]+))/gi;
		let match;
		while ((match = srcPattern.exec(tag))) {
			const quoted = match[1] ?? match[2] ?? match[4] ?? match[6];
			if (quoted === undefined) continue;
			const valueStart = tagOffset + match.index + match[0].lastIndexOf(quoted);
			refs.push({
				url: quoted.replaceAll('&amp;', '&'),
				line,
				rewrite: (url) => `${value.slice(0, tagMatch.index)}${tag.slice(0, match.index + match[0].lastIndexOf(quoted))}${url}${tag.slice(match.index + match[0].lastIndexOf(quoted) + quoted.length)}${value.slice(tagMatch.index + tag.length)}`,
				start: valueStart,
				end: valueStart + quoted.length,
				kind: 'html',
			});
		}
		if (!/\bsrc\s*=/.test(tag)) continue;
		if (!refs.some((ref) => ref.start >= tagOffset && ref.end <= tagOffset + tag.length)) {
			refs.push({ url: null, line, start: tagOffset, end: tagOffset + tag.length, kind: 'dynamic' });
		}
	}
	return refs;
}

export function findImageReferences(source) {
	const split = splitPostSource(source);
	const bodyOffset = source.length - split.body.length;
	const tree = unified().use(remarkParse).parse(split.body);
	const definitions = new Map();
	walk(tree, (node) => {
		if (node.type === 'definition') definitions.set(node.identifier, node);
	});

	const references = [];
	walk(tree, (node) => {
		if (!['image', 'imageReference'].includes(node.type)) {
			if (node.type === 'html') {
				references.push(...htmlReferences(
					node.value,
					bodyOffset + node.position.start.offset,
					node.position.start.line + (source.slice(0, bodyOffset).match(/\n/g) || []).length,
				));
			}
			return;
		}
		const definition = node.type === 'imageReference' ? definitions.get(node.identifier) : null;
		const url = node.type === 'image' ? node.url : definition?.url;
		const start = bodyOffset + node.position.start.offset;
		const end = bodyOffset + node.position.end.offset;
		references.push({
			url: url ?? null,
			line: node.position.start.line + (source.slice(0, bodyOffset).match(/\n/g) || []).length,
			start,
			end,
			kind: 'markdown',
			rewrite: (nextUrl) => markdownImage(node, nextUrl, definition?.title),
		});
	});

	const cover = split.data?.cover;
	if (typeof cover === 'string' && cover.trim()) {
		const frontmatter = source.match(/^(---[^\r\n]*\r?\n)([\s\S]*?)(\r?\n---[^\r\n]*)(?:\r?\n|$)/);
		if (frontmatter) {
			const key = /^cover\s*:\s*.*$/m;
			const match = key.exec(frontmatter[2]);
			if (match) {
				const start = frontmatter[1].length + match.index;
				const lineStart = source.slice(0, start).split('\n').length;
				references.push({
					url: cover,
					line: lineStart,
					start,
					end: start + match[0].length,
					kind: 'cover',
					rewrite: (nextUrl) => `cover: ${JSON.stringify(nextUrl)}`,
				});
			}
		}
	}
	return references.sort((a, b) => a.start - b.start);
}

export function rewriteImageReferences(source, references, replacements) {
	let output = source;
	const edits = references
		.map((reference, index) => ({ reference, value: replacements[index] }))
		.filter((edit) => edit.value && edit.value !== edit.reference.url)
		.sort((a, b) => b.reference.start - a.reference.start);
	for (const { reference, value } of edits) {
		if (reference.kind === 'html') output = `${output.slice(0, reference.start)}${value}${output.slice(reference.end)}`;
		else output = `${output.slice(0, reference.start)}${reference.rewrite(value)}${output.slice(reference.end)}`;
	}
	return output;
}
