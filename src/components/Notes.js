// Isa's notes come from a plain form field: line breaks, "* " bullets, bullets run
// together on one line ("*Oat milk tasted fire *The matcha was..."), and *emphasis*

function parseBlocks(text) {
  const blocks = [];
  const addItems = (items) => {
    const last = blocks[blocks.length - 1];
    if (last?.type === 'list') last.items.push(...items);
    else blocks.push({ type: 'list', items });
  };

  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const bullet = line.match(/^[*\-•]\s+(.*)/);
      if (bullet) addItems([bullet[1]]);
      else if (/^\*[^\s*].*\s\*[^\s*]/.test(line)) addItems(line.slice(1).split(/\s\*(?=[^\s*])/));
      else blocks.push({ type: 'paragraph', text: line });
    });
  return blocks;
}

function Inline({ text }) {
  return text.split(/(\*[^\s*](?:[^*]*[^\s*])?\*)/).map((part, index) =>
    index % 2 ? <em key={index}>{part.slice(1, -1)}</em> : part
  );
}

export default function Notes({ text }) {
  return (
    <div className="notes">
      {parseBlocks(text).map((block, index) =>
        block.type === 'list' ? (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline text={item.trim()} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        )
      )}
    </div>
  );
}
