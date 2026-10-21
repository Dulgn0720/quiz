<script setup lang="ts">
import { AUTH_LIMITS } from '@quiz/shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ mode: 'login' | 'register' }>();

const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const displayName = ref('');
const busy = ref(false);
const message = ref('');

const isRegister = computed(() => props.mode === 'register');
const valid = computed(
  () =>
    email.value.includes('@') &&
    password.value.length >= (isRegister.value ? AUTH_LIMITS.passwordMin : 1) &&
    (!isRegister.value || displayName.value.trim().length > 0),
);

async function submit(): Promise<void> {
  if (!valid.value || busy.value) return;
  busy.value = true;
  message.value = '';
  try {
    if (isRegister.value) {
      await auth.register({ email: email.value, password: password.value, displayName: displayName.value });
    } else {
      await auth.login({ email: email.value, password: password.value });
    }
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/me';
    await router.replace(redirect);
  } catch (error) {
    if (error instanceof ApiError && error.isNetworkError) message.value = t('common.networkError');
    else if (error instanceof ApiError && error.status === 401) message.value = t('auth.wrongCredentials');
    else if (error instanceof ApiError && error.status === 409) message.value = t('auth.emailTaken');
    else if (error instanceof ApiError && error.status === 429) message.value = t('game.errors.rate_limited');
    else if (error instanceof ApiError && error.status === 400) message.value = t('auth.invalid');
    else message.value = t('common.error');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center px-4 py-10">
    <form class="card flex flex-col gap-4 p-6" @submit.prevent="submit">
      <h1 class="text-center text-3xl font-black">{{ isRegister ? t('auth.registerTitle') : t('auth.loginTitle') }}</h1>
      <p class="text-center text-sm text-slate-600 dark:text-slate-300">{{ t('auth.why') }}</p>

      <label v-if="isRegister" class="block">
        <span class="label">{{ t('auth.displayName') }}</span>
        <input v-model="displayName" class="input" autocomplete="nickname" :maxlength="AUTH_LIMITS.displayNameMax" required />
      </label>
      <label class="block">
        <span class="label">{{ t('auth.email') }}</span>
        <input v-model="email" type="email" class="input" autocomplete="email" :maxlength="AUTH_LIMITS.emailMax" required />
      </label>
      <label class="block">
        <span class="label">{{ t('auth.password') }}</span>
        <input
          v-model="password"
          type="password"
          class="input"
          :autocomplete="isRegister ? 'new-password' : 'current-password'"
          :minlength="isRegister ? AUTH_LIMITS.passwordMin : undefined"
          :maxlength="AUTH_LIMITS.passwordMax"
          aria-describedby="password-hint"
          required
        />
        <span v-if="isRegister" id="password-hint" class="mt-1 block text-sm text-slate-500 dark:text-slate-400">
          {{ t('auth.passwordHint', { n: AUTH_LIMITS.passwordMin }) }}
        </span>
      </label>

      <p v-if="message" class="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-bold text-red-700 dark:text-red-300" role="alert">{{ message }}</p>

      <button type="submit" class="btn-primary py-3 text-base" :disabled="!valid || busy">
        {{ busy ? t('common.loading') : isRegister ? t('auth.register') : t('auth.login') }}
      </button>
      <RouterLink
        :to="{ name: isRegister ? 'login' : 'register', query: route.query }"
        class="text-center text-sm font-bold text-brand-700 dark:text-brand-300 underline"
      >
        {{ isRegister ? t('auth.haveAccount') : t('auth.noAccount') }}
      </RouterLink>
    </form>
  </section>
</template>
