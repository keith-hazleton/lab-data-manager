import type { EndpointAlert, CssOperator } from '@lab-data-manager/shared';

export interface EndpointCheckParams {
  weightPctChange: number | null;
  totalCss: number | null;
  endpointWeightLossPct: number;
  endpointCssThreshold: number | null;
  endpointCssOperator: CssOperator | null;
}

export function checkEndpointAlerts(params: EndpointCheckParams): EndpointAlert[] {
  const alerts: EndpointAlert[] = [];

  // Check weight loss endpoint
  if (params.weightPctChange !== null) {
    const weightLoss = Math.abs(params.weightPctChange);

    if (params.weightPctChange < 0 && weightLoss >= params.endpointWeightLossPct) {
      alerts.push({
        type: 'weight_loss',
        severity: 'critical',
        message: `Weight loss of ${weightLoss.toFixed(1)}% exceeds endpoint threshold of ${params.endpointWeightLossPct}%`,
        value: weightLoss,
        threshold: params.endpointWeightLossPct,
      });
    } else if (params.weightPctChange < 0 && weightLoss >= params.endpointWeightLossPct - 5) {
      alerts.push({
        type: 'weight_loss',
        severity: 'warning',
        message: `Weight loss of ${weightLoss.toFixed(1)}% approaching endpoint threshold of ${params.endpointWeightLossPct}%`,
        value: weightLoss,
        threshold: params.endpointWeightLossPct,
      });
    }
  }

  // Check CSS threshold endpoint
  if (
    params.totalCss !== null &&
    params.endpointCssThreshold !== null &&
    params.endpointCssOperator !== null
  ) {
    const meetsThreshold = evaluateCssThreshold(
      params.totalCss,
      params.endpointCssThreshold,
      params.endpointCssOperator
    );

    if (meetsThreshold) {
      alerts.push({
        type: 'css_threshold',
        severity: 'critical',
        message: `CSS score of ${params.totalCss} ${params.endpointCssOperator} ${params.endpointCssThreshold} meets endpoint criteria`,
        value: params.totalCss,
        threshold: params.endpointCssThreshold,
      });
    } else if (params.totalCss >= params.endpointCssThreshold - 2) {
      alerts.push({
        type: 'css_threshold',
        severity: 'warning',
        message: `CSS score of ${params.totalCss} approaching endpoint threshold of ${params.endpointCssThreshold}`,
        value: params.totalCss,
        threshold: params.endpointCssThreshold,
      });
    }
  }

  return alerts;
}

function evaluateCssThreshold(
  value: number,
  threshold: number,
  operator: CssOperator
): boolean {
  switch (operator) {
    case '>=':
      return value >= threshold;
    case '>':
      return value > threshold;
    case '=':
      return value === threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    default:
      return false;
  }
}

export function getAlertSummary(alerts: EndpointAlert[]): {
  hasCritical: boolean;
  hasWarning: boolean;
  criticalCount: number;
  warningCount: number;
} {
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  return {
    hasCritical: criticalAlerts.length > 0,
    hasWarning: warningAlerts.length > 0,
    criticalCount: criticalAlerts.length,
    warningCount: warningAlerts.length,
  };
}
