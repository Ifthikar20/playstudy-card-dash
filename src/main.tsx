import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initAnalytics } from './lib/analytics'
import { installMaintenanceWatch } from './lib/maintenance'

// A tab left open when the maintenance gate goes on reloads onto the maintenance page.
installMaintenanceWatch()

// Before the first render, so the landing page's view, its link tags and any error
// during start-up are all caught.
initAnalytics()

createRoot(document.getElementById("root")!).render(<App />);
