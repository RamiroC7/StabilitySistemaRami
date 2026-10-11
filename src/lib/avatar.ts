/** Imagen que se muestra a quien no cargo foto (3 kB, en `public/`). */
export const DEFAULT_AVATAR = "/avatar-default.webp";

const PUBLIC_PATH = "/storage/v1/object/public/profile-images/";
const RENDER_PATH = "/storage/v1/render/image/public/profile-images/";

/**
 * URL de un avatar al tamano que realmente se dibuja (R7/R9).
 *
 * Las fotos originales pesan ~1,6 MB (hasta 4 MB) y se muestran a 56 px: con la
 * transformacion de Supabase Storage la misma foto baja a ~2-10 kB. Se pide al
 * doble del tamano CSS para pantallas retina. Sin foto devuelve la imagen
 * predeterminada (`DEFAULT_AVATAR`), asi nadie queda con un hueco ni con iniciales. Las URLs que no son del bucket
 * `profile-images` (ej. ui-avatars) se devuelven tal cual.
 *
 * Ojo: la URL guardada en la base sigue siendo la original (la usa
 * `deleteProfileImage`); esto se aplica solo al renderizar.
 */
export function avatarSrc(
  url: string | null | undefined,
  cssPx: number,
): string {
  if (!url) return DEFAULT_AVATAR;
  if (!url.includes(PUBLIC_PATH)) return url;
  const size = Math.round(cssPx * 2);
  return `${url.replace(PUBLIC_PATH, RENDER_PATH)}?width=${size}&height=${size}&resize=cover&quality=75`;
}
