import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const maxUploadBytes = 20 * 1024 * 1024;
const maxPixels = 40_000_000;
const migratedFormats = new Map([['jpeg', 'jpg'], ['png', 'png'], ['webp', 'webp'], ['gif', 'gif'], ['svg', 'svg'], ['avif', 'avif']]);

async function prepareMediaDirectory(workspaceRoot) {
	const mediaDirectory = path.join(workspaceRoot, 'media');
	await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
	const rootInfo = await lstat(workspaceRoot);
	if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('本地工作区不能是符号链接或普通文件。');
	await mkdir(mediaDirectory, { recursive: true, mode: 0o700 });
	const directoryInfo = await lstat(mediaDirectory);
	if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) throw new Error('本地媒体目录不能是符号链接或普通文件。');
	return mediaDirectory;
}

export async function optimizePrivateImage(workspaceRoot, input) {
	if (!Buffer.isBuffer(input) || input.length === 0) {
		throw Object.assign(new Error('请选择一张图片。'), { status: 400 });
	}
	if (input.length > maxUploadBytes) {
		throw Object.assign(new Error('单张图片不能超过 20 MB。'), { status: 413 });
	}

	let image;
	let metadata;
	try {
		image = sharp(input, { limitInputPixels: maxPixels, animated: false });
		metadata = await image.metadata();
	} catch {
		throw Object.assign(new Error('图片文件无法读取。'), { status: 400 });
	}
	if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
		throw Object.assign(new Error('只支持 PNG、JPEG 和 WebP 图片。'), { status: 415 });
	}
	if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels) {
		throw Object.assign(new Error('图片像素尺寸超出限制。'), { status: 413 });
	}

	const mediaDirectory = await prepareMediaDirectory(workspaceRoot);

	const filename = `${randomBytes(10).toString('hex')}.webp`;
	const { data: output, info } = await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
	await writeFile(path.join(mediaDirectory, filename), output, { flag: 'wx', mode: 0o600 });
	return {
		filename,
		path: `/uploads/blog/${filename}`,
		previewUrl: `/api/media/${filename}`,
		width: info.width,
		height: info.height,
		bytes: output.length,
	};
}

export async function archiveLocalImage(workspaceRoot, input) {
	if (!Buffer.isBuffer(input) || input.length === 0) throw new Error('图片文件为空。');
	if (input.length > maxUploadBytes) throw new Error('图片文件超过 20 MB，无法归档。');
	let metadata;
	try {
		metadata = await sharp(input, { limitInputPixels: maxPixels, animated: false }).metadata();
	} catch {
		throw new Error('文件不是可读取的图片。');
	}
	if (!migratedFormats.has(metadata.format) || (metadata.width && metadata.height && metadata.width * metadata.height > maxPixels)) {
		throw new Error(`不支持自动归档 ${metadata.format || '未知格式'} 图片。`);
	}
	const extension = migratedFormats.get(metadata.format);
	const filename = `${createHash('sha256').update(input).digest('hex').slice(0, 20)}.${extension}`;
	const mediaDirectory = await prepareMediaDirectory(workspaceRoot);
	const target = path.join(mediaDirectory, filename);
	try {
		const info = await lstat(target);
		if (!info.isFile() || info.isSymbolicLink() || (await readFile(target)).compare(input) !== 0) {
			throw new Error(`本地媒体文件名冲突：${filename}`);
		}
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		await writeFile(target, input, { flag: 'wx', mode: 0o600 });
	}
	return { filename, path: `/uploads/blog/${filename}` };
}
