/**
 * Admin Chart Components
 * 
 * Custom chart components using recharts for admin dashboard.
 * Styled to match LibreChat design system with blue primary theme.
 */
import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// Chart colors that work in both light and dark themes
// Using actual color values since CSS variables don't work well in SVG
const CHART_COLORS = {
  primary: '#3b82f6', // Blue-500
  primaryDark: '#2563eb', // Blue-600
  secondary: '#6b7280', // Gray-500
  tertiary: '#9ca3af', // Gray-400
  success: '#22c55e', // Green-500
  warning: '#eab308', // Yellow-500
  danger: '#ef4444', // Red-500
  info: '#3b82f6', // Blue-500
  purple: '#8b5cf6', // Purple-500
  pink: '#ec4899', // Pink-500
  teal: '#14b8a6', // Teal-500
  orange: '#f97316', // Orange-500
  // These will be used for grid lines - slightly transparent
  surface: 'rgba(107, 114, 128, 0.1)',
  border: 'rgba(107, 114, 128, 0.2)',
  grid: 'rgba(107, 114, 128, 0.15)',
};

// Pie chart color palette
const PIE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (value: number) => string;
}

const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border-light bg-surface-primary p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-text-primary">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-text-secondary">{entry.name}:</span>
          <span className="text-xs font-medium text-text-primary">
            {formatter ? formatter(entry.value) : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// Area Chart Component
interface AreaChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface AdminAreaChartProps {
  data: AreaChartData[];
  dataKey?: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  gradient?: boolean;
  formatter?: (value: number) => string;
}

export const AdminAreaChart: React.FC<AdminAreaChartProps> = ({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  height = 200,
  color = CHART_COLORS.primary,
  gradient = true,
  formatter,
}) => {
  const gradientId = `gradient-${dataKey}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {gradient && (
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey={xAxisKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
          tickFormatter={(value) => (formatter ? formatter(value) : value.toLocaleString())}
        />
        <Tooltip content={<ChartTooltip formatter={formatter} />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={gradient ? `url(#${gradientId})` : color}
          fillOpacity={gradient ? 1 : 0.1}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// Bar Chart Component
interface AdminBarChartProps {
  data: AreaChartData[];
  dataKey?: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  formatter?: (value: number) => string;
  horizontal?: boolean;
}

export const AdminBarChart: React.FC<AdminBarChartProps> = ({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  height = 200,
  color = CHART_COLORS.primary,
  formatter,
  horizontal = false,
}) => {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey={xAxisKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
            width={100}
          />
          <Tooltip content={<ChartTooltip formatter={formatter} />} />
          <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey={xAxisKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
          tickFormatter={(value) => (formatter ? formatter(value) : value.toLocaleString())}
        />
        <Tooltip content={<ChartTooltip formatter={formatter} />} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Multi-series Bar Chart
interface MultiBarChartData {
  name: string;
  [key: string]: string | number;
}

interface AdminMultiBarChartProps {
  data: MultiBarChartData[];
  dataKeys: { key: string; color: string; name: string }[];
  xAxisKey?: string;
  height?: number;
  formatter?: (value: number) => string;
  stacked?: boolean;
}

export const AdminMultiBarChart: React.FC<AdminMultiBarChartProps> = ({
  data,
  dataKeys,
  xAxisKey = 'name',
  height = 200,
  formatter,
  stacked = false,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey={xAxisKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
          tickFormatter={(value) => (formatter ? formatter(value) : value.toLocaleString())}
        />
        <Tooltip content={<ChartTooltip formatter={formatter} />} />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
          formatter={(value) => <span className="text-text-secondary">{value}</span>}
        />
        {dataKeys.map((dk) => (
          <Bar
            key={dk.key}
            dataKey={dk.key}
            name={dk.name}
            fill={dk.color}
            radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// Line Chart Component
interface AdminLineChartProps {
  data: AreaChartData[];
  dataKey?: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  formatter?: (value: number) => string;
}

export const AdminLineChart: React.FC<AdminLineChartProps> = ({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  height = 200,
  color = CHART_COLORS.primary,
  formatter,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey={xAxisKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: CHART_COLORS.secondary, fontSize: 11 }}
          tickFormatter={(value) => (formatter ? formatter(value) : value.toLocaleString())}
        />
        <Tooltip content={<ChartTooltip formatter={formatter} />} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// Donut/Pie Chart Component
interface PieChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface AdminPieChartProps {
  data: PieChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  formatter?: (value: number) => string;
  showLegend?: boolean;
  colors?: string[];
}

export const AdminPieChart: React.FC<AdminPieChartProps> = ({
  data,
  height = 200,
  innerRadius = 50,
  outerRadius = 80,
  formatter,
  showLegend = true,
  colors = PIE_COLORS,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const data = payload[0];
            return (
              <div className="rounded-lg border border-border-light bg-surface-primary p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: data.payload.fill }}
                  />
                  <span className="text-xs text-text-secondary">{data.name}:</span>
                  <span className="text-xs font-medium text-text-primary">
                    {formatter ? formatter(data.value as number) : (data.value as number).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          }}
        />
        {showLegend && (
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
            formatter={(value) => <span className="text-text-secondary">{value}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
};

// Progress Ring Component (for percentages)
interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 120,
  strokeWidth = 8,
  color = CHART_COLORS.primary,
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-tertiary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-text-primary">{Math.round(value)}%</span>
        {label && <span className="text-xs text-text-secondary">{label}</span>}
      </div>
    </div>
  );
};

export { CHART_COLORS, PIE_COLORS };
