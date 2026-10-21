<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import Mascot from '@/components/Mascot.vue';

const { t } = useI18n();
const email = ref('');
const busy = ref(false);
const sent = ref(false);
const message = ref('');

async function submit(): Promise<void> {
  if (busy.value || !email.value.includes('@')) return;
  busy.value = true;
  message.value = '';
  try {
    await authApi.forgotPassword(email.value);
    sent.value = true;
  } catch (error) {
    message.value =
      error instanceof ApiError && error.status === 429
        ? t('game.errors.rate_limited')
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
    <div v-if="sent" class="card flex flex-col items-center gap-3 p-8 text-center" role="status">
      <Mascot mood="happy" :size="120" />
      <h1 class="text-2xl font-bold">{{ t('auth.resetSentTitle') }}</h1>
      <p class="text-slate-600 dark:text-slate-300">{{ t('auth.resetSent', { email }) }}</p>
      <RouterLink to="/login" class="btn-secondary mt-2">{{ t('auth.backToLogin') }}</RouterLink>
    </div>
    <form v-else class="card flex flex-col gap-4 p-6" @submit.prevent="submit">
      <div class="flex justify-center"><Mascot mood="thinking" :size="110" /></div>
      <h1 class="text-center text-3xl font-bold">{{ t('auth.forgotTitle') }}</h1>
      <p class="text-center text-sm text-slate-600 dark:text-slate-300">{{ t('auth.forgotHelp') }}</p>
      <label class="block">
        <span class="label">{{ t('auth.email') }}</span>
        <input v-model="email" type="email" class="input" autocomplete="email" required />
      </label>
      <p v-if="message" class="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{{ message }}</p>
      <button type="submit" class="btn-primary py-3 text-base" :disabled="busy || !email.includes('@')">
        {{ busy ? t('common.loading') : t('auth.sendResetLink') }}
      </button>
      <RouterLink to="/login" class="text-center text-sm font-bold text-brand-700 underline dark:text-brand-300">{{ t('auth.backToLogin') }}</RouterLink>
    </form>
  </section>
</template>
