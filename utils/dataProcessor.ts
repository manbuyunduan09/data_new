
import { DataRow, ColumnType, ColumnMapping, MetricStats } from '../types';

export const identifyColumnTypes = (data: DataRow[]): ColumnMapping[] => {
  if (!data.length) return [];
  const firstRow = data[0];
  const keys = Object.keys(firstRow);

  return keys.map(key => {
    const val = firstRow[key];
    const isNum = !isNaN(Number(val)) && val !== '' && val !== null;
    // 检测是否为日期：字符串解析成功 或 Excel 数字序列号 (通常在 30000 到 60000 之间)
    const isDate = (typeof val === 'string' && !isNaN(Date.parse(val)) && isNaN(Number(val))) || 
                   (typeof val === 'number' && val > 30000 && val < 60000);

    let type = ColumnType.DIMENSION;
    if (isDate) type = ColumnType.TIME;
    else if (isNum) type = ColumnType.METRIC;

    return { name: key, type };
  });
};

const excelDateToJS = (serial: number): string => {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().split('T')[0];
};

export const cleanData = (data: DataRow[], mappings: ColumnMapping[]): DataRow[] => {
  return data.map(row => {
    const newRow = { ...row };
    mappings.forEach(map => {
      let val = row[map.name];
      if (map.type === ColumnType.METRIC) {
        newRow[map.name] = (val === undefined || val === null || val === '') ? 0 : Number(val);
      } else if (map.type === ColumnType.TIME) {
        if (typeof val === 'number' && val > 30000) {
          newRow[map.name] = excelDateToJS(val);
        } else {
          const d = new Date(val);
          newRow[map.name] = isNaN(d.getTime()) ? '未知日期' : d.toISOString().split('T')[0];
        }
      } else {
        newRow[map.name] = (val === undefined || val === null || val === '') ? '未知' : String(val);
      }
    });
    return newRow;
  });
};

export const applyFormulas = (data: DataRow[], formulasStr: string): DataRow[] => {
  if (!formulasStr.trim()) return data;
  const lines = formulasStr.split('\n').filter(l => l.includes('='));
  
  return data.map(row => {
    const newRow = { ...row };
    lines.forEach(line => {
      const parts = line.split('=');
      if (parts.length < 2) return;
      const target = parts[0].trim();
      const expr = parts[1].trim();
      let evaluatedExpr = expr;
      
      const colPattern = /\[(.*?)\]/g;
      let match;
      while ((match = colPattern.exec(expr)) !== null) {
        const colName = match[1];
        const val = Number(newRow[colName]) || 0;
        evaluatedExpr = evaluatedExpr.replace(`[${colName}]`, val.toString());
      }

      try {
        const result = eval(evaluatedExpr);
        newRow[target] = isNaN(result) ? 0 : Number(result.toFixed(2));
      } catch {
        newRow[target] = 0;
      }
    });
    return newRow;
  });
};

export const calculateMetricStats = (data: DataRow[], metricName: string): MetricStats => {
  const vals = data.map(r => Number(r[metricName])).filter(v => !isNaN(v)).sort((a, b) => a - b);
  if (!vals.length) return { name: metricName, mean: 0, median: 0, p75: 0, min: 0, max: 0, sum: 0 };

  const sum = vals.reduce((a, b) => a + b, 0);
  const mean = sum / vals.length;
  const median = vals[Math.floor(vals.length * 0.5)];
  const p75 = vals[Math.floor(vals.length * 0.75)];
  const min = vals[0];
  const max = vals[vals.length - 1];

  return { name: metricName, mean, median, p75, min, max, sum };
};
