import { useEventListener, useResizeObserver } from '@vueuse/core'
import { ref, type Ref } from 'vue'

/** A smaller movement counts as a click, so a slightly shaky click still edits the cell. */
const DRAG_THRESHOLD_PX = 6
/** Controls that need the pointer for themselves. */
const NO_PAN_TARGETS = 'input, select, textarea, a, [role="separator"]'

/**
 * Sideways navigation for a wide table: drag with the mouse, or scroll a page at a time.
 * Touch screens are left alone, because they already scroll natively.
 */
export function useTableScroll(
  scroller: Readonly<Ref<HTMLElement | null>>,
  content: Readonly<Ref<HTMLElement | null>>,
) {
  const canScrollLeft = ref(false)
  const canScrollRight = ref(false)
  const panning = ref(false)

  function update() {
    const el = scroller.value
    if (!el) return
    canScrollLeft.value = el.scrollLeft > 1
    canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
  }

  useEventListener(scroller, 'scroll', update, { passive: true })
  // Both, because resizing the window and resizing a column each change what fits.
  useResizeObserver(scroller, update)
  useResizeObserver(content, update)

  /** Moves by most of a screen, leaving some columns in view to keep your place. */
  function scrollByPage(direction: -1 | 1, pinnedWidth: number) {
    const el = scroller.value
    if (!el) return
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({
      left: direction * (el.clientWidth - pinnedWidth) * 0.8,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  /** The drag ends with a click event, which must not open the cell it landed on. */
  function swallowNextClick(el: HTMLElement) {
    const swallow = (event: Event) => {
      event.stopPropagation()
      event.preventDefault()
    }
    el.addEventListener('click', swallow, { capture: true, once: true })
    // Some drags produce no click, and the listener must not eat a later real one.
    setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0)
  }

  useEventListener(scroller, 'pointerdown', (down: PointerEvent) => {
    const el = scroller.value
    if (!el || down.pointerType === 'touch' || down.button !== 0) return
    if ((down.target as Element).closest(NO_PAN_TARGETS)) return

    const startX = down.clientX
    const startLeft = el.scrollLeft
    let dragging = false

    const onMove = (move: PointerEvent) => {
      const distance = move.clientX - startX
      if (!dragging) {
        if (Math.abs(distance) < DRAG_THRESHOLD_PX) return
        if (el.scrollWidth <= el.clientWidth) return
        dragging = true
        panning.value = true
        getSelection()?.removeAllRanges()
        el.setPointerCapture(down.pointerId)
      }
      el.scrollLeft = startLeft - distance
    }

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      if (!dragging) return
      panning.value = false
      swallowNextClick(el)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  })

  return { canScrollLeft, canScrollRight, panning, scrollByPage }
}
