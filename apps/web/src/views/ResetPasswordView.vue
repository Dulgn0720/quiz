<script setup lang="ts">
import { AUTH_LIMITS } from '@quiz/shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import Mascot from '@/components/Mascot.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ token: string }>();

const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const password = ref('');
const confirm = ref('');
const busy = ref(false);
const message = ref('');

const mismatch = computed(() => confirm.value.length > 0 && confirm.value !== password.value);
const valid = computed(() => password.value.length >= AUTH_LIMITS.passwordMin && password.value === confirm.value);

async function submit(): Promise<void> {
  if (!valid.value || busy.value) return;
  busy.value = true;
  message.value = '';
  try {
    await auth.resetPassword(props.token, password.value);
    toast.success(t('auth.resetDone'));
    await router.replace('/me');
  } catch (error) {
    message.value =
      error instanceof ApiError && error.status === 400
        ? t('auth.resetInvalid')
        : error instanceof ApiError && error.isNetworkError
          ? t('common.networkError')
          : t('common.error');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-md flex-col justify-center px-4 py-10">
    <div v-if="!token" class="card flex flex-col items-center gap-3 p-8 text-center" role="alert">
      <Mascot mood="sad" :size="110" />
      <p class="font-bold">{{ t('auth.resetInvalid') }}</p>
      <RouterLink to="/forgot-password" class="btn-primary">{{ t('auth.sendResetLink') }}</RouterLink>
    </div>
    <form v-else class="card flex flex-col gap-4 p-6" @submit.prevent="submit">
      <h1 class="text-center text-3xl font-bold">{{ t('auth.resetTitle') }}</h1>
      <label class="block">
        <span class="label">{{ t('auth.newPassword') }}</span>
        <input
          v-model="password"
          type="password"
          class="input"
          autocomplete="new-password"
          :minlength="AUTH_LIMITS.passwordMin"
          :maxlength="AUTH_LIMITS.passwordMax"
          required
        />
        <span class="mt-1 block text-sm text-slate-500 dark:text-slate-400">{{ t('auth.passwordHint', { n: AUTH_LIMITS.passwordMin }) }}</span>
      </label>
      <label class="block">
        <span class="label">{{ t('auth.confirmPassword') }}</span>
        <input v-model="confirm" type="password" class="input" :class="{ 'input-error': mismatch }" autocomplete="new-password" required />
        <span v-if="mismatch" class="field-error block">{{ t('auth.passwordMismatch') }}</span>
      </label>
      <p v-if="message" class="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
        {{ message }}
        <RouterLink to="/forgot-password" class="ml-1 underline">{{ t('auth.sendResetLink') }}</RouterLink>
      </p>
      <button type="submit" class="btn-primary py-3 text-base" :disabled="!valid || busy">
        {{ busy ? t('common.loading') : t('auth.resetSubmit') }}
      </button>
    </form>
  </section>
</template>
