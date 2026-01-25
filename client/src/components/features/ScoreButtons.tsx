import { STOOL_SCORES, BEHAVIOR_SCORES } from '@lab-data-manager/shared';

interface ScoreButtonsProps {
  type: 'stool' | 'behavior';
  value: number | undefined;
  onChange: (value: number) => void;
}

export function ScoreButtons({ type, value, onChange }: ScoreButtonsProps) {
  const scores = type === 'stool' ? STOOL_SCORES : BEHAVIOR_SCORES;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {type === 'stool' ? 'Stool Score' : 'Behavior Score'}
      </label>
      <div className="flex gap-2">
        {Object.entries(scores).map(([score, info]) => {
          const numScore = parseInt(score);
          const isSelected = value === numScore;

          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(numScore)}
              className={`score-btn ${isSelected ? 'selected' : ''}`}
              title={info.description}
            >
              <div className="font-bold">{score}</div>
              <div className="text-xs mt-0.5">{info.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
