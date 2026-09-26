import { randomBytes } from 'node:crypto';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const maxUploadBytes = 20 * 1024 * 1024;
const maxPixels = 40_000_000;

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

	const mediaDirectory = path.join(workspaceRoot, 'media');
	await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
	const rootInfo = await lstat(workspaceRoot);
	if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('本地工作区不能是符号链接或普通文件。');
	await mkdir(mediaDirectory, { recursive: true, mode: 0o700 });
	const directoryInfo = await lstat(mediaDirectory);
	if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) throw new Error('本地媒体目录不能是符号链接或普通文件。');

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
