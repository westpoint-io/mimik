import { i18n } from '@mimik/core/env';
import { Input } from '../../components/ui/input';

interface TranscriptionModelFieldProps {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
}

export function TranscriptionModelField({ value, onChange, inputClassName }: TranscriptionModelFieldProps) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-foreground mb-1">
        {i18n.t('settings.transcriptionModel')}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="whisper-1"
        aria-label={i18n.t('settings.transcriptionModel')}
        className={inputClassName}
      />
    </div>
  );
}
