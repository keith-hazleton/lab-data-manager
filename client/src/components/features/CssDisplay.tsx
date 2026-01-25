import { getCssSeverity, CSS_SEVERITY_LEVELS } from '@lab-data-manager/shared';

interface CssDisplayProps {
  weightScore: number | null;
  stoolScore: number | undefined;
  behaviorScore: number | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function CssDisplay({ weightScore, stoolScore, behaviorScore, size = 'md' }: CssDisplayProps) {
  const hasAllScores = weightScore !== null && stoolScore !== undefined && behaviorScore !== undefined;
  const totalCss = hasAllScores ? weightScore + stoolScore + behaviorScore : null;
  const severity = totalCss !== null ? getCssSeverity(totalCss) : null;
  const severityInfo = severity ? CSS_SEVERITY_LEVELS[severity] : null;

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const colorClasses = {
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50',
    darkred: 'text-red-900 bg-red-100',
  };

  if (totalCss === null) {
    return (
      <div className="text-center">
        <div className={`${sizeClasses[size]} font-bold text-gray-400`}>--</div>
        <div className="text-sm text-gray-500">CSS Score</div>
      </div>
    );
  }

  return (
    <div
      className={`text-center p-3 rounded-lg ${
        severityInfo ? colorClasses[severityInfo.color as keyof typeof colorClasses] : ''
      }`}
    >
      <div className={`${sizeClasses[size]} font-bold`}>{totalCss}</div>
      <div className="text-sm font-medium">{severityInfo?.label || 'CSS Score'}</div>
      <div className="text-xs mt-1 opacity-75">
        W:{weightScore} + S:{stoolScore} + B:{behaviorScore}
      </div>
    </div>
  );
}
