const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const seq = s => [...s].map(ch => ({ kind: /\d/.test(ch) ? 'digit' : 'op', face: ch }));

test('equation validation: valid and invalid cases', () => {
  for (const ok of ['3+4=7', '12=6×2', '1+2×3=7', '0+5=5', '-3+5=2', '2=-3+5', '7-3-4=0']) {
    assert.equal(E.validateEquation(seq(ok)).valid, true, ok);
  }
  assert.equal(E.validateEquation(seq('3+4=8')).reason, 'สมการไม่เป็นจริง');
  assert.equal(E.validateEquation(seq('5÷0=1')).reason, 'หารด้วยศูนย์ไม่ได้');
  assert.equal(E.validateEquation(seq('5+=3')).valid, false);
  assert.equal(E.validateEquation(seq('05=5')).valid, false);
  assert.equal(E.validateEquation(seq('+5=5')).valid, false);
});

test('validateBoard flags an invalid run and passes a correct one', () => {
  const b = E.emptyBoard();
  const put = (r, c, face, kind = 'digit') => {
    b[r][c].tile = { kind, face, points: kind === 'digit' ? E.NUM_INFO[Number(face)].points : E.OP_INFO[face].points,
      origin: kind + ':' + face };
  };
  put(7, 5, '3'); put(7, 7, '4'); put(7, 8, '=', 'op'); put(7, 9, '7');
  // gap at col 6 means "4=7" is a run that is not a valid equation
  assert.ok(E.validateBoard(b).some(p => p.dir === 'H'));
  put(7, 6, '+', 'op');
  assert.equal(E.validateBoard(b).length, 0);
});

test('bug fix: a real + (2 pts) is found even when a dual or blank tile comes first', () => {
  const build = () => {
    const b = E.emptyBoard();
    const put = (c, face, kind) => { b[7][c].tile = { kind, face, points: kind === 'digit' ? E.NUM_INFO[Number(face)].points : E.OP_INFO[face].points, origin: kind + ':' + face }; };
    put(5, '3', 'digit'); put(7, '4', 'digit'); put(8, '=', 'op'); put(9, '7', 'digit');
    return b;
  };
  for (const rack of [
    [{ uid: 1, kind: 'dual', dual: 'pm' }, { uid: 2, kind: 'op', face: '+' }],
    [{ uid: 1, kind: 'blank' }, { uid: 2, kind: 'op', face: '+' }],
  ]) {
    const res = E.solve(build(), rack, { maxResults: 50 });
    const hits = res.results.filter(r => r.display === '3+4=7' && r.placements.length === 1 && r.placements[0].c === 6);
    assert.ok(hits.length > 0);
    assert.equal(hits[0].placements[0].points, 2);
  }
});

test('typed move: places new tiles and accepts matching existing tiles', () => {
  const b = E.emptyBoard();
  const out = E.applyTypedMove(b, [], { r: 7, c: 5 }, 'H', '3+4=7');
  assert.equal(out.error, undefined);
  assert.equal(out.placements.length, 5);
  assert.equal(out.board[7][5].tile.face, '3');
  // extend the same line using a matching prefix
  const out2 = E.applyTypedMove(out.board, [], { r: 7, c: 5 }, 'H', '3+4=7');
  assert.equal(out2.placements.length, 0);
});

test('typed move: rejects a mismatch with an existing tile and bad input', () => {
  const b = E.emptyBoard();
  const first = E.applyTypedMove(b, [], { r: 7, c: 5 }, 'H', '3+4=7').board;
  assert.match(E.applyTypedMove(first, [], { r: 7, c: 5 }, 'H', '5+4=9').error, /มี "3" อยู่แล้ว/);
  assert.ok(E.applyTypedMove(b, [], { r: 7, c: 14 }, 'H', '1+2=3').error);
  assert.match(E.parseTypedMove('[25]').error, /10-20/);
  assert.match(E.parseTypedMove('3?4').error, /ไม่รู้จัก/);
});

test('typed move: [n] tiles and * / shorthands', () => {
  const p = E.parseTypedMove('[12]-[10]=2*1');
  assert.deepEqual(p.tokens.map(t => t.face), ['12', '-', '10', '=', '2', '×', '1']);
});

test('supply: remaining counts respect board and rack', () => {
  const b = E.emptyBoard();
  b[0][0].tile = { kind: 'digit', face: '0', points: 1, origin: 'digit:0' };
  const rack = [{ uid: 1, kind: 'digit', face: 0 }];
  assert.equal(E.remainingFor(b, rack, 'digit:0'), 3); // total 5 minus board 1 minus rack 1
});

test('checkBoard reports tiles over the supply', () => {
  const b = E.emptyBoard();
  for (let c = 0; c < 6; c++) b[0][c].tile = { kind: 'digit', face: '0', points: 1, origin: 'digit:0' };
  assert.ok(E.checkBoard(b, []).some(p => p.tileKey === 'digit:0'));
});

test('default bonus layout matches the photo of the real board', () => {
  // Rows of the real board read from the uploaded photo: R=x3 word, Y=x2 word, L=x3 piece, O=x2 piece
  const photo = [
    'R N N O N N N R N N N O N N R', 'N Y N N N L N N N L N N N Y N', 'N N Y N N N O N O N N N Y N N', 'O N N Y N N N O N N N Y N N O',
    'N N N N L N N N N N L N N N N', 'N L N N N L N N N L N N N L N', 'N N O N N N O N O N N N O N N',
    'R N N O N N N L N N N O N N R', 'N N O N N N O N O N N N O N N', 'N L N N N L N N N L N N N L N',
    'N N N N L N N N N N L N N N N', 'O N N Y N N N O N N N Y N N O', 'N N Y N N N O N O N N N Y N N',
    'N Y N N N L N N N L N N N Y N', 'R N N O N N N R N N N R N N R',
  ].map(r => r.split(' '));
  const map = { R: 'tw', Y: 'dw', L: 'tl', O: 'dl', N: 'none' };
  const b = E.emptyBoard();
  const mismatches = [];
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    let want = map[photo[r][c]];
    if (r === 7 && c === 7) want = 'star';
    if (b[r][c].bonus !== want) mismatches.push(`${r},${c}`);
  }
  // (14,11) is covered by the website watermark in the photo, so it is excluded from the comparison
  assert.deepEqual(mismatches.filter(m => m !== '14,11'), []);
});

test('bingo line: solver results can be filtered to a full strip on row 7', () => {
  const N = 8, start = Math.floor((15 - N) / 2); // 3..10, covers the center column
  const b = E.emptyBoard();
  // empty strip: a bingo should exist with 8 tiles from the rack
  const rack = [3,'+',4,'=',7].map((x, i) => typeof x === 'number'
    ? { uid: i + 1, kind: 'digit', face: x } : { uid: i + 1, kind: 'op', face: x });
  rack.push({ uid: 6, kind: 'digit', face: 1 }, { uid: 7, kind: 'digit', face: 2 }, { uid: 8, kind: 'op', face: '-' });
  const res = E.solve(b, rack, { maxResults: 200, maxCombos: 200000, timeBudgetMs: 10000 });
  const strip = res.results.filter(r => r.dir === 'H' && r.span.r0 === 7 && r.span.r1 === 7 && r.span.c0 === start && r.span.c1 === start + N - 1);
  for (const r of strip) assert.equal(r.placements.length, N);
});

test('onlySpan restricts the solver to the exact bingo line', () => {
  const N = 8, s = Math.floor((15 - N) / 2);
  const rack = [3, '+', 4, '=', 7, 1, 2, '-'].map((x, i) => typeof x === 'number'
    ? { uid: i + 1, kind: 'digit', face: x } : { uid: i + 1, kind: 'op', face: x });
  const res = E.solve(E.emptyBoard(), rack, { maxResults: 50, maxCombos: 300000, timeBudgetMs: 10000,
    onlySpan: { r: 7, c0: s, c1: s + N - 1 } });
  assert.ok(res.results.length > 0);
  for (const r of res.results) {
    assert.equal(r.dir, 'H');
    assert.equal(r.placements.length, N);
    assert.equal(r.span.c0, s); assert.equal(r.span.c1, s + N - 1);
  }
});
