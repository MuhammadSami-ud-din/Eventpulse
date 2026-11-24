import express from 'express';
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from '../utils/imageType.js';

// Reads a raw image body (up to 1 MB) on the upload routes only. The declared
// Content-Type just decides whether to read it; the service then checks the
// real type from the bytes. Anything larger is a 413 from the body parser.
export const imageBody = express.raw({ type: IMAGE_TYPES, limit: IMAGE_MAX_BYTES });
