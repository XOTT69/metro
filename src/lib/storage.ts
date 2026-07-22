import { useCallback, useEffect, useState, type SetStateAction } from 'react'

const STORED_STATE_EVENT = 'metro-stored-state'

interface StoredStateEventDetail {
  key: string
  value: unknown
}

const readStoredValue = <T,>(key: string, initialValue: T): T => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as T) : initialValue
  } catch {
    return initialValue
  }
}

export const useStoredState = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(() => readStoredValue(key, initialValue))

  useEffect(() => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(initialValue))

    const handleStoredState = (event: Event) => {
      const detail = (event as CustomEvent<StoredStateEventDetail>).detail
      if (!detail || detail.key !== key) return
      setValue(detail.value as T)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      setValue(event.newValue ? (JSON.parse(event.newValue) as T) : initialValue)
    }

    window.addEventListener(STORED_STATE_EVENT, handleStoredState)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(STORED_STATE_EVENT, handleStoredState)
      window.removeEventListener('storage', handleStorage)
    }
  }, [initialValue, key])

  const setStoredValue = useCallback((nextValue: SetStateAction<T>) => {
    setValue((current) => {
      const resolved = typeof nextValue === 'function'
        ? (nextValue as (previous: T) => T)(current)
        : nextValue
      localStorage.setItem(key, JSON.stringify(resolved))
      window.dispatchEvent(new CustomEvent<StoredStateEventDetail>(STORED_STATE_EVENT, {
        detail: { key, value: resolved },
      }))
      return resolved
    })
  }, [key])

  return [value, setStoredValue] as const
}
