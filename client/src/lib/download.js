/**
 * Starts a download from a URL the API just handed back.
 *
 * Documents are served as short-lived signed links that the API asks the
 * storage layer to send as an attachment. The links used to be opened with
 * window.open(url, '_blank', 'noopener') AFTER waiting for the API. That is
 * unreliable: with `noopener` window.open always returns null, so a blocked
 * window is indistinguishable from an open one, and Safari, mobile browsers and
 * strict popup blockers silently block a tab opened after a network wait. The
 * user clicked Download and nothing happened, with no error.
 *
 * Clicking a link is a plain navigation to an attachment, which every browser
 * treats as a download and does not block, and it leaves the page in place.
 */
export function downloadFromUrl(url, filename) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    throw new Error('The server did not return a download link.');
  }
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** The reason to show a person when a document request fails. */
export function downloadErrorMessage(err, fallback) {
  const data = err?.response?.data;
  const ref = data?.requestId ? ` (ref ${data.requestId})` : '';
  return `${data?.error || data?.message || fallback}${ref}`;
}
