const URL_SPLIT_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING_PUNCT_REGEX = /[.,!?;:)\]]+$/;

function toSafeHttpHref(rawUrl) {
  const candidate = rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Splits message text into plain-text and clickable-link tokens.
 */
export function tokenizeTextWithLinks(text) {
  if (!text) return [];
  const tokens = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_SPLIT_REGEX)) {
    const start = match.index ?? 0;
    const rawMatch = match[0];

    if (start > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    const trailingMatch = rawMatch.match(TRAILING_PUNCT_REGEX);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const cleanUrl = trailing
      ? rawMatch.slice(0, rawMatch.length - trailing.length)
      : rawMatch;
    const href = cleanUrl ? toSafeHttpHref(cleanUrl) : null;

    if (href) {
      tokens.push({ type: "link", value: cleanUrl, href });
      if (trailing) {
        tokens.push({ type: "text", value: trailing });
      }
    } else {
      tokens.push({ type: "text", value: rawMatch });
    }

    lastIndex = start + rawMatch.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Extracts normalized HTTP/HTTPS URLs from message text.
 */
export function extractLinksFromText(text) {
  return tokenizeTextWithLinks(text)
    .filter((token) => token.type === "link")
    .map((token) => ({ label: token.value, href: token.href }));
}
