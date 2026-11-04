import { useI18n } from 'vue-i18n'
import type { FieldDef } from '@/domain/types'

/** A friendly name for a deck field. A custom field falls back to its column header. */
export function useFieldLabel() {
  const { t, te } = useI18n()
  return (field: FieldDef) => (te(`fields.${field.key}`) ? t(`fields.${field.key}`) : field.column)
}
