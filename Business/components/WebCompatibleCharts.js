// Business/components/WebCompatibleCharts.js - Universal Charts for Web & Mobile
import React from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { 
  LineChart as RNLineChart, 
  BarChart as RNBarChart, 
  PieChart as RNPieChart 
} from 'react-native-chart-kit';
import { 
  LineChart, 
  BarChart, 
  PieChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Web-compatible chart configuration
const webChartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: '#4CAF50',
  },
};

// Mobile chart configuration
const mobileChartConfig = {
  ...webChartConfig,
  propsForLabels: {
    fontSize: 12,
  },
};

// Color palette for charts
const chartColors = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', 
  '#F44336', '#00BCD4', '#8BC34A', '#FFC107'
];

// Universal Line Chart Component
export const UniversalLineChart = ({ 
  data, 
  width = screenWidth - 32, 
  height = 220, 
  title,
  yAxisLabel = '',
  showGrid = true,
  showTooltip = true 
}) => {
  if (isWeb) {
    // Web version using Recharts
    const processedData = data.labels?.map((label, index) => ({
      name: label,
      value: data.datasets?.[0]?.data?.[index] || 0,
    })) || [];

    return (
      <View style={styles.chartContainer}>
        {title && <Text style={styles.chartTitle}>{title}</Text>}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={processedData}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: '#666' }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#666' }}
              axisLine={{ stroke: '#e0e0e0' }}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            />
            {showTooltip && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
            )}
            <LineChart.Line 
              type="monotone" 
              dataKey="value" 
              stroke="#4CAF50" 
              strokeWidth={3}
              dot={{ fill: '#4CAF50', strokeWidth: 2, r: 6 }}
              activeDot={{ r: 8, fill: '#4CAF50' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </View>
    );
  }

  // Mobile version using react-native-chart-kit
  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <RNLineChart
        data={data}
        width={width}
        height={height}
        chartConfig={mobileChartConfig}
        bezier
        style={styles.chart}
        withDots={true}
        withShadow={false}
        withInnerLines={true}
        withOuterLines={true}
        fromZero={true}
      />
    </View>
  );
};

// Universal Bar Chart Component
export const UniversalBarChart = ({ 
  data, 
  width = screenWidth - 32, 
  height = 220, 
  title,
  showGrid = true,
  showTooltip = true 
}) => {
  if (isWeb) {
    // Web version using Recharts
    const processedData = data.labels?.map((label, index) => ({
      name: label,
      value: data.datasets?.[0]?.data?.[index] || 0,
    })) || [];

    return (
      <View style={styles.chartContainer}>
        {title && <Text style={styles.chartTitle}>{title}</Text>}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={processedData}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: '#666' }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#666' }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            {showTooltip && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
            )}
            <BarChart.Bar 
              dataKey="value" 
              fill="#4CAF50"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </View>
    );
  }

  // Mobile version
  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <RNBarChart
        data={data}
        width={width}
        height={height}
        chartConfig={mobileChartConfig}
        style={styles.chart}
        verticalLabelRotation={0}
      />
    </View>
  );
};

// Universal Pie Chart Component
export const UniversalPieChart = ({ 
  data, 
  width = screenWidth - 32, 
  height = 220, 
  title,
  showLegend = true 
}) => {
  if (isWeb) {
    // Web version using Recharts
    const processedData = data.map((item, index) => ({
      name: item.name,
      value: item.population || item.value,
      color: item.color || chartColors[index % chartColors.length]
    }));

    return (
      <View style={styles.chartContainer}>
        {title && <Text style={styles.chartTitle}>{title}</Text>}
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <PieChart.Pie
              data={processedData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </PieChart.Pie>
            {showLegend && <Legend />}
            <Tooltip 
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </View>
    );
  }

  // Mobile version
  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <RNPieChart
        data={data}
        width={width}
        height={height}
        chartConfig={mobileChartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        style={styles.chart}
      />
    </View>
  );
};

// Multi-Line Chart for comparisons
export const UniversalMultiLineChart = ({ 
  data, 
  width = screenWidth - 32, 
  height = 220, 
  title,
  lines = []
}) => {
  if (isWeb) {
    const processedData = data.labels?.map((label, index) => {
      const point = { name: label };
      lines.forEach((line, lineIndex) => {
        point[line.key] = data.datasets?.[lineIndex]?.data?.[index] || 0;
      });
      return point;
    }) || [];

    return (
      <View style={styles.chartContainer}>
        {title && <Text style={styles.chartTitle}>{title}</Text>}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={processedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: '#666' }}
            />
            <YAxis tick={{ fontSize: 12, fill: '#666' }} />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {lines.map((line, index) => (
              <LineChart.Line 
                key={line.key}
                type="monotone" 
                dataKey={line.key} 
                stroke={line.color || chartColors[index]}
                strokeWidth={2}
                dot={{ r: 4 }}
                name={line.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </View>
    );
  }

  // For mobile, fallback to single line or create custom component
  return (
    <UniversalLineChart 
      data={data} 
      width={width} 
      height={height} 
      title={title} 
    />
  );
};

// Area Chart Component
export const UniversalAreaChart = ({ 
  data, 
  width = screenWidth - 32, 
  height = 220, 
  title 
}) => {
  if (isWeb) {
    const processedData = data.labels?.map((label, index) => ({
      name: label,
      value: data.datasets?.[0]?.data?.[index] || 0,
    })) || [];

    return (
      <View style={styles.chartContainer}>
        {title && <Text style={styles.chartTitle}>{title}</Text>}
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={processedData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#4CAF50" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#666' }} />
            <YAxis tick={{ fontSize: 12, fill: '#666' }} />
            <Tooltip />
            <AreaChart.Area 
              type="monotone" 
              dataKey="value" 
              stroke="#4CAF50" 
              fillOpacity={1} 
              fill="url(#colorValue)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </View>
    );
  }

  // Fallback to line chart for mobile
  return (
    <UniversalLineChart 
      data={data} 
      width={width} 
      height={height} 
      title={title} 
    />
  );
};

// Chart wrapper with error handling
export const ChartWrapper = ({ children, fallback }) => {
  return (
    <View style={styles.wrapper}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    } : {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 12,
  },
  wrapper: {
    flex: 1,
  },
});

export default {
  UniversalLineChart,
  UniversalBarChart,
  UniversalPieChart,
  UniversalMultiLineChart,
  UniversalAreaChart,
  ChartWrapper
};