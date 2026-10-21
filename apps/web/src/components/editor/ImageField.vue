<script setup lang="ts">
import { IMAGE_MIME_TYPES, LIMITS } from '@quiz/shared';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiError } from '@/api/client';
import { mediaApi } from '@/api/quizzes';

const model = defineModel<string>({ required: true });
const props = withDefaults(defineProps<{ label: string; error?: string; compact?: boolean }>(), {
  error: '',
  compact: false,
});
const { t } = useI18n();

const fileInput = ref<HTMLInputElement>();
const uploading = ref(false);
const uploadError = ref('');
const maxMb = LIMITS.imageMaxBytes / (1024 * 1024);

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  uploadError.value = '';
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    uploadError.value = t('image.wrongType');
    return;
  }
  if (file.size > LIMITS.imageMaxBytes) {
    uploadError.value = t('image.tooLarge', { mb: maxMb });
    return;
  }
  uploading.value = true;
  try {
    model.value = (await mediaApi.uploadImage(file)).url;
  } catch (error) {
    uploadError.value =
      error instanceof ApiError && error.isNetworkError ? t('common.networkError') : t('image.failed');
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div>
    <span v-if="!props.compact" class="label">{{ props.label }}</span>
    <div class="flex items-start gap-3">
      <div
        class="grid shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950"
        :class="props.compact ? 'h-12 w-12' : 'h-24 w-32'"
      >
        <img v-if="model" :src="model" :alt="props.label" class="h-full w-full object-contain" />
        <span v-else class="text-2xl text-slate-300" aria-hidden="true">🖼</span>
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-secondary" :disabled="uploading" @click="fileInput?.click()">
            {{ uploading ? t('image.uploading') : model ? t('image.replace') : t('image.upload') }}
          </button>
          <button v-if="model" type="button" class="btn-danger" @click="model = ''">{{ t('image.remove') }}</button>
        </div>
        <input
          v-if="!props.compact"
          v-model.trim="model"
          type="url"
          class="input text-sm"
          :class="{ 'input-error': props.error }"
          :placeholder="t('image.urlPlaceholder')"
          :aria-label="props.label"
        />
      </div>
    </div>
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="IMAGE_MIME_TYPES.join(',')"
      :aria-label="props.label"
      @change="onFile"
    />
    <p v-if="uploadError || props.error" class="field-error">{{ uploadError || props.error }}</p>
  </div>
</template>
