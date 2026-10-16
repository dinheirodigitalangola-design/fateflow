export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Google OAuth login. The server owns the whole flow: it mints the
// state + PKCE verifier, sets the short-lived flow cookie and redirects to
// Google — so the client just navigates. Call from an event handler, never
// during render.
export const startLogin = () => {
  window.location.href = "/api/oauth/google";
};
