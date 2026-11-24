export function legacyPagesLocation({ pathname, search, hash }, base) {
  if (hash.startsWith('#/') || !pathname.startsWith(base)) return null
  const route = pathname.slice(base.length)
  return route ? `${base}#/${route}${search}${hash}` : null
}
