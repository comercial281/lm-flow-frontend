import { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  'data-tour'?: string;
}

export const FormSection = ({
  title,
  description,
  children,
  className,
  'data-tour': dataTour,
}: FormSectionProps) => {
  return (
    <div
      className={`rounded-lg border bg-muted/30 p-4 ${className || ''}`}
      data-tour={dataTour}
    >
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-sidebar-foreground">{title}</h4>
        {description && (
          <p className="text-xs text-sidebar-foreground/70 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
};
