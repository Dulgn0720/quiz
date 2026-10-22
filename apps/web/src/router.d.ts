import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** Hide the app header (player screens on phones). */
    fullscreen?: boolean;
    /** Redirect guests to the sign-in page. */
    requiresAuth?: boolean;
  }
}
