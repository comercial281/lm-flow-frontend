import { Checkbox } from '@/components/ui/ds';

interface FormCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export const FormCheckbox = ({
  label,
  checked,
  onChange,
  className,
}: FormCheckboxProps) => {
  return (
    <label className={`flex items-center gap-2 text-sm text-sidebar-foreground/80 select-none ${className || ''}`}>
      <Checkbox
        checked={checked}
        onCheckedChange={v => onChange(v === true)}
      />
      <span>{label}</span>
    </label>
  );
};
