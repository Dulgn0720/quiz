<script setup lang="ts">
import { toDataURL } from 'qrcode';
import { computed, ref, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ pin: string }>();

const { t } = useI18n();
const toast = useToast();

const joinUrl = computed(() => `${window.location.origin}/join/${props.pin}`);
const displayUrl = computed(() => `${window.location.host}/join`);
const qr = ref('');

watchEffect(() => {
  toDataURL(joinUrl.value, { margin: 1, width: 320, color: { dark: '#1e1b4b', light: '#ffffff' } })
    .then((url) => (qr.value = url))
    .catch(() => (qr.value = ''));
});

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(joinUrl.value);
    toast.success(t('game.lobby.linkCopied'));
  } catch {
    toast.error(joinUrl.value);
  }
}

const spacedPin = computed(() => `${props.pin.slice(0, 3)} ${props.pin.slice(3)}`);
</script>

<template>
  <div class="card flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-stretch">
    <div class="flex flex-1 flex-col items-center justify-center text-center sm:items-start sm:text-left">
      <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {{ t('game.lobby.joinAt') }} <span class="text-brand-700 dark:text-brand-300">{{ displayUrl }}</span>
      </p>
      <p class="mt-1 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('game.lobby.pin') }}</p>
      <p class="text-6xl font-black tracking-widest text-slate-900 dark:text-slate-100 sm:text-7xl" :aria-label="pin">{{ spacedPin }}</p>
      <button type="button" class="btn-secondary mt-4" @click="copy">🔗 {{ t('game.lobby.copyLink') }}</button>
    </div>
    <figure v-if="qr" class="flex flex-col items-center">
      <img :src="qr" :alt="t('game.lobby.qrAlt', { url: joinUrl })" class="h-44 w-44 rounded-xl sm:h-48 sm:w-48" />
      <figcaption class="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{{ t('game.lobby.scanToJoin') }}</figcaption>
    </figure>
  </div>
</template>
