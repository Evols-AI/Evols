import * as amplitude from '@amplitude/analytics-browser'

export interface AnalyticsUser {
  id: number
  email: string
  tenant_id: number
  role: string
  full_name?: string
}

export interface EventProperties {
  [key: string]: unknown
}

class Analytics {
  private isInitialized = false

  init() {
    if (this.isInitialized) return

    const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY
    if (!apiKey) return

    amplitude.init(apiKey, {
      defaultTracking: {
        pageViews: false,
        sessions: false,
        formInteractions: false,
        fileDownloads: false,
      },
      logLevel: amplitude.Types.LogLevel.None,
      flushIntervalMillis: 10000,
      flushQueueSize: 30,
    })

    this.isInitialized = true
  }

  identify(user: AnalyticsUser) {
    if (!this.isInitialized) return

    amplitude.setUserId(user.id.toString())

    const identifyEvent = new amplitude.Identify()
    identifyEvent.set('email', user.email)
    identifyEvent.set('tenant_id', user.tenant_id)
    identifyEvent.set('role', user.role)
    if (user.full_name) {
      identifyEvent.set('name', user.full_name)
    }

    amplitude.identify(identifyEvent)
  }

  track(eventName: string, properties?: EventProperties) {
    if (!this.isInitialized) return

    setTimeout(() => {
      try {
        amplitude.track(eventName, {
          ...properties,
          environment: process.env.NODE_ENV,
        })
      } catch {
        // fail silently
      }
    }, 0)
  }

  page(pageName: string, properties?: EventProperties) {
    if (process.env.NEXT_PUBLIC_DISABLE_PAGE_TRACKING === 'true') return
    this.track('Page Viewed', { page: pageName, ...properties })
  }

  reset() {
    if (!this.isInitialized) return
    amplitude.reset()
  }

  setUserProperties(properties: EventProperties) {
    if (!this.isInitialized) return

    const identifyEvent = new amplitude.Identify()
    Object.entries(properties).forEach(([key, value]) => {
      identifyEvent.set(key, value as string | number | boolean)
    })
    amplitude.identify(identifyEvent)
  }

  incrementUserProperty(property: string, value: number = 1) {
    if (!this.isInitialized) return

    const identifyEvent = new amplitude.Identify()
    identifyEvent.add(property, value)
    amplitude.identify(identifyEvent)
  }

  trackRevenue(amount: number, productId?: string) {
    if (!this.isInitialized) return

    const revenue = new amplitude.Revenue()
      .setPrice(amount)
      .setQuantity(1)

    if (productId) {
      revenue.setProductId(productId)
    }

    amplitude.revenue(revenue)
  }
}

export const analytics = new Analytics()

export const trackEvent = (eventName: string, properties?: EventProperties) => {
  analytics.track(eventName, properties)
}

export const identifyUser = (user: AnalyticsUser) => {
  analytics.identify(user)
}

export const trackPage = (pageName: string, properties?: EventProperties) => {
  analytics.page(pageName, properties)
}

export const resetAnalytics = () => {
  analytics.reset()
}
