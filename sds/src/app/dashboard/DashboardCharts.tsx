'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';

interface DataPoint {
  date: string;
  title: string;
  category: string;
  overall: number;
  components: number;
  scaling: number;
  reliability: number;
  tradeoffs: number;
}

interface DashboardChartsProps {
  data: DataPoint[];
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  // Average scores for radar
  const avgScores = {
    Components: Math.round(data.reduce((s, d) => s + d.components, 0) / data.length),
    Scaling: Math.round(data.reduce((s, d) => s + d.scaling, 0) / data.length),
    Reliability: Math.round(data.reduce((s, d) => s + d.reliability, 0) / data.length),
    'Trade-offs': Math.round(data.reduce((s, d) => s + d.tradeoffs, 0) / data.length),
  };

  const radarData = Object.entries(avgScores).map(([label, value]) => ({
    label,
    value,
    fullMark: 100,
  }));

  return (
    <div className="space-y-8">
      {/* Score over time */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-semibold">Score Over Time</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#9CA3AF' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="overall"
              stroke="#3B82F6"
              strokeWidth={2}
              name="Overall"
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="components"
              stroke="#10B981"
              strokeWidth={1}
              name="Components"
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="scaling"
              stroke="#F59E0B"
              strokeWidth={1}
              name="Scaling"
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="reliability"
              stroke="#EF4444"
              strokeWidth={1}
              name="Reliability"
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="tradeoffs"
              stroke="#8B5CF6"
              strokeWidth={1}
              name="Trade-offs"
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Average breakdown radar */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Average Breakdown</h2>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#6B7280', fontSize: 10 }} />
              <Radar dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Session history table */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Session History</h2>
          <div className="max-h-[250px] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Prompt</th>
                  <th className="pb-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-400">{d.date}</td>
                    <td className="py-2 text-gray-300">{d.title}</td>
                    <td className="py-2 text-right font-mono font-bold">{d.overall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
