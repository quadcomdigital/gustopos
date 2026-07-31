export interface FieldError {
  message: string;
}

export function required(value: string, label: string): FieldError | undefined {
  if (!value.trim()) return { message: `${label} obbligatorio` };
  return undefined;
}

export function minLength(value: string, min: number, _label: string): FieldError | undefined {
  if (value.trim().length > 0 && value.trim().length < min) {
    return { message: `Min. ${min} caratteri` };
  }
  return undefined;
}

export function minNumber(value: string, min: number, _label: string): FieldError | undefined {
  const n = Number(value);
  if (value !== '' && (!Number.isFinite(n) || n < min)) {
    return { message: `Min. ${min}` };
  }
  return undefined;
}

export function positiveNumber(value: string, label: string): FieldError | undefined {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n) || n <= 0) {
    return { message: `${label} deve essere > 0` };
  }
  return undefined;
}

export function validNumber(value: string): FieldError | undefined {
  if (value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return { message: 'Numero non valido' };
  return undefined;
}

export type ValidationErrors = Record<string, FieldError | undefined>;

export function getErrorClass(error: FieldError | undefined): string {
  return error ? 'border-danger ring-1 ring-danger/30' : '';
}
