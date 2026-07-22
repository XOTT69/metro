import { useEffect } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const isVisible = (element: HTMLElement) => {
  const style = window.getComputedStyle(element)
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && element.getClientRects().length > 0
    && element.getAttribute('aria-hidden') !== 'true'
}

const focusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => isVisible(element) && element.tabIndex >= 0)

const visibleDialogs = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
    .filter(isVisible)

const closeControl = (dialog: HTMLElement) => dialog.querySelector<HTMLElement>([
  '[data-dialog-close]',
  '.trip-close',
  '.station-page-back',
  '.catalog-back-button',
  'button[aria-label="Закрити"]',
  'button[aria-label="Close"]',
  'button[aria-label="Назад"]',
  'button[aria-label="Back"]',
].join(','))

/**
 * Adds shared accessibility behaviour without coupling each screen to a UI framework:
 * - stable main landmark for the skip link;
 * - aria-current on the bottom navigation;
 * - focus trapping, Escape handling and focus restoration for modal screens;
 * - arrow-key navigation between bottom navigation buttons.
 */
export const useAccessibilityEnhancements = () => {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null
    let previousFocus: HTMLElement | null = null
    let previousBodyOverflow = ''
    let focusTimer: number | undefined

    const ensureMainLandmark = () => {
      const main = document.querySelector<HTMLElement>('main')
      if (!main) return
      if (!main.id) main.id = 'main-content'
      if (!main.hasAttribute('tabindex')) main.tabIndex = -1
    }

    const syncNavigation = () => {
      document.querySelectorAll<HTMLButtonElement>('.bottom-nav button').forEach((button) => {
        if (button.classList.contains('active')) button.setAttribute('aria-current', 'page')
        else button.removeAttribute('aria-current')
      })
    }

    const syncDialog = () => {
      const nextDialog = visibleDialogs().at(-1) ?? null
      if (nextDialog === activeDialog) return

      activeDialog?.removeAttribute('data-a11y-active-dialog')

      if (!nextDialog) {
        activeDialog = null
        document.body.style.overflow = previousBodyOverflow
        const target = previousFocus
        previousFocus = null
        window.clearTimeout(focusTimer)
        focusTimer = window.setTimeout(() => {
          if (target?.isConnected) target.focus({ preventScroll: true })
        }, 0)
        return
      }

      if (!activeDialog) {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
        previousBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }

      activeDialog = nextDialog
      activeDialog.setAttribute('data-a11y-active-dialog', 'true')
      if (!activeDialog.hasAttribute('tabindex')) activeDialog.tabIndex = -1

      window.clearTimeout(focusTimer)
      focusTimer = window.setTimeout(() => {
        if (!activeDialog) return
        const preferred = activeDialog.querySelector<HTMLElement>('[autofocus], [data-autofocus]')
        const target = preferred && isVisible(preferred)
          ? preferred
          : focusableElements(activeDialog)[0] ?? activeDialog
        target.focus({ preventScroll: true })
      }, 0)
    }

    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (!activeDialog) return

      if (event.key === 'Escape') {
        const close = closeControl(activeDialog)
        if (close) {
          event.preventDefault()
          event.stopPropagation()
          close.click()
        }
        return
      }

      if (event.key !== 'Tab') return
      const items = focusableElements(activeDialog)
      if (items.length === 0) {
        event.preventDefault()
        activeDialog.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement

      if (event.shiftKey && (current === first || !activeDialog.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const handleNavigationKeyboard = (event: KeyboardEvent) => {
      const target = event.target
      if (!(target instanceof HTMLButtonElement)) return
      const nav = target.closest<HTMLElement>('.bottom-nav')
      if (!nav) return

      const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
      const index = buttons.indexOf(target)
      if (index < 0) return

      let nextIndex: number | null = null
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % buttons.length
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + buttons.length) % buttons.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = buttons.length - 1
      if (nextIndex === null) return

      event.preventDefault()
      buttons[nextIndex].focus()
    }

    const observer = new MutationObserver(() => {
      ensureMainLandmark()
      syncNavigation()
      syncDialog()
    })

    ensureMainLandmark()
    syncNavigation()
    syncDialog()
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden'],
    })
    document.addEventListener('keydown', handleDialogKeyboard, true)
    document.addEventListener('keydown', handleNavigationKeyboard)

    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', handleDialogKeyboard, true)
      document.removeEventListener('keydown', handleNavigationKeyboard)
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousBodyOverflow
      activeDialog?.removeAttribute('data-a11y-active-dialog')
    }
  }, [])
}
