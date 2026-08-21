import type { ReactNode } from "react";
import {
  Field,
  FieldGroup,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@aloysius-g1/ui/components/field";
import { Input } from "@aloysius-g1/ui/components/input";
import { Textarea } from "@aloysius-g1/ui/components/textarea";
import { Button } from "@aloysius-g1/ui/components/button";
import { useFieldContext, useFormContext } from "@/lib/form-context";

export function AppTextField({
  label,
  description,
  placeholder,
  type = "text",
  ...inputProps
}: {
  label: string;
  description?: string;
  placeholder?: string;
  type?: string;
} & Omit<React.ComponentProps<"input">, "children">) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={isInvalid}
        {...inputProps}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

export function AppTextareaField({
  label,
  description,
  placeholder,
  rows = 4,
  ...textareaProps
}: {
  label: string;
  description?: string;
  placeholder?: string;
  rows?: number;
} & Omit<React.ComponentProps<"textarea">, "children">) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Textarea
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={isInvalid}
        {...textareaProps}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

export function AppSelectField({
  label,
  description,
  placeholder,
  options,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  placeholder?: string;
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <select
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => {
          field.handleChange(e.target.value);
          onValueChange?.(e.target.value);
        }}
        aria-invalid={isInvalid}
        className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

export function AppCheckboxField({
  label,
  description,
}: {
  label: ReactNode;
  description?: string;
}) {
  const field = useFieldContext<boolean>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field orientation="horizontal" data-invalid={isInvalid}>
      <input
        id={field.name}
        name={field.name}
        type="checkbox"
        checked={field.state.value}
        onChange={(e) => field.handleChange(e.target.checked)}
        onBlur={field.handleBlur}
        className="peer relative size-4 shrink-0 rounded-[4px] border border-input accent-primary"
        aria-invalid={isInvalid}
      />
      <FieldContent>
        <FieldLabel htmlFor={field.name} className="font-normal">
          {label}
        </FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

export function AppSubmitButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const form = useFormContext();
  return (
    <form.Subscribe
      selector={(state) => ({
        canSubmit: state.canSubmit,
        isSubmitting: state.isSubmitting,
      })}
    >
      {({ canSubmit, isSubmitting }) => (
        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className={className}
        >
          {isSubmitting ? "Submitting..." : children}
        </Button>
      )}
    </form.Subscribe>
  );
}

export { Field, FieldGroup };
