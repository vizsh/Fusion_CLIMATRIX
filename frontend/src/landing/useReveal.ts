import { useEffect } from 'react'

const FALLBACK_MS = 1200

/**
 * Adds `.in` to `.reveal` / `.reveal-x` elements once they scroll into view.
 *
 * Fails open — if no IntersectionObserver entry has arrived shortly after
 * mount, everything is revealed unconditionally (guards against broken webviews).
 */
export function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal, .reveal-x'))
    if (!els.length) return

    const revealAll = () => els.forEach((el) => el.classList.add('in'))

    if (typeof IntersectionObserver !== 'function') {
      revealAll()
      return
    }

    let delivered = false
    const io = new IntersectionObserver(
      (entries) => {
        delivered = true
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '-60px 0px' },
    )
    els.forEach((el) => io.observe(el))

    const fallback = window.setTimeout(() => {
      if (!delivered) revealAll()
    }, FALLBACK_MS)

    return () => {
      window.clearTimeout(fallback)
      io.disconnect()
    }
  }, [])
}
