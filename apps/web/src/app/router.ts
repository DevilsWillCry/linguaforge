import { createRouter, createWebHistory } from 'vue-router'
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  Library,
  MessageCircle,
  PlaySquare,
  Repeat2,
  Settings,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-vue-next'

export interface NavItem {
  name: string
  path: string
  /** i18n key under `nav`. */
  label: string
  icon: LucideIcon
  /** Shown in the mobile bottom bar, which has room for 5 items. */
  mobileTab: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'today', path: '/', label: 'today', icon: Sun, mobileTab: true },
  { name: 'library', path: '/library', label: 'library', icon: Library, mobileTab: true },
  { name: 'enrich', path: '/enrich', label: 'enrich', icon: Sparkles, mobileTab: false },
  { name: 'review', path: '/review', label: 'review', icon: Repeat2, mobileTab: false },
  { name: 'video', path: '/video', label: 'video', icon: PlaySquare, mobileTab: true },
  { name: 'tutor', path: '/tutor', label: 'tutor', icon: MessageCircle, mobileTab: true },
  { name: 'reading', path: '/reading', label: 'reading', icon: BookOpen, mobileTab: false },
  { name: 'stats', path: '/stats', label: 'stats', icon: BarChart3, mobileTab: true },
  { name: 'settings', path: '/settings', label: 'settings', icon: Settings, mobileTab: false },
]

export const BrandIcon = GraduationCap

const placeholder = () => import('@/shared/ui/PlaceholderPage.vue')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'today', component: () => import('@/features/today/TodayPage.vue'), meta: { label: 'today' } },
    { path: '/library', name: 'library', component: () => import('@/features/library/LibraryPage.vue'), meta: { label: 'library', wide: true } },
    { path: '/enrich', name: 'enrich', component: () => import('@/features/enrichment/EnrichmentPage.vue'), meta: { label: 'enrich', wide: true } },
    { path: '/review', name: 'review', component: () => import('@/features/review/ReviewPage.vue'), meta: { label: 'review' } },
    { path: '/video', name: 'video', component: () => import('@/features/video/VideoPage.vue'), meta: { label: 'video', wide: true } },
    { path: '/tutor', name: 'tutor', component: () => import('@/features/tutor/TutorPage.vue'), meta: { label: 'tutor' } },
    { path: '/reading', name: 'reading', component: () => import('@/features/reading/ReadingPage.vue'), meta: { label: 'reading', wide: true } },
    { path: '/stats', name: 'stats', component: placeholder, meta: { label: 'stats', phase: 6 } },
    { path: '/settings', name: 'settings', component: () => import('@/features/settings/SettingsPage.vue'), meta: { label: 'settings' } },
    { path: '/capture', name: 'capture', component: () => import('@/features/capture/CapturePage.vue'), meta: { label: 'library' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
