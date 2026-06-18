import bcrypt from 'bcryptjs'
import { escapeHtml } from './utils'

const BCRYPT_PREFIX = /^\$2[aby]\$/

export const isBcryptHash = (value) =>
  typeof value === 'string' && BCRYPT_PREFIX.test(value)

export const hashPassword = async (password) => {
  const clean = String(password || '').trim()
  if (!clean) return ''
  if (isBcryptHash(clean)) return clean
  return bcrypt.hash(clean, 12)
}

export const verifyPassword = (password, hash) =>
  bcrypt.compare(String(password || '').trim(), hash)

export const escapePostgrestSearch = (value) =>
  String(value || '')
    .trim()
    .slice(0, 120)
    .replace(/[%*,()]/g, ' ')
    .replace(/\s+/g, ' ')

export const buildWorkflowInfoHtml = (name, time) =>
  `<b>${escapeHtml(name || '')}</b><br><span style="font-size:10px;color:#64748b">${escapeHtml(time || '')}</span>`

export const sanitizeInfoHtml = (value) => {
  if (!value) return ''

  return escapeHtml(value)
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/&lt;b&gt;/gi, '<b>')
    .replace(/&lt;\/b&gt;/gi, '</b>')
    .replace(/&lt;strong&gt;/gi, '<b>')
    .replace(/&lt;\/strong&gt;/gi, '</b>')
    .replace(/&lt;span(?:\s+style=(?:&quot;([^&]*)&quot;|&#39;([^&]*)&#39;))?&gt;/gi, (_, doubleQuotedStyle = '', singleQuotedStyle = '') => {
      const style = doubleQuotedStyle || singleQuotedStyle
      const safeStyle = String(style)
        .split(';')
        .map(part => part.trim())
        .filter(part => /^(font-size:\s*\d{1,2}px|color:\s*#[0-9a-f]{3,6})$/i.test(part))
        .join(';')
      return safeStyle ? `<span style="${safeStyle}">` : '<span>'
    })
    .replace(/&lt;\/span&gt;/gi, '</span>')
}
