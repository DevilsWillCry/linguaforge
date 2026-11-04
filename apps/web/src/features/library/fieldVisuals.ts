import {
  ArrowUpWideNarrow,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  CircleAlert,
  CircleDashed,
  Code,
  CodeXml,
  Coffee,
  FileText,
  Flag,
  Gamepad2,
  GitCompareArrows,
  GraduationCap,
  Hash,
  Languages,
  Lightbulb,
  Link,
  Link2,
  ListChecks,
  MessageCircle,
  MessageSquareQuote,
  MessagesSquare,
  Music4,
  Palette,
  PenLine,
  Puzzle,
  Quote,
  Route,
  Shapes,
  Siren,
  Smile,
  Sparkles,
  Star,
  Swords,
  Tag,
  ToggleRight,
  Type,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-vue-next'

/** Names of the --hue-* tokens in styles.css. */
export const BADGE_COLORS = ['rose', 'amber', 'green', 'teal', 'sky', 'indigo', 'violet', 'slate'] as const
export type BadgeColor = (typeof BADGE_COLORS)[number]

export interface Visual {
  icon: LucideIcon
  color: BadgeColor
}

/**
 * Picks a color from the text alone, so an option added in Settings always gets
 * the same color, on every device and after every reload.
 */
export function colorFor(value: string): BadgeColor {
  let hash = 0
  for (const char of value) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  return BADGE_COLORS[hash % BADGE_COLORS.length] as BadgeColor
}

export const KIND_VISUALS: Record<string, Visual> = {
  Word: { icon: Type, color: 'slate' },
  Expression: { icon: MessageSquareQuote, color: 'sky' },
  Slang: { icon: Zap, color: 'rose' },
  Idiom: { icon: Lightbulb, color: 'amber' },
  Connector: { icon: Link2, color: 'teal' },
  'Sentence Pattern': { icon: Puzzle, color: 'violet' },
  'Phrasal Verb': { icon: Route, color: 'indigo' },
  'Modal Verb': { icon: ToggleRight, color: 'green' },
  'N/A': { icon: CircleDashed, color: 'slate' },
}

/** Tones share a color by register, so the color tells you how a phrase will land. */
export const TONE_COLORS: Record<string, BadgeColor> = {
  // Relaxed
  Casual: 'teal',
  Informal: 'teal',
  Chill: 'teal',
  'Internet Slang': 'teal',
  Neutral: 'slate',
  // Polished
  Formal: 'indigo',
  Polite: 'indigo',
  Professional: 'indigo',
  Confident: 'sky',
  // Upbeat
  Excited: 'green',
  Funny: 'green',
  Motivational: 'green',
  Romantic: 'violet',
  // Heightened
  Emotional: 'amber',
  Dramatic: 'amber',
  Awkward: 'amber',
  // Risky: use with care
  Sarcastic: 'rose',
  Frustrated: 'rose',
  Aggressive: 'rose',
  Rude: 'rose',
}

export const CONTEXT_ICONS: Record<string, LucideIcon> = {
  'Daily Conversation': Coffee,
  Workplace: Briefcase,
  Friendly: Smile,
  Gaming: Gamepad2,
  Arguments: Swords,
  'School / College': GraduationCap,
  'Small Talk': MessageCircle,
  Business: Building2,
  'Coding / Tech': CodeXml,
}

export const TRIGGER_ICONS: Record<string, LucideIcon> = {
  'IA Tool': Bot,
  Video,
  Conversation: MessagesSquare,
  Reading: BookOpen,
  'Own mistake': CircleAlert,
}

export const IMPORTANCE_VISUALS: Record<string, Visual> = {
  Important: { icon: Star, color: 'amber' },
  Advanced: { icon: GraduationCap, color: 'violet' },
  Critical: { icon: Siren, color: 'rose' },
}

/** The small icon beside each column name. Unknown columns show their name alone. */
export const FIELD_ICONS: Record<string, LucideIcon> = {
  priority: ArrowUpWideNarrow,
  kind: Shapes,
  text: Languages,
  meanings: Lightbulb,
  tone: Music4,
  context: Palette,
  realExamples: Quote,
  ownExamples: PenLine,
  variations: GitCompareArrows,
  collocations: ListChecks,
  status: Flag,
  importance: Star,
  trigger: Sparkles,
  source: Link,
  category: Hash,
  whatItDoes: FileText,
  syntax: Code,
  reactEquivalent: GitCompareArrows,
  useCase: ListChecks,
  importantNotes: FileText,
  miniExample: CodeXml,
}

/** Columns holding code. Other multi-line columns, like descriptions, are ordinary prose. */
const CODE_FIELDS = new Set(['syntax', 'reactEquivalent', 'miniExample'])
export const isCodeField = (key: string) => CODE_FIELDS.has(key)

export const kindVisual = (kind: string): Visual =>
  KIND_VISUALS[kind] ?? { icon: Tag, color: colorFor(kind) }

export const toneColor = (tone: string): BadgeColor => TONE_COLORS[tone] ?? colorFor(tone)

export const contextIcon = (context: string): LucideIcon => CONTEXT_ICONS[context] ?? Tag

export const triggerIcon = (trigger: string): LucideIcon => TRIGGER_ICONS[trigger] ?? Tag

export const importanceVisual = (importance: string): Visual =>
  IMPORTANCE_VISUALS[importance] ?? { icon: Tag, color: colorFor(importance) }
