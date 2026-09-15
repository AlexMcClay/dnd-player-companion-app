import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      /*
        Without this, nothing works offline — however much the service worker
        has cached.

        On the default ('online'), react-query checks `navigator.onLine` before
        running a query at all and parks it as `paused` when the answer is no:
        `canFetch` in query-core's retryer.js is
        `(networkMode ?? 'online') === 'online' ? onlineManager.isOnline() : true`.
        A parked query never calls fetch, so the service worker is never asked,
        and a launch with no signal sits on a spinner forever.

        'offlineFirst' lets the request go out regardless. Offline it reaches
        the service worker and is answered from cache; with nothing cached it
        fails honestly and the page shows its error state.
      */
      networkMode: 'offlineFirst',
      // Offline, the three default retries are three guaranteed failures
      // between the user and that error state.
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
