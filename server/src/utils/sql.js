// Escapes LIKE wildcards so user input such as "100%" matches literally.
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function containsPattern(text) {
  return `%${escapeLike(text)}%`;
}
