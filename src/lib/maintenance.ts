// Maintenance gate, browser side.
//
// While the gate is on (deploy/aws/nginx.conf, maintenance.sh), nginx sends every
// page load to public/maintenance.html, but a tab that loaded the app before the
// gate went on keeps running, and its API calls start failing with this 503. Such a
// tab would show "down for maintenance" as an error inside the app. Reload it
// instead: the reload lands on the full maintenance page, or on the app again for
// a browser holding the preview cookie.

const MAINTENANCE_DETAIL = 'AnotherNote is down for maintenance';
const RELOAD_GUARD_KEY = 'an_maintenance_reload_at';

function reloadOnce() {
  // Never loop: at most one reload every 30 seconds per tab.
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: reload anyway, since the next page is nginx's, not ours.
  }
  window.location.reload();
}

declare global {
  interface Window {
    lock?: () => void;
  }
}

export function installMaintenanceWatch() {
  // lock() from the console forgets the preview key, so this browser sees the
  // maintenance page again. (maintenance.html has the same function, but nginx never
  // shows that page to a browser that holds a valid key.)
  window.lock = () => {
    const secure = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `an_preview=; path=/; max-age=0; samesite=lax${secure}`;
    window.location.replace('/');
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    if (response.status === 503) {
      response
        .clone()
        .json()
        .then((body) => {
          if (body?.detail === MAINTENANCE_DETAIL) reloadOnce();
        })
        .catch(() => {});
    }
    return response;
  };
}
