const CLOUDINARY_UPLOAD_URL =
  /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/**
 * Add automatic format and quality to a Cloudinary image URL that has no
 * format/quality transformation yet. Non-Cloudinary URLs are returned as is.
 */
export function optimizeImageUrl(src) {
  const match = CLOUDINARY_UPLOAD_URL.exec(src ?? "");
  if (!match) return src;
  const [, base, rest] = match;
  // Transformation segments come before the version (v123/) or public ID.
  const transformations = rest.split("/").slice(0, -1).filter((s) => !/^v\d+$/.test(s));
  if (transformations.some((s) => /(^|,)(f|q)_/.test(s))) return src;
  return `${base}f_auto,q_auto/${rest}`;
}
