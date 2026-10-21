/**
 * True when the app runs inside another site's page (an <iframe> in the employee portal),
 * or was opened with `?embed=1`. The flag is kept for the browser tab.
 */
function detectEmbedded(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has('embed')) sessionStorage.setItem('agula-quiz:embed', '1');
    if (sessionStorage.getItem('agula-quiz:embed') === '1') return true;
  } catch {
    // Storage blocked: fall through to the frame check.
  }
  try {
    return window.self !== window.top;
  } catch {
    // Reading window.top throws across origins, which also means we are framed.
    return true;
  }
}

export const isEmbedded = detectEmbedded();
