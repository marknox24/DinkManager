// navigator.clipboard.writeText rejects (or is undefined) in a range of real
// contexts: in-app browsers (Facebook/Messenger/Instagram webviews block the
// Clipboard API entirely), a page that lost focus right as the click fired,
// or an older browser. Falls back to the classic hidden-textarea +
// execCommand('copy') approach, which none of those block.
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path below
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
