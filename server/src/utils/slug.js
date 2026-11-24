// "Arts & Culture" -> "arts-culture". Accents are dropped ("Café" -> "cafe").
// Returns '' when the name has no Latin letters or digits at all.
export function slugify(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
}
