"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { progressChartData, progressRows } from "@/lib/dashboard/progressChart";
import { formatIstShortDate } from "@/lib/dates/ist";
import type { StoredStudentStats } from "@/lib/validation/stats";
import type { TaskType } from "@/lib/validation/task";

/** Mid-tone colours readable on light and dark backgrounds; dashes and dot shapes also tell lines apart. */
const LINE_STYLE: Record<TaskType, { color: string; dash?: string; dot: "circle" | "square" | "diamond" }> = {
  coding: { color: "#2563eb", dot: "circle" },
  resume: { color: "#16a34a", dash: "6 4", dot: "square" },
  intro_written: { color: "#ea580c", dash: "2 4", dot: "diamond" },
};

const AXIS_TICK = { fill: "currentColor", fontSize: 12, opacity: 0.75 };

/** Line chart of task scores over time, one line per skill (SPEC.md §8.5), with a screen-reader table. */
export function ProgressChart({ recentScores }: { recentScores: StoredStudentStats["recentScores"] | undefined }) {
  const data = progressChartData(recentScores);
  if (!data.hasChart) {
    return (
      <p className="text-sm opacity-70">
        Your progress chart appears after you have scores on at least two tasks.
      </p>
    );
  }
  const rows = progressRows(data);
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15">
      <div aria-hidden="true" className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.points} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              padding={{ left: 12, right: 12 }}
              tickFormatter={formatIstShortDate}
              tick={AXIS_TICK}
              minTickGap={16}
            />
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={AXIS_TICK} width={44} />
            <Tooltip
              labelFormatter={(time) => formatIstShortDate(Number(time))}
              formatter={(value) => [`${Number(value).toFixed(1)} / 10`]}
              contentStyle={{ borderRadius: 8, fontSize: 13, color: "#111" }}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} formatter={(value) => <span className="text-foreground">{value}</span>} />
            {data.skills.map(({ type, label }) => {
              const style = LINE_STYLE[type];
              return (
                <Line
                  key={type}
                  dataKey={type}
                  name={label}
                  type="monotone"
                  stroke={style.color}
                  strokeWidth={2}
                  strokeDasharray={style.dash}
                  dot={{ r: 4, fill: style.color }}
                  legendType={style.dot}
                  connectNulls
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs opacity-70">Best score per task, last {data.points.length} tasks (IST dates).</figcaption>
      <table className="sr-only">
        <caption>Your scores over time</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Skill</th>
            <th scope="col">Score out of 10</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.date}</td>
              <td>{row.skill}</td>
              <td>{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
