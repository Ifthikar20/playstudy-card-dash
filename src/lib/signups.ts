/*
  New accounts are closed for now. While this is false the sign-in page offers
  no way to create an account, and the landing page's buttons say "Sign in"
  instead of "Get started". The API refuses new accounts on its own
  (SIGNUPS_ENABLED in the backend .env), so this flag only decides what the UI
  offers.

  To reopen: build with VITE_SIGNUPS_OPEN=true, and set SIGNUPS_ENABLED=true on
  the server.
*/
export const SIGNUPS_OPEN = import.meta.env.VITE_SIGNUPS_OPEN === "true";
