import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { blogFrontmatterSchema } from '../../src/lib/content/frontmatter-schema.ts';

export function hashContent(content) {
	return createHash('sha256').update(content).digest('hex');
}

function validationError(message, issues = []) {
	return Object.assign(new Error(message), { status: 400, issues });
}

export function splitPostSource(source) {
	const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
	const match = text.match(/^(---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*)(\r?\n|$)([\s\S]*)$/);
	if (!match) throw validationError('文章缺少有效的 YAML frontmatter。');
	const document = parseDocument(match[2], { uniqueKeys: true, prettyErrors: true });
	if (document.errors.length) throw validationError(document.errors.map((error) => error.message).join('\n'));
	return {
		data: document.toJS(),
		// Match the frontmatter checker: leading blank lines are formatting around
		// the delimiter, not article body content.
		body: match[5].replace(/^(?:\r?\n)*/, ''),
		lineEnding: source.includes('\r\n') ? '\r\n' : '\n',
	};
}

function shanghaiDate(value, field) {
	if (typeof value !== 'string' || !value.trim()) throw validationError(`${field} 必须填写。`);
	const raw = value.trim();
	const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00+08:00` : raw;
	const date = new Date(normalized);
	if (Number.isNaN(date.valueOf())) throw validationError(`${field} 不是有效的日期时间。`);
	const local = new Date(date.valueOf() + 8 * 60 * 60 * 1000);
	const pad = (number) => String(number).padStart(2, '0');
	return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}+08:00`;
}

function toLocalDateTime(value) {
	if (!value) return '';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.valueOf())) return '';
	const local = new Date(date.valueOf() + 8 * 60 * 60 * 1000);
	const pad = (number) => String(number).padStart(2, '0');
	return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

function normalizeTag(tag) {
	const lowered = tag.replace(/[A-Z]/g, (character) => character.toLowerCase());
	return /^[\x00-\x7F]+$/.test(lowered) ? lowered.replace(/\s+/g, '-') : lowered.replace(/\s+/g, ' ');
}

function validate(data) {
	const result = blogFrontmatterSchema.safeParse(data);
	if (!result.success) {
		const issues = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
		throw validationError(issues.map((issue) => `${issue.field || '文章'}：${issue.message}`).join('；'), issues);
	}
	return result.data;
}

function quote(value) {
	return JSON.stringify(String(value));
}

export function parsePostSource(source) {
	const split = splitPostSource(source);
	const validated = validate(split.data);
	return {
		...split,
		data: {
			title: validated.title,
			date: toLocalDateTime(validated.date),
			updated: toLocalDateTime(validated.updated),
			description: validated.description || '',
			cover: validated.cover || '',
			draft: validated.draft,
			categories: validated.categories,
			tags: validated.tags,
		},
	};
}

export function serializePostSource(input, body = '') {
	const title = String(input.title ?? '').trim();
	const date = shanghaiDate(input.date, '发布时间');
	const updated = input.updated ? shanghaiDate(input.updated, '更新时间') : undefined;
	const categories = Array.isArray(input.categories) ? input.categories.map((item) => String(item).trim()).filter(Boolean) : [];
	const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map((item) => normalizeTag(String(item).trim())).filter(Boolean))] : [];
	const data = validate({
		title,
		date,
		...(updated ? { updated } : {}),
		...(String(input.description ?? '').trim() ? { description: String(input.description).trim() } : {}),
		...(String(input.cover ?? '').trim() ? { cover: String(input.cover).trim() } : {}),
		draft: Boolean(input.draft),
		categories,
		tags,
	});

	const lineEnding = input.lineEnding === '\r\n' ? '\r\n' : '\n';
	const lines = ['---', `title: ${quote(data.title)}`, `date: ${quote(date)}`];
	if (updated) lines.push(`updated: ${quote(updated)}`);
	if (data.description) lines.push(`description: ${quote(data.description)}`);
	if (data.cover) lines.push(`cover: ${quote(data.cover)}`);
	lines.push(`draft: ${data.draft}`);
	if (data.categories.length) {
		lines.push('categories:');
		for (const category of data.categories) lines.push(`  - ${quote(category)}`);
	} else {
		lines.push('categories: []');
	}
	if (data.tags.length) {
		lines.push('tags:');
		for (const tag of data.tags) lines.push(`  - ${quote(tag)}`);
	} else {
		lines.push('tags: []');
	}
	const normalizedBody = String(body).replace(/^(?:\r?\n)*/, '');
	return { content: `${lines.join(lineEnding)}${lineEnding}---${lineEnding}${lineEnding}${normalizedBody}`, data };
}

export function normalizeMarkdownTrailingWhitespace(source) {
	const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
	const lines = source.split(/\r?\n/);
	let fence = null;
	return lines.map((line) => {
		const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
		if (fence) {
			if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && /^ {0,3}(?:`{3,}|~{3,})[ \t]*$/.test(line)) {
				fence = null;
				return line.replace(/[ \t]+$/, '');
			}
			return line;
		}
		if (marker) {
			fence = { character: marker[1][0], length: marker[1].length };
			return line.replace(/[ \t]+$/, '');
		}
		if (/^[ \t]+$/.test(line)) return '';
		const trailing = line.match(/[ \t]+$/)?.[0];
		if (!trailing) return line;
		const content = line.slice(0, -trailing.length);
		return trailing.length >= 2 ? `${content}\\` : content;
	}).join(lineEnding);
}

export function summarizePost(source, slug, extension) {
	const { data } = parsePostSource(source);
	return { slug, extension, ...data };
}
