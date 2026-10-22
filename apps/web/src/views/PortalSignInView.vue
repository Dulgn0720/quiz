<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Mascot from '@/components/Mascot.vue';
import { useAuthStore } from '@/stores/auth';

/**
 * Landing page for links from the employee portal: `/portal?token=…&next=/quizzes`.
 * Signs the employee in with the portal's short-lived token, then continues to `next`.
 */
const props = defineProps<{ token: string; next: string }>();
const router = useRouter();
const auth = useAuthStore();
const failed = ref(false);

/** Only paths inside this app, never another site. */
const safeNext = props.next.startsWith('/') && !props.next.startsWith('//') ? props.next : '/';

onMounted(async () => {
  if (!props.token) {
    // Opened without a token (e.g. a bookmark): continue as whoever is signed in already.
    await router.replace(safeNext);
    return;
  }
  try {
    await auth.portalSignIn(props.token);
    await router.replace(safeNext);
  } catch {
    failed.value = true;
  }
});
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
    <Mascot :mood="failed ? 'sad' : 'wave'" :size="130" />
    <template v-if="failed">
      <h1 class="mt-4 text-2xl font-bold">{{ $t('portal.failedTitle') }}</h1>
      <p class="mt-2 text-ink-600 dark:text-ink-300">{{ $t('portal.failedText') }}</p>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <RouterLink :to="safeNext" class="btn-primary">{{ $t('portal.continueAsGuest') }}</RouterLink>
        <RouterLink to="/login" class="btn-secondary">{{ $t('nav.signIn') }}</RouterLink>
      </div>
    </template>
    <p v-else class="mt-4 text-lg font-bold" role="status">{{ $t('portal.signingIn') }}</p>
  </section>
</template>
