import { ref } from 'vue';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

const toasts = ref<Toast[]>([]);
let nextId = 1;

export function useToast() {
  function show(message: string, tone: Toast['tone'] = 'info', durationMs = 3500): void {
    const id = nextId++;
    toasts.value.push({ id, message, tone });
    setTimeout(() => dismiss(id), durationMs);
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error', 6000),
    info: (message: string) => show(message, 'info'),
  };
}
