// Business/components/WebCompatibleCharts.js
import React from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { 
  LineChart, 
  BarChart, 
  PieChart 
} from 'react-native-chart-kit';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Chart configuration
const chartConfig = {
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
  // For web, we need to create a custom LineChart implementation
  if (isWeb) {
    return (
      <View style={styles.chartContainer}>
        {title && <Text style={styles.chartTitle}>{title}</Text>}
        <View style={styles.webChartPlaceholder}>
          <Text style={styles.webChartText}>
            {title || 'Line Chart'} - Web Version
          </Text>
          <Text style={styles.webChartLabels}>
            Labels: {data.labels?.join(', ') || 'No Data'}
          </Text>
          <View style={styles.webChartLine}>
            {data.datasets?.[0]?.data?.map((value, index) => (
              <View 
                key={index} 
                style={[styles.webChartBar, { height: Math.max(value * 0.5, 10) }]} 
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Mobile version using react-native-chart-kit
  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <LineChart
        data={data}
        width={width}
        height={height}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        withDots={true}
        withShadow={false}
        withInnerLines={true}
        withOuterLines={true}
        yAxisLabel={yAxisLabel}
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
  // For web, we need to create a custom BarChart implementation
  if (isWeb) {
    return (
      <View style={styles.chartContainer}>
        {title && <Text style={styles.chartTitle}>{title}</Text>}
        <View style={styles.webChartPlaceholder}>
          <Text style={styles.webChartText}>
            {title || 'Bar Chart'} - Web Version
          </Text>
          <Text style={styles.webChartLabels}>
            Labels: {data.labels?.join(', ') || 'No Data'}
          </Text>
          <View style={styles.webChartBars}>
            {data.datasets?.[0]?.data?.map((value, index) => (
              <View key={index} style={styles.webBarContainer}>
                <View 
                  style={[
                    styles.webChartBar, 
                    { height: Math.max(value * 0.5, 10) }
                  ]} 
                />
                <Text style={styles.webBarLabel}>
                  {data.labels?.[index]?.substring(0, 3) || ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Mobile version
  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <BarChart
        data={data}
        width={width}
        height={height}
        chartConfig={chartConfig}
        style={styles.chart}
        verticalLabelRotation={0}
        fromZero={true}
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
  // For web, we need to create a custom PieChart implementation
  if (isWeb) {
    return (
      <View style={styles.chartContainer}>
        {title && <Text style={styles.chartTitle}>{title}</Text>}
        <View style={styles.webChartPlaceholder}>
          <Text style={styles.webChartText}>
            {title || 'Pie Chart'} - Web Version
          </Text>
          <View style={styles.webPieContainer}>
            <View style={styles.webPieChart}>
              {data.map((item, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.webPieSegment, 
                    { 
                      backgroundColor: item.color,
                      width: `${Math.max((item.population / getTotalPopulation(data)) * 100, 5)}%`
                    }
                  ]} 
                />
              ))}
            </View>
          </View>
          {showLegend && (
            <View style={styles.webChartLegend}>
              {data.map((item, index) => (
                <View key={index} style={styles.webLegendItem}>
                  <View 
                    style={[
                      styles.webLegendColor, 
                      { backgroundColor: item.color }
                    ]} 
                  />
                  <Text style={styles.webLegendText}>
                    {item.name}: {item.population}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  }

  // Mobile version
  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <PieChart
        data={data}
        width={width}
        height={height}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
        style={styles.chart}
      />
    </View>
  );
};

// Multi-Line Chart for comparisons (simplified)
export const UniversalMultiLineChart = ({ 
  data, 
  width = screenWidth - 32, 
  height = 220, 
  title,
  lines = []
}) => {
  // For both web and mobile, we'll use a simplified version
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

// Helper function to calculate total for pie chart
const getTotalPopulation = (data) => {
  return data.reduce((sum, item) => sum + (item.population || 0), 0);
};

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    ...(Platform.OS !== 'web' ? {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    } : {
      borderWidth: 1,
      borderColor: '#e0e0e0',
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
  // Web-specific styles
  webChartPlaceholder: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
  },
  webChartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 8,
  },
  webChartLabels: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  webChartLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    width: '100%',
    justifyContent: 'space-around',
  },
  webChartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    width: '100%',
    justifyContent: 'space-around',
  },
  webBarContainer: {
    alignItems: 'center',
  },
  webChartBar: {
    width: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    marginHorizontal: 4,
  },
  webBarLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  webPieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  webPieChart: {
    flexDirection: 'row',
    height: 40,
    width: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  webPieSegment: {
    height: '100%',
  },
  webChartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  webLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 4,
  },
  webLegendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  webLegendText: {
    fontSize: 12,
    color: '#666',
  },
});

export default {
  UniversalLineChart,
  UniversalBarChart,
  UniversalPieChart,
  UniversalMultiLineChart,
  ChartWrapper
};