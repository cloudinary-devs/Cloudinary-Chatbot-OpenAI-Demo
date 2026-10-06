import { v2 as cloudinary } from "cloudinary";

// The SDK reads CLOUDINARY_URL from the environment automatically.
export const isCloudinaryConfigured = Boolean(cloudinary.config().cloud_name);

const FOLDER = process.env.CLOUDINARY_FOLDER ?? "openai-chatbot";
export const UPLOADS_FOLDER = `${FOLDER}/uploads`;
export const AVATARS_FOLDER = `${FOLDER}/avatars`;

/**
 * Upload a Buffer or data URI to Cloudinary.
 * @returns {Promise<import("cloudinary").UploadApiResponse>}
 */
export function uploadImage(source, options) {
  if (typeof source === "string") {
    return cloudinary.uploader.upload(source, { resource_type: "image", ...options });
  }
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: "image", ...options }, (error, result) =>
        error ? reject(error) : resolve(result)
      )
      .end(source);
  });
}

/** Optimized delivery URL for showing an image in the chat thread. */
export function displayUrl(publicId) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 800, crop: "limit" },
      { fetch_format: "auto", quality: "auto" },
    ],
  });
}

/** Small square preview for the composer's attachment tray. */
export function thumbnailUrl(publicId) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 128, height: 128, crop: "fill", gravity: "auto" },
      { fetch_format: "auto", quality: "auto" },
    ],
  });
}

/** Square, face-aware avatar crop sized for 2x displays. */
export function avatarUrl(publicId) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 96, height: 96, crop: "fill", gravity: "auto" },
      { fetch_format: "auto", quality: "auto" },
    ],
  });
}

/**
 * URL handed to OpenAI vision input. f_auto is avoided here because it
 * negotiates on the fetcher's Accept header and could return AVIF, which
 * OpenAI does not accept; an explicit JPEG keeps it deterministic.
 */
export function modelInputUrl(publicId) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 1024, height: 1024, crop: "limit" },
      { fetch_format: "jpg", quality: "auto" },
    ],
  });
}
