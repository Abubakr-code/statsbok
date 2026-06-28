/**
 * Tiny, dependency-free renderer for the AI assistant's replies.
 * Supports **bold**, *italic*, `code`, bullet lists and line breaks, and
 * enlarges emoji so they read like friendly iOS-style stickers.
 */
const EMOJI_RE = /(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\uFE0F?)/gu;

function emojify(str, key) {
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  EMOJI_RE.lastIndex = 0;
  while ((m = EMOJI_RE.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push(
      <span key={`${key}-e${i}`} className="ai-emoji">
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

function parseInline(str, key) {
  const nodes = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(str))) {
    if (m.index > last) nodes.push(...emojify(str.slice(last, m.index), `${key}-t${i}`));
    if (m[2] !== undefined) {
      nodes.push(<strong key={`${key}-b${i}`}>{emojify(m[2], `${key}-b${i}`)}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<em key={`${key}-i${i}`}>{emojify(m[3], `${key}-i${i}`)}</em>);
    } else if (m[4] !== undefined) {
      nodes.push(
        <code key={`${key}-c${i}`} className="rounded bg-black/15 px-1 text-[0.85em]">
          {m[4]}
        </code>
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < str.length) nodes.push(...emojify(str.slice(last), `${key}-tend`));
  return nodes;
}

export default function RichText({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let list = null;

  lines.forEach((line) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    if (bullet) {
      if (!list) list = [];
      list.push(bullet[1]);
    } else {
      if (list) {
        blocks.push({ type: 'ul', items: list });
        list = null;
      }
      blocks.push({ type: 'p', text: line });
    }
  });
  if (list) blocks.push({ type: 'ul', items: list });

  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="list-disc space-y-0.5 pl-4">
            {b.items.map((it, j) => (
              <li key={j}>{parseInline(it, `l${i}-${j}`)}</li>
            ))}
          </ul>
        ) : b.text.trim() === '' ? (
          <div key={i} className="h-1.5" />
        ) : (
          <p key={i}>{parseInline(b.text, `p${i}`)}</p>
        )
      )}
    </div>
  );
}
