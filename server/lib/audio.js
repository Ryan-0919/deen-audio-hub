import { parseBuffer } from "music-metadata";

export const getAudioDuration = async (file) => {
  try {
    const metadata = await parseBuffer(file.buffer, {
      mimeType: file.mimetype,
      size: file.size,
    });
    return Math.round(metadata.format.duration ?? 0);
  } catch (error) {
    return 0;
  }
};
