import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const svg = fileURLToPath(new URL("../public/brand/yoyo-social-card.svg", import.meta.url));
const png = fileURLToPath(new URL("../public/brand/yoyo-social-card.png", import.meta.url));
const source = await readFile(svg);

await sharp(source, { density: 144 })
  .resize(1200, 630, { fit: "cover" })
  .png({ compressionLevel: 9, palette: true })
  .toFile(png);

const meta = await sharp(png).metadata();
if (meta.width !== 1200 || meta.height !== 630 || meta.format !== "png") {
  throw new Error("分享图生成结果不符合 1200×630 PNG 要求");
}
console.log(`分享图已生成：${meta.width}×${meta.height} ${meta.format}`);
