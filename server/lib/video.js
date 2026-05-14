import { parseBuffer } from "music-metadata";

export const getVideoDuration = async ({ buffer, mimeType, mimetype, size }) => {
  try {
    const metadata = await parseBuffer(buffer, {
      mimeType: mimeType || mimetype,
      size,
    });
    return Math.round(metadata.format.duration ?? 0);
  } catch {
    return 0;
  }
};
