export const cleanText = (value, max = 500) =>
  String(value || '').trim().slice(0, max)

export const isPositiveAmount = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0
}

export const isValidDateValue = (value) => {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime())
}

export function validateRequired(payload, fields) {
  const missing = fields.find(({ key }) => !cleanText(payload[key]))
  return missing ? `${missing.label} is required` : ''
}

export function validateAmount(value, label = 'Amount') {
  return isPositiveAmount(value) ? '' : `${label} must be greater than zero`
}

export function validateDate(value, label = 'Date') {
  return isValidDateValue(value) ? '' : `${label} must be a valid date`
}
