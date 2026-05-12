// workers/tests/calendar.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOf } = require('./_helpers.js');

async function call(qs) {
  const { handleCalendar } = await import('../calendar.js');
  return handleCalendar(requestOf(qs, '/v1/calendar'));
}

test('calendar: 400 when zone missing', async () => {
  const r = await call('month=4');
  assert.equal(r.status, 400);
});

test('calendar: 400 when month missing or non-numeric', async () => {
  for (const qs of ['zone=7b', 'zone=7b&month=abc']) {
    const r = await call(qs);
    assert.equal(r.status, 400, `expected 400 for ${qs}`);
  }
});

test('calendar: 400 when month out of range', async () => {
  for (const m of [0, 13, -1]) {
    const r = await call('zone=7b&month=' + m);
    assert.equal(r.status, 400, `expected 400 for month=${m}`);
  }
});

test('calendar: 404 when zone unknown', async () => {
  const r = await call('zone=zz&month=4');
  assert.equal(r.status, 404);
});

test('calendar: 200 for zone=7b month=4 returns startIndoors/directSow/transplant arrays', async () => {
  const r = await call('zone=7b&month=4');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.zone, '7b');
  assert.equal(body.month, 4);
  assert.equal(body.monthName, 'April');
  assert.ok(Array.isArray(body.startIndoors));
  assert.ok(Array.isArray(body.directSow));
  assert.ok(Array.isArray(body.transplant));
  // No harvest / notes per decision 3a-i.
  assert.equal(body.harvest, undefined);
  assert.equal(body.notes, undefined);
});
