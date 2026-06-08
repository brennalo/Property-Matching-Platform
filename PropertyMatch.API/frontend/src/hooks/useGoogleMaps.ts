/**
 * useGoogleMaps — singleton Google Maps JS loader.
 *
 * Rules:
 *  - The Maps script is injected EXACTLY ONCE per page lifetime.
 *  - Any number of components can call useGoogleMaps(); they all share one Promise.
 *  - The API key is passed in once (from App.tsx after fetching /api/config/maps-key).
 *  - Once ready, window.__gmapsReady = true so instant reads work on re-renders.
 */

declare global {
    interface Window {
        google: any
        __gmapsReady: boolean
        __gmapsInitCb: () => void
    }
}

// Module-level singleton — survives React re-renders and HMR
let _loadPromise: Promise<void> | null = null

export function initGoogleMaps(apiKey: string): Promise<void> {
    // Already loaded
    if (window.__gmapsReady) return Promise.resolve()

    // Already in flight
    if (_loadPromise) return _loadPromise

    // Sanity check — refuse to run if a conflicting script already exists
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existing) {
        // Another script is already loading — just wait for the global callback
        _loadPromise = new Promise(resolve => {
            if (window.__gmapsReady) { resolve(); return }
            const iv = setInterval(() => {
                if (window.__gmapsReady) { clearInterval(iv); resolve() }
            }, 100)
        })
        return _loadPromise
    }

    _loadPromise = new Promise((resolve, reject) => {
        window.__gmapsInitCb = () => {
            window.__gmapsReady = true
            resolve()
        }

        const script = document.createElement('script')
        // Single script tag, single ID, libraries needed by both pages
        script.id = 'gmap-script'
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=__gmapsInitCb`
        script.async = true
        script.defer = true
        script.onerror = () => reject(new Error('Google Maps failed to load'))
        document.head.appendChild(script)
    })

    return _loadPromise
}
