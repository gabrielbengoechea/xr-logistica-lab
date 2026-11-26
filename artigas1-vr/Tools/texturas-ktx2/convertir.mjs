// Convierte las texturas de la Tierra del recorrido web (web-dashboard/public/artigas1/*.webp) a KTX2.
//
// Por qué: una WebP pesa poco para bajar, pero en la GPU se descomprime a RGBA (4 bytes por píxel, más un
// tercio por los mipmaps). Un KTX2 (Basis Universal) se transcodifica en el visor a un formato comprimido de
// GPU (ASTC en el Quest), que ocupa una cuarta parte o menos, y se queda comprimido en la memoria.
//
//   - Día (color): ETC1S, chico para bajar; el color de la Tierra lo tolera bien.
//   - Noche (datos: rojo = luces, verde = agua): UASTC con RDO y zstd, que respeta mejor cada canal.
//     Se marca como lineal (no sRGB): son datos, no color.
// Se invierte en Y porque el WebP se carga con flipY y el KTX2 no: así las UV del shader siguen sirviendo.
//
//   cd artigas1-vr/Tools/texturas-ktx2 && npm install && npm run convertir
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const carpeta = path.resolve(aqui, '../../../web-dashboard/public/artigas1');

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

const COLOR = { isUASTC: false, qualityLevel: 230, compressionLevel: 4, isPerceptual: true, generateMipmap: true, isYFlip: true, imageDecoder };
const DATOS = { isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 1, needSupercompression: true, isPerceptual: false, generateMipmap: true, isYFlip: true, imageDecoder };

const TEXTURAS = [
  ['tierra_base_dia', COLOR],
  ['tierra_detalle_dia', COLOR],
  ['tierra_base_noche', DATOS],
  ['tierra_detalle_noche', DATOS],
];

for (const [nombre, opciones] of TEXTURAS) {
  const origen = path.join(carpeta, `${nombre}.webp`);
  const destino = path.join(carpeta, `${nombre}.ktx2`);
  const fuente = new Uint8Array(await readFile(origen));
  const ktx2 = await encodeToKTX2(fuente, opciones);
  await writeFile(destino, ktx2);
  console.log(`${nombre}: ${((await stat(origen)).size / 1024).toFixed(0)} kB WebP → ${(ktx2.byteLength / 1024).toFixed(0)} kB KTX2`);
}
