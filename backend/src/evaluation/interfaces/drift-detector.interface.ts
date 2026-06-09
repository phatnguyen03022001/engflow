/* @lifecycle ACTIVE — Drift detection TypeScript interfaces and types */

export enum DetectorType {
  STRUCTURE = 'STRUCTURE',
  POLICY = 'POLICY',
  API_CONTRACT = 'API_CONTRACT',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface DriftDetectionResult {
  detectorType: DetectorType;
  severity: Severity;
  title: string;
  description: string;
  sourcePath?: string;
  expectedValue?: string;
  actualValue?: string;
}

export interface DriftEventQuery {
  detectorType?: DetectorType;
  severity?: Severity;
  isResolved?: boolean;
  skip?: number;
  take?: number;
}

export interface DriftEventResponse {
  id: string;
  detectorType: DetectorType;
  severity: Severity;
  title: string;
  description: string;
  sourcePath: string | null;
  expectedValue: string | null;
  actualValue: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  detectedAt: string;
  createdAt: string;
  updatedAt: string;
}
