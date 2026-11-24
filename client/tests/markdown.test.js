import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseMarkdown, renderMarkdown, safeHref } from '../src/utils/markdown.js';

const html = (source) => renderToStaticMarkup(createElement('div', null, renderMarkdown(source)));

describe('safe formatting (Markdown subset)', () => {
  test('bold, italic, links, lists, paragraphs and line breaks', () => {
    assert.equal(html('**Bring** a *laptop* and _charger_'), '<div><p><strong>Bring</strong> a <em>laptop</em> and <em>charger</em></p></div>');
    assert.equal(
      html('[Rules](https://example.com/rules)'),
      '<div><p><a href="https://example.com/rules" target="_blank" rel="noopener noreferrer nofollow">Rules</a></p></div>',
    );
    assert.equal(html('- one\n- two\n\n1. first\n2. second'), '<div><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol></div>');
    assert.equal(html('line one\nline two\n\nnew paragraph'), '<div><p>line one<br/>line two</p><p>new paragraph</p></div>');
    assert.equal(html('**bold with _italic_ inside**'), '<div><p><strong>bold with <em>italic</em> inside</strong></p></div>');
  });

  test('HTML and scripts are shown as text, never run', () => {
    const output = html('<script>alert(1)</script> <img src=x onerror=alert(2)> <b>x</b>');
    assert.ok(!output.includes('<script') && !output.includes('<img') && !output.includes('<b>'), output);
    assert.ok(output.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(output.includes('&lt;img src=x onerror=alert(2)&gt;'));
  });

  test('only http, https and mailto links become links', () => {
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', '/relative', 'ftp://x.y']) {
      const output = html(`[click](${url})`);
      assert.ok(!output.includes('<a'), `${url} -> ${output}`);
    }
    assert.equal(safeHref('mailto:club@eventhub.test'), 'mailto:club@eventhub.test');
  });

  test('an attribute cannot be smuggled through a link', () => {
    const output = html('[x](https://example.com/"onmouseover="alert(1))');
    assert.ok(!/onmouseover="/.test(output), output);
  });

  test('stray markers and odd input stay as text without errors', () => {
    assert.equal(html('2 * 3 * 4 and snake_case_name'), '<div><p>2 * 3 * 4 and snake_case_name</p></div>');
    assert.equal(html('**unclosed bold'), '<div><p>**unclosed bold</p></div>');
    assert.deepEqual(parseMarkdown(''), []);
    assert.deepEqual(parseMarkdown(null), []);
    assert.ok(html('*'.repeat(5000)).length > 0, 'long runs of markers finish quickly');
  });
});
