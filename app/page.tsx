/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import * as React from 'react';
import SmartTableVariant from '@/components/SmartTableVariant';
import SmartTableMode2 from '@/components/SmartTableMode2';

type Corp = 'VJ' | 'JJ' | 'QD';
type Metric = 'ToBeTargetTO' | 'AsIsTO' | 'AsIsPO';
type DeptView = 'prod' | 'nonprod';

// 엑셀 파일 경로 (public/ 아래라서 fetch 가능)
const FILE_URL = '/data/org_dashboard.xlsx';

// 부서별 Job Title 세트
const JOBSETS = {
  prod: ['MGL','A.MGL','VSM','A.VSM','GL','TL','TM/Staff'] as string[],
  nonprod: ['HOT','Part Leader','Section Leader','TM/Staff'] as string[],
};

// 엑셀 행 → 앱에서 쓰는 형태로 정규화
type Row = {
  corp: Corp;
  Department: string;
  Team?: string;
  Process?: string;
  Factory?: string;   // ← 추가
  Plant?: string;
  Line?: number;
  JobTitle: string;
  ToBeTargetTO?: number;
  AsIsTO?: number;
  AsIsPO?: number;
};


function normalizeRow(r: any): Row {
  const s = (v: any) => (v === undefined || v === null ? '' : String(v).trim());
  const n = (v: any) => {
    if (v === '' || v === null || v === undefined) return undefined;
    const num = Number(v);
    return Number.isFinite(num) ? num : undefined;
  };

  const lineValStr = s(r.Line);
  const lineVal = lineValStr ? Number(lineValStr) : undefined;

  return {
    corp: s(r.corp) as Corp,
    Department: s(r.Department),
    Team: s(r.Team) || undefined,
    Process: s(r.Process) || undefined,
    Factory: s(r.Factory) || undefined,   // ← 추가
    Plant: s(r.Plant) || undefined,
    Line: lineVal,
    JobTitle: s(r.JobTitle),
    ToBeTargetTO: n(r.ToBeTargetTO) ?? 0,
    AsIsTO: n(r.AsIsTO) ?? 0,
    AsIsPO: n(r.AsIsPO) ?? 0,
  };
}


export default function Page() {
  const [corp, setCorp] = React.useState<Corp>('VJ');
  const [mode, setMode] = React.useState<'1' | '2'>('1');
  const [deptView, setDeptView] = React.useState<DeptView>('prod');

  // 모드2용 외부 드롭박스
  const [matrixA, setMatrixA] = React.useState<Metric>('ToBeTargetTO');
  const [matrixB, setMatrixB] = React.useState<Metric>('AsIsTO');

  // 엑셀 데이터 상태
  const [allRows, setAllRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // 엑셀 로드
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        // 동적 import 로 번들 크기 축소
        const XLSX = await import('xlsx');
        const res = await fetch(FILE_URL);
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets['data'] ?? wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
        const rows = json.map(normalizeRow);
        if (!cancelled) setAllRows(rows);
      } catch (e:any) {
        console.error(e);
        if (!cancelled) setErr(e?.message ?? '엑셀 로드 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 부서 뷰에 맞는 직무 열 순서
  const jobCols = React.useMemo(
    () => (deptView === 'prod' ? JOBSETS.prod : JOBSETS.nonprod),
    [deptView]
  );

  // corp + 부서 뷰로 데이터 필터
  const filteredRows = React.useMemo(() => {
    return allRows.filter(r =>
      r.corp === corp &&
      (deptView === 'prod' ? r.Department === '생산' : r.Department !== '생산')
    );
  }, [allRows, corp, deptView]);

  return (
    <div className="main-container">
      <h1 className="page-title">Organization Operations Dashboard </h1>

      {/* 법인 선택 */}
      <div className="corp-selector">
        {(['VJ','JJ','QD'] as Corp[]).map(id => (
          <button
            key={id}
            className={`btn ${corp===id ? 'active' : ''}`}
            onClick={() => setCorp(id)}
          >
            {id}
          </button>
        ))}
      </div>

      {/* 모드 라디오 + 부서 뷰 토글 + (모드2일 때) Matrix A/B */}
      <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap', margin:'12px 0' }}>
        {/* 조회모드 라디오 */}
        <label style={{ display:'flex', gap:6, alignItems:'center', cursor:'pointer' }}>
          <input type="radio" name="viewMode" value="1" checked={mode==='1'} onChange={()=>setMode('1')} />
          <span>조회모드 1</span>
        </label>
        <label style={{ display:'flex', gap:6, alignItems:'center', cursor:'pointer' }}>
          <input type="radio" name="viewMode" value="2" checked={mode==='2'} onChange={()=>setMode('2')} />
          <span>조회모드 2</span>
        </label>

        <span className="divider" />

        {/* 부서 뷰 토글 */}
        <div role="tablist" aria-label="부서 뷰" className="seg-group">
          <button 
            className={`seg ${deptView==='prod'?'active':''}`} 
            onClick={()=>setDeptView('prod')}
          >
            생산
          </button>
          <button 
            className={`seg ${deptView==='nonprod'?'active':''}`} 
            onClick={()=>setDeptView('nonprod')}
          >
            지원/품질/관리/개발
          </button>
        </div>
        

        {/* 모드2 전용 Matrix A/B는 계속 오른쪽에 */}
        {mode === '2' && (
          <>
            <span className="divider" />
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <label style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span>Matrix A:</span>
                <select value={matrixA} onChange={e=>setMatrixA(e.target.value as Metric)}>
                  <option value="ToBeTargetTO">To-be Target TO</option>
                  <option value="AsIsTO">As-is TO</option>
                  <option value="AsIsPO">As-is PO</option>
                </select>
              </label>
              <label style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span>Matrix B:</span>
                <select value={matrixB} onChange={e=>setMatrixB(e.target.value as Metric)}>
                  <option value="ToBeTargetTO">To-be Target TO</option>
                  <option value="AsIsTO">As-is TO</option>
                  <option value="AsIsPO">As-is PO</option>
                </select>
              </label>
            </div>
          </>
        )}
      </div>

      {/* 로딩/에러 처리 */}
      {loading && <div className="card" style={{ padding:16 }}>엑셀 로딩 중…</div>}
      {err && !loading && <div className="card" style={{ padding:16, color:'#c0392b' }}>엑셀 로드 오류: {err}</div>}

      {!loading && !err && (
        mode === '1'
          ? <SmartTableVariant data={filteredRows} jobCols={jobCols} />
          : <SmartTableMode2 data={filteredRows} jobCols={jobCols} metric1={matrixA} metric2={matrixB} />
      )}
    </div>
  );
}
