export interface SelectOption<TValue = string> {
  label: string;
  value: TValue;
  disabled?: boolean;
}