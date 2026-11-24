import { findViewableImage, loadImageData } from '../services/image.service.js';

const ONE_DAY_SECONDS = 24 * 60 * 60;

// Image URLs carry a version (?v=…), so a cached copy is never outdated for
// long; the ETag lets a browser revalidate without downloading it again.
// Images only some people may see are marked private, so shared caches skip them.
async function sendImage(kind, req, res) {
  const id = req.validated.params.id;
  const image = await findViewableImage(kind, id, req.user);
  res.set({
    'Content-Type': image.mimeType,
    'Cache-Control': `${image.isPublic ? 'public' : 'private'}, max-age=${ONE_DAY_SECONDS}`,
    ETag: `"${kind}-${id}-${image.updatedAt.getTime()}-${image.byteSize}"`,
    'Content-Disposition': 'inline',
  });
  // Checked before loading the bytes, so an unchanged image costs no blob read.
  if (req.fresh) return res.status(304).end();
  res.send(await loadImageData(kind, id));
}

export const getAvatar = (req, res) => sendImage('avatar', req, res);
export const getCover = (req, res) => sendImage('cover', req, res);
