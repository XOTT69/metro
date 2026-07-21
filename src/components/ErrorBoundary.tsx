import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Metro PWA rendering error', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    const english = document.documentElement.lang === 'en'
    return (
      <main className="fatal-error" role="alert">
        <span className="brand-mark">M</span>
        <h1>{english ? 'The app could not open' : 'Не вдалося відкрити застосунок'}</h1>
        <p>{english ? 'Your saved stations and routes remain on this device. Reload the page to try again.' : 'Збережені станції та маршрути залишилися на цьому пристрої. Оновіть сторінку, щоб спробувати ще раз.'}</p>
        <button type="button" onClick={() => window.location.reload()}>{english ? 'Reload' : 'Оновити сторінку'}</button>
      </main>
    )
  }
}
