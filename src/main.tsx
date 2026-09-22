import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initAnalytics } from './lib/analytics'

// Before the first render, so the landing page's view, its link tags and any error
// during start-up are all caught.
initAnalytics()

createRoot(document.getElementById("root")!).render(<App />);
