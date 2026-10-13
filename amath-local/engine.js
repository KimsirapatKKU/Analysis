/* A-Math engine: rules, equation validation, board validation, solver, typed-move parser.
 * Pure logic, no DOM. Works in Node (module.exports) and in the browser (window.AMath). */
(function (root) {
const NUM_INFO = {
  0:{points:1,count:5}, 1:{points:1,count:6}, 2:{points:1,count:6}, 3:{points:1,count:5},
  4:{points:2,count:5}, 5:{points:2,count:4}, 6:{points:2,count:4}, 7:{points:2,count:4},
  8:{points:2,count:4}, 9:{points:2,count:4}, 10:{points:3,count:2}, 11:{points:4,count:1},
  12:{points:3,count:2}, 13:{points:6,count:1}, 14:{points:4,count:1}, 15:{points:4,count:1},
  16:{points:4,count:1}, 17:{points:6,count:1}, 18:{points:4,count:1}, 19:{points:7,count:1},
  20:{points:5,count:1}
};
const OP_INFO = {
  '+':{points:2,count:4}, '-':{points:2,count:4}, '×':{points:2,count:4}, '÷':{points:2,count:4},
  '=':{points:1,count:11}
};
const DUAL_INFO = {
  'pm': {points:1, count:5, options:['+','-'], label:'±'},
  'md': {points:1, count:4, options:['×','÷'], label:'×÷'}
};
const BLANK_INFO = {points:0, count:4};

function gcdBig(a,b){ a=a<0n?-a:a; b=b<0n?-b:b; while(b){ [a,b]=[b,a%b]; } return a===0n?1n:a; }
function frac(num, den=1n){
  num = BigInt(num); den = BigInt(den);
  if(den===0n) throw new Error('DIV_ZERO');
  if(den<0n){ num=-num; den=-den; }
  const g = gcdBig(num,den);
  return { n: num/g, d: den/g };
}
function fMul(a,b){ return frac(a.n*b.n, a.d*b.d); }
function fDiv(a,b){ if(b.n===0n) throw new Error('DIV_ZERO'); return frac(a.n*b.d, a.d*b.n); }
function fAdd(a,b){ return frac(a.n*b.d + b.n*a.d, a.d*b.d); }
function fSub(a,b){ return frac(a.n*b.d - b.n*a.d, a.d*b.d); }
function fEq(a,b){ return a.n*b.d === b.n*a.d; }

function validateEquation(cellSeq){
  if(cellSeq.length < 3) return {valid:false, reason:'สั้นเกินไป'};
  const raw = [];
  let acc = '';
  let accCells = [];
  for(const c of cellSeq){
    if(c.kind === 'digit'){ acc += c.face; accCells.push(c.face); }
    else{
      if(acc !== ''){ raw.push({type:'num', str:acc, cells:accCells}); acc=''; accCells=[]; }
      raw.push({type:'op', sym:c.face});
    }
  }
  if(acc !== ''){ raw.push({type:'num', str:acc, cells:accCells}); }
  for(const t of raw){
    if(t.type==='num' && t.str.length>1 && t.str[0]==='0') return {valid:false, reason:'เลขนำหน้าด้วย 0 ไม่ได้'};
    if(t.type==='num' && t.cells.length>1){
      const hasMultiDigitTile = t.cells.some(f=>f.length>1);
      if(hasMultiDigitTile) return {valid:false, reason:'เบี้ยเลข 2 หลัก (10-20) วางต่อกับเบี้ยตัวอื่นเป็นเลขเดียวกันไม่ได้'};
      if(t.cells.length>3) return {valid:false, reason:'เลขที่เกิดจากเบี้ยตัวเลขโดดต่อกันได้ไม่เกิน 3 หลัก (สูงสุด 999)'};
    }
  }
  const tokens = [];
  for(let i=0;i<raw.length;i++){
    const t = raw[i];
    if(t.type==='op' && t.sym==='-'){
      const isStart = (i===0);
      const afterEq = (i>0 && raw[i-1].type==='op' && raw[i-1].sym==='=');
      if(isStart || afterEq){
        const nxt = raw[i+1];
        if(!nxt || nxt.type!=='num') return {valid:false, reason:'เครื่องหมายลบวางผิดตำแหน่ง'};
        if(nxt.str === '0') return {valid:false, reason:'ห้ามติดลบศูนย์'};
        tokens.push({type:'num', value: -BigInt(nxt.str)});
        i++; continue;
      }
    }
    if(t.type==='op' && t.sym==='+'){
      const isStart = (i===0);
      const afterEq = (i>0 && raw[i-1].type==='op' && raw[i-1].sym==='=');
      if(isStart || afterEq) return {valid:false, reason:'ห้ามใช้ + นำหน้าตัวเลข'};
    }
    if(t.type==='num'){ tokens.push({type:'num', value: BigInt(t.str)}); }
    else{ tokens.push({type:'op', sym: t.sym}); }
  }
  if(tokens.length===0 || tokens[0].type!=='num' || tokens[tokens.length-1].type!=='num')
    return {valid:false, reason:'รูปแบบสมการไม่ถูกต้อง'};
  for(let i=0;i<tokens.length;i++){
    const expectNum = (i%2===0);
    if(expectNum && tokens[i].type!=='num') return {valid:false, reason:'รูปแบบสมการไม่ถูกต้อง'};
    if(!expectNum && tokens[i].type!=='op') return {valid:false, reason:'รูปแบบสมการไม่ถูกต้อง'};
  }
  const eqPositions = tokens.map((t,i)=> (t.type==='op'&&t.sym==='=') ? i : -1).filter(i=>i>=0);
  if(eqPositions.length !== 1) return {valid:false, reason:'ต้องมีเครื่องหมาย = พอดี 1 ตัว'};
  const eqPos = eqPositions[0];
  if(eqPos===0 || eqPos===tokens.length-1) return {valid:false, reason:'สมการไม่สมบูรณ์'};
  const left = tokens.slice(0, eqPos);
  const right = tokens.slice(eqPos+1);
  function evalSideClean(side){
    const groups = [];
    let curFactors = [side[0].value];
    let curOps = [];
    let curSign = 1;
    for(let i=1;i<side.length;i+=2){
      const opTok = side[i]; const numTok = side[i+1];
      if(opTok.sym==='×' || opTok.sym==='÷'){ curFactors.push(numTok.value); curOps.push(opTok.sym); }
      else if(opTok.sym==='+' || opTok.sym==='-'){
        groups.push({sign:curSign, factors:curFactors, ops:curOps});
        curSign = (opTok.sym==='+') ? 1 : -1;
        curFactors = [numTok.value]; curOps = [];
      } else { throw new Error('BAD_OP'); }
    }
    groups.push({sign:curSign, factors:curFactors, ops:curOps});
    let total = frac(0n);
    for(const g of groups){
      let v = frac(g.factors[0]);
      for(let k=0;k<g.ops.length;k++){
        const nv = frac(g.factors[k+1]);
        if(g.ops[k]==='×') v = fMul(v, nv); else v = fDiv(v, nv);
      }
      total = (g.sign===1) ? fAdd(total, v) : fSub(total, v);
    }
    return total;
  }
  let leftVal, rightVal;
  try{ leftVal = evalSideClean(left); rightVal = evalSideClean(right); }
  catch(e){
    if(e.message==='DIV_ZERO') return {valid:false, reason:'หารด้วยศูนย์ไม่ได้'};
    return {valid:false, reason:'สมการไม่ถูกต้อง'};
  }
  if(!fEq(leftVal, rightVal)) return {valid:false, reason:'สมการไม่เป็นจริง'};
  const display = cellSeq.map(c=>c.face).join('');
  return {valid:true, display};
}

/* ======================= SOLVER ======================= */
const SIZE = 15, CENTER = 7;
function buildDefaultBonusLayout(){
  const layout = Array.from({length:SIZE},()=>Array(SIZE).fill('none'));
  const TW=[[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]];
  const DW=[[1,1],[2,2],[3,3],[11,11],[12,12],[13,13],[1,13],[2,12],[3,11],[11,3],[12,2],[13,1]];
  const TL=[[1,5],[1,9],[4,4],[4,10],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[10,4],[10,10],[13,5],[13,9]];
  const DL=[[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]];
  for(const [r,c] of TW) layout[r][c]='tw';
  for(const [r,c] of DW) layout[r][c]='dw';
  for(const [r,c] of TL) layout[r][c]='tl';
  for(const [r,c] of DL) layout[r][c]='dl';
  layout[CENTER][CENTER]='star';
  return layout;
}
function emptyBoard(){
  const bonus = buildDefaultBonusLayout();
  return Array.from({length:SIZE},(_,r)=>Array.from({length:SIZE},(_,c)=>({tile:null, bonus:bonus[r][c]})));
}
function isBoardEmpty(board){
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(board[r][c].tile) return false;
  return true;
}
function expandTileOptions(tile){
  if(tile.kind==='digit') return [{kind:'digit', face:String(tile.face), points:NUM_INFO[tile.face].points, origin:'digit:'+tile.face}];
  if(tile.kind==='op') return [{kind:'op', face:tile.face, points:OP_INFO[tile.face].points, origin:'op:'+tile.face}];
  if(tile.kind==='dual'){
    const info = DUAL_INFO[tile.dual];
    return info.options.map(sym=>({kind:'op', face:sym, points:info.points, origin:'dual:'+tile.dual}));
  }
  if(tile.kind==='blank'){
    const opts=[];
    for(let n=0;n<=20;n++) opts.push({kind:'digit', face:String(n), points:0, origin:'blank'});
    for(const s of ['+','-','×','÷','=']) opts.push({kind:'op', face:s, points:0, origin:'blank'});
    return opts;
  }
  return [];
}
function getLine(board, dir, idx){
  const out=[];
  for(let i=0;i<SIZE;i++) out.push(dir==='H'?{r:idx,c:i}:{r:i,c:idx});
  return out;
}
function findSpans(board, dir, idx, boardEmpty){
  const line = getLine(board, dir, idx);
  const spans=[];
  for(let s=0;s<SIZE;s++){
    if(s>0 && board[line[s-1].r][line[s-1].c].tile) continue;
    for(let e=s+2;e<SIZE;e++){
      if(e<SIZE-1 && board[line[e+1].r][line[e+1].c].tile) continue;
      let hasEmpty=false, hasFilled=false;
      for(let k=s;k<=e;k++){ if(board[line[k].r][line[k].c].tile) hasFilled=true; else hasEmpty=true; }
      if(!hasEmpty) continue;
      let connectedOk;
      if(boardEmpty){ connectedOk = (idx===CENTER) && (s<=CENTER && CENTER<=e); }
      else{ connectedOk = hasFilled; }
      if(!connectedOk) continue;
      spans.push({coords: line.slice(s,e+1)});
    }
  }
  return spans;
}
function pieceMultiplier(bonus){ if(bonus==='tl'||bonus==='star') return 3; if(bonus==='dl') return 2; return 1; }
function equationMultiplier(cellsInfo){
  let mult=1;
  for(const ci of cellsInfo){ if(!ci.isNew) continue; if(ci.bonus==='tw') mult*=3; if(ci.bonus==='dw') mult*=2; }
  return mult;
}
function scoreSpan(cellsInfo){
  let sum=0;
  for(const ci of cellsInfo) sum += ci.isNew ? ci.points*pieceMultiplier(ci.bonus) : ci.points;
  return sum * equationMultiplier(cellsInfo);
}
function perpendicularRun(board, dir, r, c){
  const pdir = dir==='H'?'V':'H';
  const before=[], after=[];
  if(pdir==='V'){
    let rr=r-1; while(rr>=0 && board[rr][c].tile){ before.unshift({r:rr,c}); rr--; }
    rr=r+1; while(rr<SIZE && board[rr][c].tile){ after.push({r:rr,c}); rr++; }
  } else {
    let cc=c-1; while(cc>=0 && board[r][cc].tile){ before.unshift({r,c:cc}); cc--; }
    cc=c+1; while(cc<SIZE && board[r][cc].tile){ after.push({r,c:cc}); cc++; }
  }
  const full=[...before, {r,c,isNewCenter:true}, ...after];
  if(full.length<2) return null;
  return full;
}
function cellInfoFromCoord(board, coord, isNewCenter, newFace, newKind, newPoints){
  if(isNewCenter) return {kind:newKind, face:newFace, points:newPoints, isNew:true, bonus:board[coord.r][coord.c].bonus};
  const t = board[coord.r][coord.c].tile;
  return {kind:t.kind, face:t.face, points:t.points, isNew:false, bonus:board[coord.r][coord.c].bonus};
}
function solve(board, rack, options={}){
  const maxResults = options.maxResults || 20;
  const comboCap = options.maxCombos || 120000;
  const timeBudgetMs = options.timeBudgetMs || 6000;
  const startTime = Date.now();
  const boardEmpty = isBoardEmpty(board);
  const results=[]; let exploredCombos=0; let timedOut=false;

  const onlySpan = options.onlySpan || null; // {r, c0, c1}: horizontal only, exact span (bingo line)
  const onlyRow = options.onlyRow;           // horizontal only, any span length, on this row
  for(const dir of ['H','V']){
    if((onlySpan || onlyRow!==undefined) && dir!=='H') continue;
    for(let idx=0; idx<SIZE; idx++){
      if(timedOut) break;
      if(onlySpan && idx!==onlySpan.r) continue;
      if(onlyRow!==undefined && idx!==onlyRow) continue;
      const spans = findSpans(board, dir, idx, boardEmpty);
      for(const span of spans){
        if(timedOut) break;
        if(onlySpan){
          const first = span.coords[0], last = span.coords[span.coords.length-1];
          if(first.c!==onlySpan.c0 || last.c!==onlySpan.c1) continue;
        }
        const coords = span.coords;
        const emptyPositions=[];
        coords.forEach((co,pos)=>{ if(!board[co.r][co.c].tile) emptyPositions.push(pos); });
        const k = emptyPositions.length;
        if(k===0 || k>rack.length) continue;
        const usedRackIdx = new Set();
        const assignment = new Array(k);

        function tryFinish(){
          exploredCombos++;
          if(exploredCombos>comboCap){ timedOut=true; return; }
          if((exploredCombos & 1023)===0 && Date.now()-startTime>timeBudgetMs){ timedOut=true; return; }
          const cellsInfo = coords.map((co,pos)=>{
            const emptyIdx = emptyPositions.indexOf(pos);
            if(emptyIdx>=0){
              const a = assignment[emptyIdx];
              return {kind:a.kind, face:a.face, points:a.points, isNew:true, bonus:board[co.r][co.c].bonus, coord:co, rackUid:a.rackUid, origin:a.origin};
            } else {
              const t = board[co.r][co.c].tile;
              return {kind:t.kind, face:t.face, points:t.points, isNew:false, bonus:board[co.r][co.c].bonus, coord:co};
            }
          });
          const mainSeq = cellsInfo.map(ci=>({kind:ci.kind, face:ci.face}));
          const mainValid = validateEquation(mainSeq);
          if(!mainValid.valid) return;
          let crossTotal=0; const crossDisplays=[];
          for(const ci of cellsInfo){
            if(!ci.isNew) continue;
            const run = perpendicularRun(board, dir, ci.coord.r, ci.coord.c);
            if(!run) continue;
            const runCellsInfo = run.map(rc=>cellInfoFromCoord(board, rc, !!rc.isNewCenter, ci.face, ci.kind, ci.points));
            const runSeq = runCellsInfo.map(x=>({kind:x.kind, face:x.face}));
            const rv = validateEquation(runSeq);
            if(!rv.valid){ crossTotal=null; break; }
            crossTotal += scoreSpan(runCellsInfo);
            crossDisplays.push(rv.display);
          }
          if(crossTotal===null) return;
          const mainScore = scoreSpan(cellsInfo);
          let total = mainScore + crossTotal;
          const bingo = (k===8);
          if(bingo) total += 40;
          results.push({
            dir, score: total, mainScore, crossScore:crossTotal, bingo,
            display: mainValid.display, crossDisplays,
            placements: cellsInfo.filter(ci=>ci.isNew).map(ci=>({r:ci.coord.r,c:ci.coord.c,kind:ci.kind,face:ci.face,points:ci.points,bonus:ci.bonus,rackUid:ci.rackUid,origin:ci.origin})),
            span:{r0:coords[0].r,c0:coords[0].c,r1:coords[coords.length-1].r,c1:coords[coords.length-1].c}
          });
        }
        function rec(posIdx){
          if(timedOut) return;
          if(posIdx===k){ tryFinish(); return; }
          const triedFaces = new Set();
          for(let ri=0; ri<rack.length; ri++){
            if(usedRackIdx.has(ri)) continue;
            const opts = expandTileOptions(rack[ri]);
            for(const opt of opts){
              const key = opt.kind+':'+opt.face+':'+opt.points;
              if(triedFaces.has(key)) continue;
              triedFaces.add(key);
              assignment[posIdx] = {kind:opt.kind, face:opt.face, points:opt.points, rackUid:rack[ri].uid, origin:opt.origin};
              usedRackIdx.add(ri);
              rec(posIdx+1);
              usedRackIdx.delete(ri);
              if(timedOut) return;
            }
          }
        }
        rec(0);
      }
    }
  }
  results.sort((a,b)=>b.score-a.score);
  const dedup=[]; const seen=new Set();
  for(const r of results){
    const key = r.dir+'|'+r.span.r0+','+r.span.c0+'-'+r.span.r1+','+r.span.c1+'|'+r.display;
    if(seen.has(key)) continue;
    seen.add(key); dedup.push(r);
    if(dedup.length>=maxResults) break;
  }
  return {results:dedup, timedOut, exploredCombos};
}


/* ======================= BOARD VALIDATION ======================= */
function collectRuns(board, dir){
  const runs = [];
  for(let idx=0; idx<SIZE; idx++){
    let run = [];
    for(let i=0; i<=SIZE; i++){
      const co = i<SIZE ? (dir==='H'?{r:idx,c:i}:{r:i,c:idx}) : null;
      const t = co ? board[co.r][co.c].tile : null;
      if(t){ run.push(co); continue; }
      if(run.length>=2) runs.push(run);
      run = [];
    }
  }
  return runs;
}
function validateBoard(board){
  const problems = [];
  for(const dir of ['H','V']){
    for(const run of collectRuns(board, dir)){
      const seq = run.map(co=>{ const t = board[co.r][co.c].tile; return {kind:t.kind, face:t.face}; });
      const res = validateEquation(seq);
      if(!res.valid) problems.push({dir, start:run[0], end:run[run.length-1], reason:res.reason});
    }
  }
  const counts = usageCountsFor(board, []);
  for(const key of Object.keys(counts)){
    const total = totalFor(key);
    if(total !== undefined && counts[key] > total) problems.push({tileKey:key, reason:'จำนวนเบี้ยเกินที่มีในถุง'});
  }
  return problems;
}


/* ======================= SUPPLY / USAGE (pure) ======================= */
function totalFor(key){
  if(key.startsWith('digit:')) return NUM_INFO[parseInt(key.split(':')[1],10)].count;
  if(key.startsWith('op:')) return OP_INFO[key.split(':')[1]].count;
  if(key.startsWith('dual:')) return DUAL_INFO[key.split(':')[1]].count;
  if(key==='blank') return BLANK_INFO.count;
  return undefined;
}
function usageCountsFor(boardState, rackState){
  const used = {};
  const bump = (key)=>{ used[key] = (used[key]||0)+1; };
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
    const t = boardState[r][c].tile;
    if(!t) continue;
    bump(t.origin || (t.kind==='digit' ? 'digit:'+t.face : 'op:'+t.face));
  }
  for(const t of rackState){
    if(t.kind==='digit') bump('digit:'+t.face);
    else if(t.kind==='op') bump('op:'+t.face);
    else if(t.kind==='dual') bump('dual:'+t.dual);
    else if(t.kind==='blank') bump('blank');
  }
  return used;
}
function remainingFor(boardState, rackState, key){
  const used = usageCountsFor(boardState, rackState);
  return totalFor(key) - (used[key]||0);
}

/* ======================= TYPED MOVE PARSER ======================= */
/* Syntax: digits 0-9 are digit tiles, [10]..[20] is a single tile,
 * + - * / = are operator tiles (* = ×, / = ÷). Example: "3+4=7", "[12]-[3]=9". */
function parseTypedMove(text){
  const tokens = [];
  const s = String(text).replace(/\s+/g,'');
  for(let i=0;i<s.length;){
    const ch = s[i];
    if(/\d/.test(ch)){ tokens.push({kind:'digit', face:ch}); i++; continue; }
    if(ch==='['){
      const end = s.indexOf(']', i);
      if(end<0) return {error:'ขาดวงเล็บปิด ] '};
      const n = s.slice(i+1,end);
      if(!/^\d+$/.test(n) || Number(n)<10 || Number(n)>20) return {error:'เบี้ยวงเล็บต้องเป็นเลข 10-20'};
      tokens.push({kind:'digit', face:String(Number(n))}); i = end+1; continue;
    }
    const opMap = {'+':'+','-':'-','*':'×','×':'×','/':'÷','÷':'÷','=':'='};
    if(opMap[ch]){ tokens.push({kind:'op', face:opMap[ch]}); i++; continue; }
    return {error:`ไม่รู้จักอักษร "${ch}"`};
  }
  if(tokens.length===0) return {error:'ยังไม่มีข้อความ'};
  return {tokens};
}

/* Place a typed move on a copy of the board. Existing tiles must match the text.
 * Returns {board, placements} or {error}. Does not check supply; caller does. */
function applyTypedMove(boardState, rackState, start, dir, text){
  const parsed = parseTypedMove(text);
  if(parsed.error) return {error: parsed.error};
  const next = boardState.map(row=>row.map(cell=>({...cell})));
  const placements = [];
  const { tokens } = parsed;
  for(let k=0;k<tokens.length;k++){
    const r = dir==='H' ? start.r : start.r + k;
    const c = dir==='H' ? start.c + k : start.c;
    if(r<0||r>=SIZE||c<0||c>=SIZE) return {error:'ตัวอักษรเกินขอบกระดาน'};
    const want = tokens[k];
    const existing = next[r][c].tile;
    if(existing){
      if(existing.face!==want.face) return {error:`ช่อง แถว ${r+1} คอลัมน์ ${c+1} มี "${existing.face}" อยู่แล้ว ไม่ใช่ "${want.face}"`};
      continue;
    }
    const points = want.kind==='digit' ? NUM_INFO[Number(want.face)].points : OP_INFO[want.face].points;
    next[r][c].tile = {kind:want.kind, face:want.face, points, origin: want.kind==='digit' ? 'digit:'+want.face : 'op:'+want.face};
    placements.push({r, c, kind:want.kind, face:want.face, points, origin:next[r][c].tile.origin});
  }
  return {board: next, placements};
}

/* Quick check of a finished board: rules + supply. */
function checkBoard(boardState, rackState){
  return validateBoard(boardState).concat(
    Object.keys(usageCountsFor(boardState, rackState))
      .filter(key => totalFor(key) !== undefined && usageCountsFor(boardState, rackState)[key] > totalFor(key))
      .map(key => ({tileKey:key, reason:'จำนวนเบี้ยเกินที่มีในถุง'}))
  );
}

const API = {
  NUM_INFO, OP_INFO, DUAL_INFO, BLANK_INFO, SIZE, CENTER,
  validateEquation, validateBoard, solve, emptyBoard, buildDefaultBonusLayout,
  usageCountsFor, remainingFor, totalFor,
  parseTypedMove, applyTypedMove, checkBoard
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else root.AMath = API;
})(typeof window !== 'undefined' ? window : globalThis);
