import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "@/lib/form-context";
import {
  AppTextField,
  AppTextareaField,
  AppSelectField,
  AppCheckboxField,
  AppSubmitButton,
} from "@/components/form-fields";

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField: AppTextField,
    TextareaField: AppTextareaField,
    SelectField: AppSelectField,
    CheckboxField: AppCheckboxField,
  },
  formComponents: {
    SubmitButton: AppSubmitButton,
  },
});
