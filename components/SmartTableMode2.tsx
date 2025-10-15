/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// SmartTableMode2.tsx
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
  level: 0 | 1 | 2 | 3 | 4 | 5; // 0:Dept,1:Team,2:Process,3:(Factory|Plant),4:(Plant|Line),5:Line
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
const HIERARCHY_WIDTH = 220;

// 
function buildTree(rows: FlatRow[]): TreeRow[] {
  const root: Record<string, any> = {};

  for (const r of rows) {
    const D = (r.Department ?? '').trim(); 
    if (!D) continue;

    root[D] ??= { id: `D:${D}`, level: 0, Department: D, children: {} };

    const U = (r.Team ?? '').trim();
    const d1 = root[D].children;
    d1[U] ??= { id: `U:${D}/${U}`, level: 1, Department: D, Team: U, children: {} };

    const V = (r.Process ?? '').trim();
    const d2 = d1[U].children;
    d2[V] ??= { id: `P:${D}/${U}/${V}`, level: 2, Department: D, Team: U, Process: V, children: {} };

    const F = (r.Factory ?? '').trim();
    const parentForPlant =
      F
        ? (d2[V].children[F] ??= {
            id: `F:${D}/${U}/${V}/${F}`, level: 3,
            Department: D, Team: U, Process: V, Factory: F, children: {}
          })
        : d2[V];

    const PL = (r.Plant ?? '').trim();
    const plantChildren = (parentForPlant.children ??= {});
    const plantLevel = F ? 4 : 3;
    plantChildren[PL] ??= {
      id: `PL:${D}/${U}/${V}${F?`/${F}`:''}/${PL}`,
      level: plantLevel,
      Department: D, Team: U, Process: V, Factory: F || undefined, Plant: PL, children: {}
    };

    // ⬇️ 변경 포인트: Line이 없으면 Plant를 리프로 사용
    const hasLine = r.Line !== undefined && String(r.Line).trim() !== '';
    let leaf: TreeRow;

    if (hasLine) {
      const L = String(r.Line).trim();
      const lineChildren = plantChildren[PL].children;
      const lineLevel = F ? 5 : 4;

      lineChildren[L] ??= {
        id: `L:${D}/${U}/${V}${F?`/${F}`:''}/${PL}/${L}`,
        level: lineLevel,
        Department: D, Team: U, Process: V, Factory: F || undefined, Plant: PL, Line: L,
        ToBeTargetTO: 0, AsIsTO: 0, AsIsPO: 0,
        _jobs: {} as Record<string, JobAgg>,
      };

      leaf = lineChildren[L] as TreeRow;
    } else {
      // Plant가 리프
      const plantNode = plantChildren[PL];
      plantNode.ToBeTargetTO ??= 0;
      plantNode.AsIsTO ??= 0;
      plantNode.AsIsPO ??= 0;
      plantNode._jobs ??= {} as Record<string, JobAgg>;
      leaf = plantNode as TreeRow;
    }

    // 집계
    const jt = (r.JobTitle ?? '').trim();
    const t1 = r.ToBeTargetTO ?? 0;
    const t2 = r.AsIsTO ?? 0;
    const t3 = r.AsIsPO ?? 0;

    leaf.ToBeTargetTO = (leaf.ToBeTargetTO ?? 0) + t1;
    leaf.AsIsTO = (leaf.AsIsTO ?? 0) + t2;
    leaf.AsIsPO = (leaf.AsIsPO ?? 0) + t3;

    leaf._jobs ??= {} as Record<string, JobAgg>;
    leaf._jobs[jt] ??= { ToBeTargetTO: 0, AsIsTO: 0, AsIsPO: 0 };
    leaf._jobs[jt].ToBeTargetTO! += t1;
    leaf._jobs[jt].AsIsTO! += t2;
    leaf._jobs[jt].AsIsPO! += t3;
  }

  const toArray = (node:any): TreeRow =>
    node.children ? { ...node, children: Object.values(node.children).map((n:any)=>toArray(n)) } : node;

  return Object.values(root).map((n:any)=>toArray(n));
}


function sumByJob(node: TreeRow, job: string, metric: Metric): number {
  if (!node.children || node.children.length === 0) {
    const map = node._jobs;
    if (map) return (map[job]?.[metric] ?? 0);
    const jt = (node.JobTitle ?? '').trim();
    return jt === job ? (node[metric] as number) ?? 0 : 0;
  }
  return node.children.reduce((acc, c) => acc + sumByJob(c, job, metric), 0);
}
function sumDeep(node: TreeRow, metric: Metric): number {
  if (!node.children || node.children.length === 0) return (node[metric] as number) ?? 0;
  return node.children.reduce((acc, c) => acc + sumDeep(c, metric), 0);
}

export default function SmartTableMode2({
  data,
  jobCols,
  metric1: m1FromProps,
  metric2: m2FromProps,
}: {
  data: FlatRow[];
  jobCols: string[];
  metric1?: Metric; // 부모에서 전달 (Matrix A)
  metric2?: Metric; // 부모에서 전달 (Matrix B)
}) {
  const tree = React.useMemo(() => buildTree(data), [data]);

  const [metric1, setMetric1] = React.useState<Metric>(m1FromProps ?? 'ToBeTargetTO');
  const [metric2, setMetric2] = React.useState<Metric>(m2FromProps ?? 'AsIsTO');
  React.useEffect(()=>{ if (m1FromProps) setMetric1(m1FromProps); }, [m1FromProps]);
  React.useEffect(()=>{ if (m2FromProps) setMetric2(m2FromProps); }, [m2FromProps]);

  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const hierarchyCol: ColumnDef<TreeRow> = {
    id: 'hierarchy',
    header: 'Department',
    size: HIERARCHY_WIDTH,
    cell: ({ row }: { row: Row<TreeRow> }) => {
      const n = row.original;
      const indent = n.level * 20;

      // 레벨별 라벨: Factory가 없을 때(레벨 3=Plant, 4=Line)도 지원
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
          <span style={{ fontWeight: n.level===0?700:500, fontSize: n.level===0?14:12 }}>{label}</span>
        </div>
      );
    },
  };

  const groupCols: ColumnDef<TreeRow>[] = React.useMemo(() => {
    return jobCols.flatMap((jt, idx) => ([
      {
        id: `m1-${jt}`,
        header: jt,
        size: 90,
        cell: ({ row }: { row: Row<TreeRow> }) => (
          <div style={{ textAlign:'center', fontWeight:600 }}>
            {nf(sumByJob(row.original, jt, metric1))}
          </div>
        ),
      },
      {
        id: `m2-${jt}`,
        header: jt,
        size: 90,
        cell: ({ row }: { row: Row<TreeRow> }) => (
          <div style={{ textAlign:'center', fontWeight:600 }}>
            {nf(sumByJob(row.original, jt, metric2))}
          </div>
        ),
      },
      {
        id: `bal-${jt}`,
        header: 'Balance',
        size: 90,
        cell: ({ row }: { row: Row<TreeRow> }) => {
          const v = sumByJob(row.original, jt, metric1) - sumByJob(row.original, jt, metric2);
          return (
            <div style={{
              textAlign:'center', fontWeight:700,
              color: v < 0 ? '#e74c3c' : v > 0 ? '#27ae60' : '#333'
            }}>
              {nf(v)}
            </div>
          );
        },
      },
    ] as ColumnDef<TreeRow>[]));
  }, [jobCols, metric1, metric2]);

  const columns = React.useMemo<ColumnDef<TreeRow>[]>(() => [
    hierarchyCol,
    ...groupCols,
  ], [groupCols]);

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
      tree.forEach(d => { initial[d.id] = true; });
      setExpanded(initial);
    }
  }, [tree, expanded]);

  const footerOrder = React.useMemo(
    () => [
      'hierarchy',
      ...jobCols.flatMap(jt => [`m1-${jt}`, `m2-${jt}`, `bal-${jt}`]),
    ],
    [jobCols]
  );

  const firstGroupStartId = jobCols.length ? `m1-${jobCols[0]}` : '';

  return (
    <div className="card">
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              {table.getFlatHeaders().map(h => {
                const id = h.column.id;
                const isHierarchy = id === 'hierarchy';
                const isGroupStart = id.startsWith('m1-') && id !== firstGroupStartId;

                return (
                  <th
                    key={h.id}
                    style={{
                      width: h.getSize() ? `${h.getSize()}px` : undefined,
                      position: isHierarchy ? 'sticky' : undefined,
                      left: isHierarchy ? 0 : undefined,
                      zIndex: isHierarchy ? 3 : undefined,
                      background: isHierarchy ? 'var(--thead-sticky-left-bg, #0f1b3f)' : undefined,
                      borderLeft: isGroupStart ? '2px solid rgba(0,0,0,0.15)' : undefined,
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {table.getRowModel().rows.map(r => (
              <tr key={r.id}>
                {r.getVisibleCells().map(c => {
                  const id = c.column.id;
                  const isHierarchy = id === 'hierarchy';
                  const isGroupStart = id.startsWith('m1-') && id !== firstGroupStartId;

                  return (
                    <td
                      key={c.id}
                      style={{
                        position: isHierarchy ? 'sticky' : undefined,
                        left: isHierarchy ? 0 : undefined,
                        zIndex: isHierarchy ? 2 : undefined,
                        background: isHierarchy ? 'var(--tbody-sticky-left-bg, #fff)' : undefined,
                        width: isHierarchy ? HIERARCHY_WIDTH : undefined,
                        minWidth: isHierarchy ? HIERARCHY_WIDTH : undefined,
                        maxWidth: isHierarchy ? HIERARCHY_WIDTH : undefined,
                        borderLeft: isGroupStart ? '2px solid rgba(0,0,0,0.12)' : undefined,
                      }}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* TOTAL 행 */}
            <tr className="total">
              {footerOrder.map((id) => {
                const isHierarchy = id === 'hierarchy';
                const isGroupStart = id.startsWith('m1-') && id !== firstGroupStartId;

                const style: React.CSSProperties = {
                  position: isHierarchy ? 'sticky' : undefined,
                  left: isHierarchy ? 0 : undefined,
                  zIndex: isHierarchy ? 2 : undefined,
                  background: isHierarchy ? 'var(--tbody-sticky-left-bg, #eef3ff)' : undefined,
                  fontWeight: isHierarchy ? 700 : undefined,
                  width: isHierarchy ? HIERARCHY_WIDTH : undefined,
                  minWidth: isHierarchy ? HIERARCHY_WIDTH : undefined,
                  maxWidth: isHierarchy ? HIERARCHY_WIDTH : undefined,
                  borderLeft: isGroupStart ? '2px solid rgba(0,0,0,0.12)' : undefined,
                };

                if (isHierarchy) return <td key={`total-${id}`} style={style}>TOTAL</td>;

                if (id.startsWith('m1-')) {
                  const jt = id.replace('m1-', '');
                  const val = tree.reduce((a, n) => a + sumByJob(n, jt, metric1), 0);
                  return <td key={`total-${id}`} style={style} className="right">{nf(val)}</td>;
                }

                if (id.startsWith('m2-')) {
                  const jt = id.replace('m2-', '');
                  const val = tree.reduce((a, n) => a + sumByJob(n, jt, metric2), 0);
                  return <td key={`total-${id}`} style={style} className="right">{nf(val)}</td>;
                }

                if (id.startsWith('bal-')) {
                  const jt = id.replace('bal-', '');
                  const v1 = tree.reduce((a, n) => a + sumByJob(n, jt, metric1), 0);
                  const v2 = tree.reduce((a, n) => a + sumByJob(n, jt, metric2), 0);
                  return <td key={`total-${id}`} style={style} className="right">{nf(v1 - v2)}</td>;
                }

                return <td key={`total-${id}`} style={style}></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
 