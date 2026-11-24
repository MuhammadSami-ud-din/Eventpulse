import axios from 'axios';

export const isAbortError = (error) => axios.isCancel(error);

export function errorCode(error) {
  return error?.response?.data?.error?.code ?? null;
}

export function errorMessage(error, fallback = 'Something went wrong, please try again') {
  if (error?.response) return error.response.data?.error?.message ?? fallback;
  if (error?.request) return 'Cannot reach the server. Check your connection and try again.';
  return fallback;
}

// Turns the server's validation details into { field: message } for forms,
// keeping the first message when a field has several. A problem inside a
// list ("agenda.1.time") is shown on the list, naming the item ("Item 2: …").
export function fieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  const errors = {};
  for (const { field, message } of details) {
    const [name, index] = field.split('.');
    errors[name] ??= index === undefined ? message : `Item ${Number(index) + 1}: ${message}`;
  }
  return errors;
}
