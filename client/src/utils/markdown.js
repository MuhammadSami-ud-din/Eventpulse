import { createElement, Fragment } from 'react';

// A deliberately tiny Markdown subset for event descriptions:
//   **bold**  *italic* or _italic_  [link text](https://…)
//   lines starting "- " or "* " (bullets) or "1. " (numbered)
//   a blank line starts a new paragraph; a single line break is kept.
//
// Why this is safe: the text is never handed to the browser as HTML. It is
// parsed into a small tree and turned into React elements, and React escapes
// every piece of text, so "<script>" shows up as those characters. Links are
// only made for http, https and mailto addresses; anything else ("javascript:",
// "data:") stays plain text.

const LIST_ITEM = /^\s*(?:([-*])|(\d+)[.)])\s+(.*)$/;
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

// One pattern per inline style; whichever matches earliest in the text wins.
// As in Markdown, a marker only counts when it touches the words it wraps
// ("*word*", not "2 * 3 * 4"), and "_" inside a word (snake_case) is literal.
const INLINE_PATTERN =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*|(?<![\p{L}\p{N}*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\p{L}\p{N}*])|(?<![\p{L}\p{N}_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\p{L}\p{N}_])/gu;

export function safeHref(url) {
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function parseInline(text) {
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > last) nodes.push({ type: 'text', value: text.slice(last, match.index) });
    const [whole, linkText, url, bold, starItalic, underscoreItalic] = match;
    if (linkText !== undefined) {
      const href = safeHref(url);
      nodes.push(href ? { type: 'link', href, children: parseInline(linkText) } : { type: 'text', value: whole });
    } else if (bold !== undefined) {
      nodes.push({ type: 'strong', children: parseInline(bold) });
    } else {
      nodes.push({ type: 'em', children: parseInline(starItalic ?? underscoreItalic) });
    }
    last = match.index + whole.length;
  }
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
  return nodes;
}

// Splits the text into paragraphs and lists (the "blocks").
export function parseMarkdown(source) {
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of String(source ?? '').split(/\r?\n/)) {
    const item = line.match(LIST_ITEM);
    if (item) {
      flushParagraph();
      const ordered = item[2] !== undefined;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: 'list', ordered, items: [] };
      }
      list.items.push(parseInline(item[3]));
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

function renderInline(nodes) {
  return nodes.map((node, index) => {
    if (node.type === 'text') {
      // A single line break inside a paragraph becomes <br>.
      const lines = node.value.split('\n');
      return createElement(
        Fragment,
        { key: index },
        ...lines.flatMap((line, i) => (i === 0 ? [line] : [createElement('br', { key: `br${i}` }), line])),
      );
    }
    if (node.type === 'link') {
      return createElement(
        'a',
        { key: index, href: node.href, target: '_blank', rel: 'noopener noreferrer nofollow' },
        renderInline(node.children),
      );
    }
    return createElement(node.type, { key: index }, renderInline(node.children));
  });
}

// React elements for the whole text, ready to place inside a container.
export function renderMarkdown(source) {
  return parseMarkdown(source).map((block, index) => {
    if (block.type === 'paragraph') return createElement('p', { key: index }, renderInline(block.children));
    return createElement(
      block.ordered ? 'ol' : 'ul',
      { key: index },
      block.items.map((item, itemIndex) => createElement('li', { key: itemIndex }, renderInline(item))),
    );
  });
}
