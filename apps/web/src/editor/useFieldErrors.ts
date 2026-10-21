import { useI18n } from 'vue-i18n';
import { useEditorStore } from '@/stores/editor';

/** Translated validation message for a draft path, once errors are being shown. */
export function useFieldErrors() {
  const editor = useEditorStore();
  const { t } = useI18n();

  function fieldError(path: string): string {
    if (!editor.showErrors) return '';
    const issue = editor.errors.get(path);
    return issue ? t(`validation.${issue.key}`, issue.params ?? {}) : '';
  }

  return { fieldError };
}
