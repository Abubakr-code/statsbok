const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hintIntent,
  normalizeDiscovery,
  sameBook
} = require('../src/services/strictAiSearchService');

test('long quote-like text is classified as quote', () => {
  assert.equal(hintIntent("hay qiraman tog'lar bag'ridan"), 'quote');
  assert.equal(hintIntent('"Dunyo bir-ikki odam yovuzlik qilgani uchun emas"'), 'quote');
});

test('topic requests are not forced into quote mode', () => {
  assert.equal(hintIntent('tarix haqida kitob tavsiya qil'), 'unknown');
  assert.equal(hintIntent('sevgi mavzusida kitoblar'), 'unknown');
});

test('quote discovery keeps only one candidate', () => {
  const result = normalizeDiscovery(
    {
      intent: 'quote',
      books: [
        { title: 'A', author: 'Author A', confidence: 0.95 },
        { title: 'B', author: 'Author B', confidence: 0.95 }
      ]
    },
    'uz',
    'quote'
  );
  assert.equal(result.intent, 'quote');
  assert.equal(result.books.length, 1);
  assert.equal(result.books[0].year, null);
});

test('invalid and unknown candidates are removed', () => {
  const result = normalizeDiscovery(
    {
      intent: 'topic',
      books: [
        { title: '', author: 'Somebody', confidence: 0.9 },
        { title: 'Real title', author: 'Unknown', confidence: 0.9 },
        { title: 'Known title', author: 'Known author', confidence: 0.9 }
      ]
    },
    'en',
    'unknown'
  );
  assert.deepEqual(result.books.map((book) => book.title), ['Known title']);
});

test('verification requires exact normalized title and author agreement', () => {
  assert.equal(
    sameBook(
      { title: "O'tkan kunlar", author: 'Abdulla Qodiriy' },
      { title: 'O‘TKAN KUNLAR', author: 'Abdulla Qodiriy' }
    ),
    true
  );
  assert.equal(
    sameBook(
      { title: "O'tkan kunlar", author: 'Abdulla Qodiriy' },
      { title: 'Mehrobdan chayon', author: 'Abdulla Qodiriy' }
    ),
    false
  );
});
