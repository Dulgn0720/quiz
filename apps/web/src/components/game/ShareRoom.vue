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
  <div class="card flex flex-col items-center gap-8 p-8 sm:flex-row sm:items-center">
    <div class="flex min-w-0 flex-1 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
      <p class="text-base font-bold uppercase tracking-wide text-slate-400">{{ t('game.lobby.joinAt') }}</p>
      <p class="break-all font-display text-3xl font-bold text-brand-300 sm:text-4xl">{{ displayUrl }}</p>
      <p class="mt-4 text-base font-bold uppercase tracking-wide text-slate-400">{{ t('game.lobby.pin') }}</p>
      <p class="font-display text-7xl font-bold tracking-widest text-white sm:text-8xl lg:text-9xl">
        <span class="sr-only">{{ pin }}</span><span aria-hidden="true">{{ spacedPin }}</span>
      </p>
      <button type="button" class="btn-secondary mt-4" @click="copy"><span aria-hidden="true">🔗</span> {{ t('game.lobby.copyLink') }}</button>
    </div>
    <figure v-if="qr" class="flex shrink-0 flex-col items-center">
      <img :src="qr" :alt="t('game.lobby.qrAlt', { url: joinUrl })" class="h-52 w-52 rounded-2xl bg-white p-2 sm:h-64 sm:w-64" />
      <figcaption class="mt-3 text-base font-semibold text-slate-400">{{ t('game.lobby.scanToJoin') }}</figcaption>
    </figure>
  </div>
</template>
