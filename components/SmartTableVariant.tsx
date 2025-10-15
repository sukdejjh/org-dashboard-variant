// SmartTableVariant.tsx

'use client';
import * as React from 'react';
import {
  ColumnDef,
  Row,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ExpandedState,
} from '@tanstack/react-table';

type Metric = 'ToBeTargetTO' | 'AsIsTO' | 'AsIsPO';

export type FlatRow = {
  corp: 'VJ' | 'JJ' | 'QD';
  Department: string;
  Team?: string;     // Upper
  Process?: string;  // VSM
  Factory?: string;  // ← optional
  Plant?: string;
  Line?: number;
  JobTitle?: string; // TM/Staff, TL, GL, MGL, VSM …
  ToBeTargetTO?: number;
  AsIsTO?: number;
  AsIsPO?: number;
};

type JobAgg = { ToBeTargetTO?: number; AsIsTO?: number; AsIsPO?: number };

type TreeRow = {
  id: string;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  Department: string;
  Team?: string;
  Process?: string;
  Factory?: string;
  Plant?: string;
  Line?: string;
  JobTitle?: string;
  ToBeTargetTO?: number;
  AsIsTO?: number;
  AsIsPO?: number;
  _jobs?: Record<string, JobAgg>;
  children?: TreeRow[];
};

const nf = (n?: number) => (n == null ? '' : n.toLocaleString());
const HIERARCHY_WIDTH = 240;

/* ---------- 트리 변환 (Factory가 없으면 레벨을 건너뜀) ---------- */
function buildTreeVariant(rows: FlatRow[]): TreeRow[] {
  const root: Record<string, any> = {};

  for (const r of rows) {
    const D = (r.Department || '').trim();
    if (!D) continue;

    root[D] ??= { id: `D:${D}`, level: 0, Department: D, children: {} };
    let node = root[D]; const path: string[] = [D];

    if (r.Team) {
      const U = r.Team.trim();
      path.push(U);
      node.children[U] ??= { id: `U:${path.join('/')}`, level: 1, Department: D, Team: U, children: {} };
      node = node.children[U];
    }
    if (r.Process) {
      const P = r.Process.trim();
      path.push(P);
      node.children[P] ??= { id: `P:${path.join('/')}`, level: 2, Department: D, Team: r.Team, Process: P, children: {} };
      node = node.children[P];
    }

    const hasFactory = !!r.Factory && String(r.Factory).trim() !== '';
    if (hasFactory) {
      const F = String(r.Factory).trim();
      path.push(F);
      node.children[F] ??= { id: `F:${path.join('/')}`, level: 3, Department: D, Team: r.Team, Process: r.Process, Factory: F, children: {} };
      node = node.children[F];
    }

    if (r.Plant) {
      const PL = r.Plant.trim();
      path.push(PL);
      node.children[PL] ??= { id: `PL:${path.join('/')}`, level: hasFactory ? 4 : 3, Department: D, Team: r.Team, Process: r.Process, Factory: hasFactory ? String(r.Factory) : undefined, Plant: PL, children: {} };
      node = node.children[PL];
    }
    if (r.Line != null && r.Line !== undefined && String(r.Line).trim() !== '') {
      const L = String(r.Line).trim();
      path.push(L);
      node.children[L] ??= { id: `L:${path.join('/')}`, level: hasFactory ? 5 : 4, Department: D, Team: r.Team, Process: r.Process, Factory: hasFactory ? String(r.Factory) : undefined, Plant: r.Plant, Line: L, children: {} };
      node = node.children[L];
    }

    // 값 누적
    const jt = (r.JobTitle ?? '').trim();
    const t1 = r.ToBeTargetTO ?? 0;
    const t2 = r.AsIsTO ?? 0;
    const t3 = r.AsIsPO ?? 0;

    node.ToBeTargetTO = (node.ToBeTargetTO ?? 0) + t1;
    node.AsIsTO       = (node.AsIsTO       ?? 0) + t2;
    node.AsIsPO       = (node.AsIsPO       ?? 0) + t3;
    node._jobs ??= {};
    node._jobs[jt] ??= { ToBeTargetTO: 0, AsIsTO: 0, AsIsPO: 0 };
    node._jobs[jt].ToBeTargetTO! += t1;
    node._jobs[jt].AsIsTO!       += t2;
    node._jobs[jt].AsIsPO!       += t3;
  }

  // 불필요 노드 가지치기
  const prune = (n: any): any => {
    if (n.children) {
      const pruned: Record<string, any> = {};
      for (const [k, c] of Object.entries(n.children)) {
        const pc = prune(c);
        if (pc) pruned[k] = pc;
      }
      n.children = pruned;
    }
    const selfTotal = (n.ToBeTargetTO ?? 0) + (n.AsIsTO ?? 0) + (n.AsIsPO ?? 0);
    const hasChildren = n.children && Object.keys(n.children).length > 0;
    if (!hasChildren && selfTotal === 0 && n.level !== 0) return null; // Dept는 유지
    return n;
  };

  const toArray = (n: any): TreeRow =>
    n.children ? { ...n, children: Object.values(n.children).map(toArray) } : n;

  return Object.values(root).map(prune).filter(Boolean).map(toArray);
}

function sumByJob(node: TreeRow, job: string, metric: Metric): number {
  const self = node._jobs ? (node._jobs[job]?.[metric] ?? 0) : 0;
  if (!node.children || node.children.length === 0) return self;
  return self + node.children.reduce((acc, c) => acc + sumByJob(c, job, metric), 0);
}
function sumDeep(node: TreeRow, metric: Metric): number {
  const self = (node[metric] as number) ?? 0;
  if (!node.children || node.children.length === 0) return self;
  return self + node.children.reduce((acc, c) => acc + sumDeep(c, metric), 0);
}

/* ---------- 컴포넌트 ---------- */
export default function SmartTableVariant({
  data,
  jobCols,
  metric1: m1FromProps,
  metric2: m2FromProps,
}: {
  data: FlatRow[];
  jobCols: string[];        // 예: ['MGL','A.MGL','VSM','A.VSM','GL','TL','TM/Staff']
  metric1?: Metric;
  metric2?: Metric;
}) {
  const tree = React.useMemo(() => buildTreeVariant(data), [data]);

  const [metric1, setMetric1] = React.useState<Metric>(m1FromProps ?? 'ToBeTargetTO');
  const [metric2, setMetric2] = React.useState<Metric>(m2FromProps ?? 'AsIsTO');
  React.useEffect(()=>{ if (m1FromProps) setMetric1(m1FromProps); }, [m1FromProps]);
  React.useEffect(()=>{ if (m2FromProps) setMetric2(m2FromProps); }, [m2FromProps]);

  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  React.useEffect(() => { setExpanded({}); }, [jobCols]); // jobCols 바뀌면 접힘 초기화

  const firstRightColId = jobCols.length > 0 ? `m2-${jobCols[0]}` : 'm2-total';

  const hierarchyCol: ColumnDef<TreeRow> = {
    id: 'hierarchy',
    header: 'Department',
    size: HIERARCHY_WIDTH,
    cell: ({ row }: { row: Row<TreeRow> }) => {
      const n = row.original;
      const indent = n.level * 20;
      const label =
        n.level === 0 ? n.Department :
        n.level === 1 ? (n.Team ?? '') :
        n.level === 2 ? (n.Process ?? '') :
        n.level === 3 ? (n.Factory ?? n.Plant ?? '') :
        n.level === 4 ? ((n.Factory ? n.Plant : n.Line) ?? '') :
        n.level === 5 ? (n.Line ?? '') : '';
      return (
        <div style={{ display:'flex', alignItems:'center', gap:8, paddingLeft: indent }}>
          {row.getCanExpand() && (
            <button className="expander" onClick={row.getToggleExpandedHandler()}>
              {row.getIsExpanded() ? '▾' : '▸'}
            </button>
          )}
          <span style={{ fontWeight: n.level === 0 ? 700 : 500, fontSize: n.level === 0 ? 14 : 12 }}>
            {label}
          </span>
        </div>
      );
    },
  };

  // 왼쪽 지표 그룹
  const leftGroup: ColumnDef<TreeRow> = {
    id: 'leftGroup',
    header: () => (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center' }}>
        <select value={metric1} onChange={e=>setMetric1(e.target.value as Metric)}>
          <option value="ToBeTargetTO">To-be Target TO</option>
          <option value="AsIsTO">As-is TO</option>
          <option value="AsIsPO">As-is PO</option>
        </select>
      </div>
    ),
    columns: [
      ...jobCols.map(jt => ({
        id: `m1-${jt}`,
        header: jt,
        size: 90,
        cell: ({ row }: { row: Row<TreeRow> }) => (
          <div style={{ textAlign:'center', fontSize:14, fontWeight:600 }}>
            {nf(sumByJob(row.original, jt, metric1))}
          </div>
        ),
      })),
      {
        id: 'm1-total',
        header: 'Total',
        size: 110,
        cell: ({ row }: { row: Row<TreeRow> }) => (
          <div style={{ textAlign:'center', fontSize:14, fontWeight:700 }}>
            {nf(sumDeep(row.original, metric1))}
          </div>
        ),
      },
    ],
  };

  // 오른쪽 지표 그룹
  const rightGroup: ColumnDef<TreeRow> = {
    id: 'rightGroup',
    header: () => (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center' }}>
        <select value={metric2} onChange={e=>setMetric2(e.target.value as Metric)}>
          <option value="ToBeTargetTO">To-be Target TO</option>
          <option value="AsIsTO">As-is TO</option>
          <option value="AsIsPO">As-is PO</option>
        </select>
      </div>
    ),
    columns: [
      ...jobCols.map(jt => ({
        id: `m2-${jt}`,
        header: jt,
        size: 90,
        cell: ({ row }: { row: Row<TreeRow> }) => (
          <div style={{ textAlign:'center', fontSize:14, fontWeight:600 }}>
            {nf(sumByJob(row.original, jt, metric2))}
          </div>
        ),
      })),
      {
        id: 'm2-total',
        header: 'Total',
        size: 110,
        cell: ({ row }: { row: Row<TreeRow> }) => (
          <div style={{ textAlign:'center', fontSize:14, fontWeight:700 }}>
            {nf(sumDeep(row.original, metric2))}
          </div>
        ),
      },
    ],
  };

  // Balance
  const balanceCol: ColumnDef<TreeRow> = {
    id: 'balance',
    header: 'Balance',
    size: 110,
    cell: ({ row }: { row: Row<TreeRow> }) => {
      const a = sumDeep(row.original, metric1);
      const b = sumDeep(row.original, metric2);
      const v = a - b;
      return (
        <div style={{
          textAlign:'center', fontSize:14, fontWeight:700,
          color: v < 0 ? '#e74c3c' : v > 0 ? '#27ae60' : '#333'
        }}>
          {nf(v)}
        </div>
      );
    },
  };

  const columns = React.useMemo<ColumnDef<TreeRow>[]>(() => [
    hierarchyCol,
    leftGroup,
    rightGroup,
    balanceCol,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [jobCols, metric1, metric2]);

  const table = useReactTable({
    data: React.useMemo(()=>tree, [tree]),
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (r) => (r as unknown as TreeRow).children ?? [],
    autoResetExpanded: false,
  });

  React.useEffect(() => {
    if (Object.keys(expanded).length === 0 && tree.length > 0) {
      const initial: Record<string, boolean> = {};
      tree.forEach(d => { initial[d.id] = true; }); // 최상위 Dept만 펼침
      setExpanded(initial);
    }
  }, [tree, expanded]);

  // 합계 계산
  // const rows0 = table.getRowModel().rows.map(r => r.original as TreeRow);
  // const totals = React.useMemo(() => {
  //   const total1 = rows0.reduce((a,n)=>a+sumDeep(n, metric1), 0);
  //   const total2 = rows0.reduce((a,n)=>a+sumDeep(n, metric2), 0);
  //   const balance = total1 - total2;
  //   const jobs = jobCols.map(jt => ({
  //     jt,
  //     m1: rows0.reduce((a,n)=>a+sumByJob(n, jt, metric1), 0),
  //     m2: rows0.reduce((a,n)=>a+sumByJob(n, jt, metric2), 0),
  //   }));
  //   return { total1, total2, balance, jobs };
  // }, [rows0, metric1, metric2, jobCols]);
  
  // 드릴다운과 무관하게 "원본 트리" 기준으로 TOTAL 고정
  const totals = React.useMemo(() => {
    const total1 = tree.reduce((a,n)=>a+sumDeep(n, metric1), 0);
    const total2 = tree.reduce((a,n)=>a+sumDeep(n, metric2), 0);
    const balance = total1 - total2;
    const jobs = jobCols.map(jt => ({
      jt,
      m1: tree.reduce((a,n)=>a+sumByJob(n, jt, metric1), 0),
      m2: tree.reduce((a,n)=>a+sumByJob(n, jt, metric2), 0),
    }));
    return { total1, total2, balance, jobs }
  }, [tree, metric1, metric2, jobCols]);


  const headerGroups = table.getHeaderGroups();
  const leafColumns = table.getAllLeafColumns();

  return (
    <div className="card">
      <div className="table-scroll">
        <table className="table">
          <thead>
            {headerGroups.map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => {
                  const id = h.column.id;
                  const isHierarchy = id === 'hierarchy';
                  const isRightGroupHeader = id === 'rightGroup';
                  const isBalance = id === 'balance';
                  const isM1Total = id === 'm1-total';
                  const isM2Total = id === 'm2-total';

                  const style: React.CSSProperties = {
                    width: h.getSize() ? `${h.getSize()}px` : undefined,
                    position: isHierarchy ? 'sticky' : undefined,
                    left: isHierarchy ? 0 : undefined,
                    zIndex: isHierarchy ? 3 : undefined,
                    background: isHierarchy ? 'var(--thead-sticky-left-bg, #0f1b3f)' : undefined,
                    borderRight: isM1Total || isM2Total ? '2px solid rgba(0,0,0,0.15)' : undefined,
                    borderLeft:  isM1Total || isM2Total || isRightGroupHeader || isBalance ? '2px solid rgba(0,0,0,0.15)' : undefined,
                  };

                  return (
                    <th key={h.id} colSpan={h.colSpan} style={style}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id}>
                {r.getVisibleCells().map((c) => {
                  const id = c.column.id;
                  const isHierarchy = id === 'hierarchy';
                  const isM1Total = id === 'm1-total';
                  const isM2Total = id === 'm2-total';
                  const isRightGroupStart = id === firstRightColId;
                  const isBalance = id === 'balance';

                  const style: React.CSSProperties = {
                    position: isHierarchy ? 'sticky' : undefined,
                    left: isHierarchy ? 0 : undefined,
                    zIndex: isHierarchy ? 2 : undefined,
                    background: isHierarchy ? 'var(--tbody-sticky-left-bg, #fff)' : undefined,
                    width: isHierarchy ? HIERARCHY_WIDTH : undefined,
                    minWidth: isHierarchy ? HIERARCHY_WIDTH : undefined,
                    maxWidth: isHierarchy ? HIERARCHY_WIDTH : undefined,
                    borderRight: isM1Total || isM2Total ? '2px solid rgba(0,0,0,0.12)' : undefined,
                    borderLeft:  isM1Total || isM2Total || isRightGroupStart || isBalance ? '2px solid rgba(0,0,0,0.12)' : undefined,
                  };

                  return (
                    <td key={c.id} style={style}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* TOTAL 행 — leaf 컬럼만 */}
            <tr className="total">
              {leafColumns.map((col) => {
                const id = col.id;
                const isHierarchy = id === 'hierarchy';
                const isM1Total = id === 'm1-total';
                const isM2Total = id === 'm2-total';
                const isRightGroupStart = id === firstRightColId;
                const isBalance = id === 'balance';

                const style: React.CSSProperties = {
                  position: isHierarchy ? 'sticky' : undefined,
                  left: isHierarchy ? 0 : undefined,
                  zIndex: isHierarchy ? 2 : undefined,
                  background: isHierarchy ? 'var(--tbody-sticky-left-bg, #eef3ff)' : undefined,
                  fontWeight: isHierarchy ? 700 : undefined,
                  width: isHierarchy ? HIERARCHY_WIDTH : undefined,
                  minWidth: isHierarchy ? HIERARCHY_WIDTH : undefined,
                  maxWidth: isHierarchy ? HIERARCHY_WIDTH : undefined,
                  borderRight: isM1Total || isM2Total ? '2px solid rgba(0,0,0,0.12)' : undefined,
                  borderLeft:  isM1Total || isM2Total || isRightGroupStart || isBalance ? '2px solid rgba(0,0,0,0.12)' : undefined,
                };

                if (isHierarchy) return <td key={`total-${id}`} style={style}>TOTAL</td>;
                if (id.startsWith('m1-') && id !== 'm1-total') {
                  const jt = id.replace('m1-','');
                  return <td key={`total-${id}`} style={style} className="right">
                    {nf(tree.reduce((a,n)=>a+sumByJob(n, jt, metric1), 0))}
                  </td>;
                }
                if (id === 'm1-total') return <td key={`total-${id}`} style={style} className="right">{nf(totals.total1)}</td>;
                if (id.startsWith('m2-') && id !== 'm2-total') {
                  const jt = id.replace('m2-','');
                  return <td key={`total-${id}`} style={style} className="right">
                    {nf(tree.reduce((a,n)=>a+sumByJob(n, jt, metric2), 0))}
                  </td>;
                }
                if (id === 'm2-total') return <td key={`total-${id}`} style={style} className="right">{nf(totals.total2)}</td>;
                if (id === 'balance') return <td key={`total-${id}`} style={style} className="right">{nf(totals.balance)}</td>;
                return <td key={`total-${id}`} style={style}></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
