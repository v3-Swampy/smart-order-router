import { log } from './log';

export enum MetricLoggerUnit {
  Seconds = 'Seconds',
  Microseconds = 'Microseconds',
  Milliseconds = 'Milliseconds',
  Bytes = 'Bytes',
  Kilobytes = 'Kilobytes',
  Megabytes = 'Megabytes',
  Gigabytes = 'Gigabytes',
  Terabytes = 'Terabytes',
  Bits = 'Bits',
  Kilobits = 'Kilobits',
  Megabits = 'Megabits',
  Gigabits = 'Gigabits',
  Terabits = 'Terabits',
  Percent = 'Percent',
  Count = 'Count',
  BytesPerSecond = 'Bytes/Second',
  KilobytesPerSecond = 'Kilobytes/Second',
  MegabytesPerSecond = 'Megabytes/Second',
  GigabytesPerSecond = 'Gigabytes/Second',
  TerabytesPerSecond = 'Terabytes/Second',
  BitsPerSecond = 'Bits/Second',
  KilobitsPerSecond = 'Kilobits/Second',
  MegabitsPerSecond = 'Megabits/Second',
  GigabitsPerSecond = 'Gigabits/Second',
  TerabitsPerSecond = 'Terabits/Second',
  CountPerSecond = 'Count/Second',
  None = 'None',
}

export abstract class IMetric {
  abstract setProperty(key: string, value: unknown): void;

  abstract putDimensions(dimensions: Record<string, string>): void;

  abstract putMetric(key: string, value: number, unit?: MetricLoggerUnit): void;
}

interface MetricContext {
  chainId: number;
  networkName: string;
}

export class MetricLogger extends IMetric {
  private fields: Record<string, unknown>;

  constructor(context?: MetricContext) {
    super();
    this.fields = { ...(context || {}) };
  }

  public setProperty(key: string, value: unknown): void {
    this.fields[key] = value;
  }

  public putDimensions(dimensions: Record<string, string>): void {
    Object.assign(this.fields, dimensions);
  }

  public putMetric(key: string, value: number, unit?: MetricLoggerUnit): void {
    log.info(
      { ...this.fields, key, value, unit },
      `[Metric]: ${key}: ${value} | ${unit ? unit : ''}`
    );
  }
}

export let metric: IMetric = new MetricLogger();

export const setGlobalMetric = (_metric: IMetric) => {
  metric = _metric;
};
