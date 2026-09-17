const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_MIN_BYTES = 32;

type AvatarMimeType = typeof ALLOWED_AVATAR_MIME_TYPES[number];

const dataUrlPattern = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const hasPngSignature = (buffer: Buffer) =>
  buffer.length >= 8
  && buffer[0] === 0x89
  && buffer[1] === 0x50
  && buffer[2] === 0x4e
  && buffer[3] === 0x47
  && buffer[4] === 0x0d
  && buffer[5] === 0x0a
  && buffer[6] === 0x1a
  && buffer[7] === 0x0a;

const hasJpegSignature = (buffer: Buffer) =>
  buffer.length >= 4
  && buffer[0] === 0xff
  && buffer[1] === 0xd8
  && buffer[2] === 0xff;

const hasWebpSignature = (buffer: Buffer) =>
  buffer.length >= 12
  && buffer.toString('ascii', 0, 4) === 'RIFF'
  && buffer.toString('ascii', 8, 12) === 'WEBP';

const signatureMatches = (mimeType: AvatarMimeType, buffer: Buffer) => {
  if (mimeType === 'image/png') return hasPngSignature(buffer);
  if (mimeType === 'image/jpeg') return hasJpegSignature(buffer);
  return hasWebpSignature(buffer);
};

export const normalizeAvatarDataUrl = (value: string) => {
  const match = value.match(dataUrlPattern);

  if (!match) {
    throw new Error('Profile picture must be a JPEG, PNG, or WebP image.');
  }

  const mimeType = match[1] as AvatarMimeType;
  const base64 = match[2];

  if (!ALLOWED_AVATAR_MIME_TYPES.includes(mimeType)) {
    throw new Error('Profile picture type is not supported.');
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < AVATAR_MIN_BYTES || buffer.length > AVATAR_MAX_BYTES) {
    throw new Error('Profile picture must be between 32 bytes and 512 KB.');
  }

  const normalizedBase64 = buffer.toString('base64');
  if (normalizedBase64.replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
    throw new Error('Profile picture data is invalid.');
  }

  if (!signatureMatches(mimeType, buffer)) {
    throw new Error('Profile picture content does not match its declared type.');
  }

  return `data:${mimeType};base64,${normalizedBase64}`;
};
