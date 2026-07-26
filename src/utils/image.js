/**
 * Client-side image normalisation for anything Scott attaches.
 *
 * Straight off a phone, an attachment is 3–8 MB and often `image/heic`. Both
 * ends of the app disliked that: Supabase Storage buckets cap size and allow
 * only png/jpeg/webp/gif, and raw base64 made vision requests enormous and
 * slow. Re-encoding once, up front, to a JPEG with a ≤1568px long edge (the
 * size Claude's vision reads at) fixes uploads and vision in one step.
 */

/** Claude's vision long-edge sweet spot — bigger buys no extra detail. */
export const MAX_EDGE = 1568;

export const readDataUrl = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});

/**
 * @returns {Promise<{dataUrl: string, media_type: string, file: File} | null>}
 *   null when the browser can't decode the format (e.g. HEIC outside Safari) —
 *   callers should then fall back to the original file and bytes.
 */
export async function normaliseImage(file, dataUrl) {
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", 0.85);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return null;
    const name = `${(file.name || "screenshot").replace(/\.[^.]+$/, "")}.jpg`;
    return { dataUrl: out, media_type: "image/jpeg", file: new File([blob], name, { type: "image/jpeg" }) };
  } catch {
    return null;
  }
}

/** Convenience for upload-only callers: give me a bucket-legal File. */
export async function toUploadableImage(file) {
  try {
    const dataUrl = await readDataUrl(file);
    const norm = await normaliseImage(file, dataUrl);
    return norm?.file || file;
  } catch {
    return file;
  }
}
