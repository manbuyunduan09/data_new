
export interface DataRow {
  [key: string]: any;
}

export enum ColumnType {
  TIME = 'TIME',
  METRIC = 'METRIC',
  DIMENSION = 'DIMENSION'
}

export interface ColumnMapping {
  name: string;
  type: ColumnType;
}

export interface DashboardConfig {
  xAxisColumn: string; 
  metrics: string[];   
  groupColumn: string; 
  formulas: string;
}

export interface FilterState {
  dateRange: [string, string];
  dimensionFilters: { [key: string]: string[] };
}

export interface ChartMeta {
  id: string;
  type: 'line' | 'bar' | 'funnel' | 'pie' | 'area' | 'table' | 'waterfall' | 'boxplot' | 'ranking' | 'metric_card';
  title: string;
  // 保存创建时的配置快照，确保锁定后不随全局配置改变
  configSnapshot: DashboardConfig;
  isLocked: boolean;
  isSaved: boolean;
  descriptionType: 'trend' | 'structure' | 'ranking' | 'funnel';
}

export interface MetricStats {
  name: string;
  mean: number;
  median: number;
  p75: number;
  min: number;
  max: number;
  sum: number;
}
