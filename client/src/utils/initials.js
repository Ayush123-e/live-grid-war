/**
 * Helper to dynamically derive 2-character initials from a username.
 * Supports camelCase, PascalCase, snake_case, kebab-case, and spaces.
 */
export function getInitials(username) {
  if (!username) return '?'
  
  const cleaned = username.trim()
  
  // Split by common delimiters or uppercase letter boundaries (PascalCase)
  const parts = cleaned.split(/(?=[A-Z])|[\s_-]+/).filter(Boolean)
  
  if (parts.length >= 2) {
    const first = parts[0][0] || ''
    const second = parts[1][0] || ''
    return (first + second).toUpperCase()
  }
  
  return cleaned.substring(0, 2).toUpperCase()
}
