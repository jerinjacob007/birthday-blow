import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import test from "node:test";

const ROOT = process.cwd();
const ASSET_DIR = join(ROOT, "public", "gift-crate");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type PngInfo = {
  width: number;
  height: number;
  colorType: number;
  pixels?: Buffer;
};

function paethPredictor(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceAbove = Math.abs(estimate - above);
  const distanceUpperLeft = Math.abs(estimate - upperLeft);

  if (distanceLeft <= distanceAbove && distanceLeft <= distanceUpperLeft) {
    return left;
  }

  return distanceAbove <= distanceUpperLeft ? above : upperLeft;
}

function readPngInfo(path: string): PngInfo {
  const source = readFileSync(path);
  assert.equal(source.subarray(0, PNG_SIGNATURE.length).compare(PNG_SIGNATURE), 0, `${path} is not a PNG`);

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idatChunks: Buffer[] = [];

  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = source.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9] ?? -1;
    }

    if (type === "IDAT") {
      idatChunks.push(Buffer.from(data));
    }

    if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  const info: PngInfo = { width, height, colorType };
  if (colorType !== 6) {
    return info;
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    const rowStart = y * stride;
    const previousRowStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[inputOffset] ?? 0;
      inputOffset += 1;
      const left = x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] ?? 0 : 0;
      const above = y > 0 ? pixels[previousRowStart + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[previousRowStart + x - bytesPerPixel] ?? 0 : 0;
      let value = raw;

      if (filterType === 1) {
        value = raw + left;
      } else if (filterType === 2) {
        value = raw + above;
      } else if (filterType === 3) {
        value = raw + Math.floor((left + above) / 2);
      } else if (filterType === 4) {
        value = raw + paethPredictor(left, above, upperLeft);
      } else {
        assert.equal(filterType, 0, `${path} uses unsupported PNG filter ${filterType}`);
      }

      pixels[rowStart + x] = value & 0xff;
    }
  }

  return { ...info, pixels };
}

function alphaAt(info: PngInfo, x: number, y: number) {
  assert.ok(info.pixels, "Expected RGBA pixel data");
  return info.pixels[(y * info.width + x) * 4 + 3] ?? 255;
}

test("gift crate break assets are web-ready PNG frames and sheets", () => {
  const metadataPath = join(ASSET_DIR, "metadata.json");
  assert.ok(existsSync(metadataPath), "metadata.json should exist");

  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
    frameCount: number;
    frameWidth: number;
    frameHeight: number;
    frames: { file: string; state: string; durationMs: number }[];
    sheets: { white: string; transparent: string };
  };

  assert.equal(metadata.frameCount, 6);
  assert.equal(metadata.frames.length, 6);
  assert.equal(metadata.frameWidth, metadata.frameHeight);

  const whiteSheet = readPngInfo(join(ASSET_DIR, metadata.sheets.white));
  assert.equal(whiteSheet.width, metadata.frameWidth * metadata.frameCount);
  assert.equal(whiteSheet.height, metadata.frameHeight);

  const transparentSheet = readPngInfo(join(ASSET_DIR, metadata.sheets.transparent));
  assert.equal(transparentSheet.colorType, 6);
  assert.equal(transparentSheet.width, metadata.frameWidth * metadata.frameCount);
  assert.equal(transparentSheet.height, metadata.frameHeight);
  assert.equal(alphaAt(transparentSheet, 0, 0), 0);
  assert.equal(alphaAt(transparentSheet, transparentSheet.width - 1, transparentSheet.height - 1), 0);

  for (const frame of metadata.frames) {
    assert.match(frame.file, /^frame-0[1-6]-[a-z-]+\.png$/);
    assert.equal(frame.durationMs, 140);

    const info = readPngInfo(join(ASSET_DIR, frame.file));
    assert.equal(info.colorType, 6);
    assert.equal(info.width, metadata.frameWidth);
    assert.equal(info.height, metadata.frameHeight);
    assert.equal(alphaAt(info, 0, 0), 0);
    assert.equal(alphaAt(info, info.width - 1, info.height - 1), 0);
  }
});
