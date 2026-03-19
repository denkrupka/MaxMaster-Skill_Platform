type VariableLike = {
  key: string;
  required?: boolean;
  source?: string;
};

type TemplateVariableLike = VariableLike & {
  label?: string;
  type?: string;
};

type TemplateSectionLike = {
  title?: string;
  body?: string;
};

const isBlank = (value: unknown) => String(value ?? '').trim().length === 0;
const MANUAL_SOURCE = 'manual';

export function getTemplateValidationErrors(input: {
  name: string;
  sections: TemplateSectionLike[];
  variables: TemplateVariableLike[];
}): string[] {
  const errors: string[] = [];

  if (isBlank(input.name)) {
    errors.push('Nazwa jest wymagana');
  }

  const hasSectionWithBody = input.sections.some((section) => !isBlank(section.body));
  if (!hasSectionWithBody) {
    errors.push('Dodaj przynajmniej jedną sekcję z treścią');
  }

  input.variables.forEach((variable, index) => {
    if (isBlank(variable.key)) {
      errors.push(`Zmienna #${index + 1} musi mieć klucz`);
    }
  });

  return errors;
}

export function getDocumentWizardStep1Errors(input: { templateId: string }): string[] {
  return isBlank(input.templateId) ? ['Wybierz szablon'] : [];
}

export function getDocumentWizardStep2Errors(
  variables: VariableLike[],
  formData: Record<string, string>,
): string[] {
  return variables
    .filter((variable) => variable.required && (variable.source ?? MANUAL_SOURCE) === MANUAL_SOURCE)
    .filter((variable) => isBlank(formData[variable.key]))
    .map((variable) => `Uzupełnij pole: ${variable.key}`);
}

export function getSignerValidationErrors(input: { name: string; email: string }): string[] {
  const errors: string[] = [];
  const email = input.email.trim();

  if (isBlank(input.name)) {
    errors.push('Imię i nazwisko jest wymagane');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Podaj poprawny adres email');
  }

  return errors;
}
