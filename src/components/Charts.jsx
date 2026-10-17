import React, { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { COLORS } from '../lib/constants.js';
import { axisInr, inr } from '../lib/format.js';
import { downloadText, toCSV } from '../lib/csv.js';

const SURFACE = '#fffdf9';
const AXIS = '#6a766f';

/** Newest year gets the darkest step; older years get lighter ones. */
export function yearColor(years, y, ramp = COLORS.years) {
  const i = years.indexOf(y);
  const fromEnd = years.length - 1 - i;
  return ramp[Math.max(0, ramp.length - 1 - fromEnd)];
}

export function Legend({ items }) {
  if (!items || items.length < 2) return null;
  return (
    <div className="legend" style={{ marginBottom: 6 }}>
      {items.map((it) => (
        <span key={it.name}>
          <i className="sw" style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  );
}

function Tip({ active, payload, label, fmt = inr, hint, total }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value !== undefined && p.value !== null && p.dataKey !== '__none');
  const sum = items.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div className="tt">
      <div className="th">{label ?? payload[0]?.payload?.label ?? payload[0]?.name}</div>
      {items.map((p) => (
        <div className="tr" key={p.dataKey} style={{ '--c': p.color || p.fill || p.stroke }}>
          <span>{p.name}</span>
          <b className="num">{fmt(p.value)}</b>
        </div>
      ))}
      {total && items.length > 1 && (
        <div className="tr" style={{ borderTop: '1px solid #e2e6dd', marginTop: 4, paddingTop: 4 }}>
          <span>Total</span>
          <b className="num">{fmt(sum)}</b>
        </div>
      )}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/** Card with the chart, a Table view twin, and a CSV download. columns: [{key,label,fmt?}] */
export function ChartCard({ title, sub, legend, columns, rows, csvName, children, note }) {
  const [table, setTable] = useState(false);
  const cell = (c, r) => (c.fmt ? c.fmt(r[c.key], r) : r[c.key]);
  const download = () => {
    downloadText(`${csvName || 'chart'}.csv`, toCSV([columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => (c.csv ? c.csv(r[c.key], r) : cell(c, r))))]));
  };
  return (
    <section className="card chart-card" aria-label={title}>
      <div className="chart-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        <div className="chart-tools">
          <button onClick={() => setTable((t) => !t)} aria-pressed={table}>{table ? 'Show chart' : 'Show table'}</button>
          <button onClick={download}>Download</button>
        </div>
      </div>
      {table ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{columns.map((c, i) => <th key={c.key} className={i ? 'right' : ''}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{columns.map((c, i) => <td key={c.key} className={i ? 'right num' : ''}>{cell(c, r)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <Legend items={legend} />
          {children}
        </>
      )}
      {note && <p className="small faint" style={{ marginTop: 8 }}>{note}</p>}
    </section>
  );
}

export function Empty0({ children = 'Nothing to show for this selection.' }) {
  return <div className="empty" style={{ padding: '40px 8px' }}>{children}</div>;
}

/**
 * series: [{key,name,color}] ; stacked draws them on top of each other with a 2px gap.
 * onPick(dataRow) makes every bar clickable.
 */
export function BarsChart({ data, xKey = 'label', series, stacked, onPick, height = 280, fmt = inr, yFmt = axisInr, horizontal, hint, barSize, colorByPoint }) {
  const last = series.length - 1;
  const common = { data, margin: { top: 8, right: 10, bottom: 0, left: 0 }, barCategoryGap: horizontal ? '28%' : '22%', barGap: 2 };
  const pickHint = onPick ? hint || 'Click the bar to see these events' : undefined;
  const bars = series.map((s, i) => (
    <Bar
      key={s.key}
      dataKey={s.key}
      name={s.name}
      fill={s.color}
      stackId={stacked ? 'a' : undefined}
      stroke={stacked ? SURFACE : undefined}
      strokeWidth={stacked ? 2 : 0}
      radius={stacked ? (i === last ? [4, 4, 0, 0] : 0) : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
      maxBarSize={barSize || (horizontal ? 22 : 30)}
      isAnimationActive={false}
      cursor={onPick ? 'pointer' : 'default'}
      onClick={onPick ? (d) => onPick(d.payload || d, s) : undefined}
    >
      {colorByPoint && data.map((d, k) => <Cell key={k} fill={colorByPoint(d, k)} />)}
    </Bar>
  ));
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {horizontal ? (
          <BarChart {...common} layout="vertical" margin={{ top: 4, right: 18, bottom: 0, left: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickFormatter={yFmt} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={xKey} width={92} tick={{ fill: '#2d3a33', fontSize: 13 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(22,57,43,0.05)' }} content={<Tip fmt={fmt} hint={pickHint} total={stacked} />} />
            {bars}
          </BarChart>
        ) : (
          <BarChart {...common}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: '#c9d0c4' }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickFormatter={yFmt} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} width={46} />
            <Tooltip cursor={{ fill: 'rgba(22,57,43,0.05)' }} content={<Tip fmt={fmt} hint={pickHint} total={stacked} />} />
            {bars}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** One line per series (used for year-over-year). */
export function LinesChart({ data, xKey = 'label', series, height = 280, fmt = inr, yFmt = axisInr }) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: '#c9d0c4' }} tickLine={false} />
          <YAxis tickFormatter={yFmt} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} width={46} />
          <Tooltip content={<Tip fmt={fmt} />} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bars plus a line on the SAME rupee axis (never a second axis). */
export function BarsAndLine({ data, bars, line, height = 280, onPick }) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: '#c9d0c4' }} tickLine={false} minTickGap={8} />
          <YAxis tickFormatter={axisInr} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} width={46} />
          <Tooltip cursor={{ fill: 'rgba(22,57,43,0.05)' }} content={<Tip hint={onPick ? 'Click the bars to see these events' : undefined} />} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} cursor={onPick ? 'pointer' : 'default'} onClick={onPick ? (d) => onPick(d.payload || d) : undefined} />
          ))}
          <Line type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2.5} dot={{ r: 3, stroke: SURFACE, strokeWidth: 2, fill: line.color }} activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Part-to-whole for six or fewer slices, with a table beside it so close values can be compared. */
export function Donut({ data, total, height = 240 }) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<Tip />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="92%" paddingAngle={2} stroke={SURFACE} strokeWidth={2} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <text x="50%" y="48%" textAnchor="middle" style={{ font: '700 20px var(--font-head)', fill: '#17231d' }}>{total}</text>
          <text x="50%" y="60%" textAnchor="middle" style={{ fontSize: 12, fill: AXIS }}>total expenses</text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
