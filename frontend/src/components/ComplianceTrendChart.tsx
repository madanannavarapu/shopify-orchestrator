import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  Text,
  Spinner,
  Banner,
} from '@shopify/polaris';
import { api } from '../api/shopify';

type ScoreHistoryPoint = {
  date: string;
  score: number;
};

type Props = {
  title?: string;
  height?: number;
  showStats?: boolean;
};

export default function ComplianceTrendChart({
  title = "Compliance Trend",
  height = 300,
  showStats = true
}: Props) {
  const [data, setData] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchScoreHistory();
  }, []);

  const fetchScoreHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const [historyData, historyStats] = await Promise.all([
        api.compliance.getScoreHistory(),
        api.compliance.getScoreHistoryStats()
      ]);

      setData(historyData);
      setStats(historyStats);
    } catch (err) {
      console.error('Failed to fetch score history:', err);
      setError('Failed to load compliance trend data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Format dates for the chart
  const formattedData = data.map(point => ({
    ...point,
    date: new Date(point.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }));

  // Get trend color based on stats
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return '#1f7c4c'; // green
      case 'declining': return '#9e3939'; // red
      case 'stable': return '#666666'; // gray
      default: return '#c6c6c6'; // light gray for no data
    }
  };

  // Get trend message
  const getTrendMessage = (stats: any) => {
    if (!stats || stats.data_points === 0) return 'No data available';
    if (stats.trend === 'improving') return 'Improving compliance';
    if (stats.trend === 'declining') return 'Compliance declining';
    if (stats.trend === 'stable') return 'Compliance stable';
    return 'No trend data';
  };

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner accessibilityLabel="Loading compliance trend chart" />
          <Text as="p" tone="subdued" style={{ marginTop: '10px' }}>
            Loading compliance trend data...
          </Text>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Banner tone="critical" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Text as="h3" variant="headingMd">Compliance Trend</Text>
          <Text as="p" tone="subdued" style={{ marginTop: '10px' }}>
            No compliance score data available yet. Submit an assessment to see trends.
          </Text>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ padding: '20px' }}>
        {/* Header with title and stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px'
        }}>
          <div>
            <Text as="h3" variant="headingMd">{title}</Text>
            <Text as="p" tone="subdued" style={{ marginTop: '5px' }}>
              Last {data.length} days of compliance scores
            </Text>
          </div>

          {showStats && stats && (
            <div style={{ textAlign: 'right' }}>
              <Text as="bodySm" tone="subdued">Average: {stats.avg_score}</Text>
              <Text
                as="bodySm"
                tone={stats.trend === 'improving' ? 'success' : stats.trend === 'declining' ? 'critical' : 'subdued'}
              >
                Trend: {getTrendMessage(stats)}
              </Text>
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ width: '100%', height: height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedData}
              margin={{ top: 5, right: 30, left: 40, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                tickMargin={10}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickMargin={10}
                tickCount={5}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px'
                }}
                formatter={(value: number) => [`${value}`, 'Score']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke={stats ? getTrendColor(stats.trend) : '#c6c6c6'}
                strokeWidth={2}
                dot={{ fill: stats ? getTrendColor(stats.trend) : '#c6c6c6', r: 4 }}
                activeDot={{ r: 6, fill: stats ? getTrendColor(stats.trend) : '#c6c6c6' }}
                isAnimationActive={true}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Simple legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '30px',
          marginTop: '20px',
          fontSize: '12px',
          color: '#666'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#1f7c4c',
              borderRadius: '2px'
            }} />
            <span>1-100 Score</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#c6c6c6',
              borderRadius: '2px',
              opacity: stats && stats.data_points === 0 ? 1 : 0
            }} />
            <span style={{ opacity: stats && stats.data_points === 0 ? 1 : 0 }}>
              No data
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
