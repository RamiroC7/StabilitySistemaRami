// R35: toda foto de perfil se achica ANTES de subirse. Se dibuja como mucho a
// 112 px CSS (224 px en pantallas retina), asi que 320 px de lado largo sobra.
// Una foto de celular de 4 MB queda en ~10-30 kB.
export const AVATAR_MAX_PX = 320;
export const AVATAR_TARGET_BYTES = 40 * 1024;
const QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4];

/** Escala (sin agrandar) para que el lado largo no pase de `max`. */
export function fitWithin(
  width: number,
  height: number,
  max: number = AVATAR_MAX_PX,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Redimensiona a <= 320 px y recodifica al formato mas liviano que soporte el
 * navegador (WebP; JPEG donde WebP no existe, ej. Safari viejo), bajando la
 * calidad hasta entrar en ~40 kB. Respeta la orientacion EXIF. Si algo falla,
 * o el resultado no es mas chico que el original, devuelve el archivo original
 * (nunca bloquea la subida).
 */
export async function compressAvatar(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let best: Blob | null = null;
    for (const type of ["image/webp", "image/jpeg"]) {
      for (const quality of QUALITIES) {
        const blob = await toBlob(canvas, type, quality);
        // Si el navegador no soporta el tipo, devuelve PNG: probar el siguiente.
        if (!blob || blob.type !== type) break;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= AVATAR_TARGET_BYTES) break;
      }
      if (best) break; // WebP funciono: no hace falta probar JPEG
    }

    if (!best || best.size >= file.size) return file;
    const ext = best.type === "image/webp" ? "webp" : "jpg";
    return new File([best], `avatar.${ext}`, { type: best.type });
  } catch {
    return file;
  }
}
