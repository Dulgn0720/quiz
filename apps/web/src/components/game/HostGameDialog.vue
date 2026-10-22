<script setup lang="ts">
import type { QuizSummary, RoomVisibility } from '@quiz/shared';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { gamesApi } from '@/api/games';
import { isEmbedded } from '@/embed';
import { session } from '@/game/session';

const props = defineProps<{ quiz: Pick<QuizSummary, 'id' | 'title'> | null }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const router = useRouter();

const dialog = ref<HTMLDialogElement>();
const visibility = ref<RoomVisibility>('private');
const perPlayerShuffle = ref(true);
const teamMode = ref(false);
const powerUps = ref(true);
const busy = ref(false);
const message = ref('');

watch(
  () => props.quiz,
  (quiz) => {
    if (quiz) {
      message.value = '';
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
    }
  },
);

async function submit(): Promise<void> {
  if (!props.quiz) return;
  busy.value = true;
  message.value = '';
  // Inside the portal the projector screen gets its own tab. The tab is opened now, while the click
  // still counts as a user action, so pop-up blockers allow it.
  const projector = isEmbedded ? window.open('', '_blank') : null;
  try {
    const game = await gamesApi.create({
      quizId: props.quiz.id,
      visibility: visibility.value,
      perPlayerShuffle: perPlayerShuffle.value,
      teamMode: teamMode.value,
      powerUps: powerUps.value,
    });
    session.saveHostToken(game.pin, game.hostToken);
    emit('close');
    const target = router.resolve({ name: 'host', params: { pin: game.pin } });
    if (projector) projector.location.href = target.href;
    else await router.push(target);
  } catch (error) {
    projector?.close();
    message.value =
      error instanceof ApiError && error.isNetworkError ? t('common.networkError') : (error as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/50"
    aria-labelledby="host-title"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-5 p-6" @submit.prevent="submit">
      <div>
        <h2 id="host-title" class="text-xl font-black">{{ t('game.hostDialog.title') }}</h2>
        <p class="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{{ quiz?.title }}</p>
      </div>

      <fieldset class="flex flex-col gap-2">
        <legend class="label">{{ t('game.hostDialog.visibility') }}</legend>
        <label
          v-for="option in ['private', 'public'] as const"
          :key="option"
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-900/30"
        >
          <input v-model="visibility" type="radio" name="visibility" :value="option" class="mt-1 accent-brand-600" />
          <span>
            <span class="block font-bold">{{ t(`game.hostDialog.${option}`) }}</span>
            <span class="block text-sm text-slate-600 dark:text-slate-300">{{ t(`game.hostDialog.${option}Help`) }}</span>
          </span>
        </label>
      </fieldset>

      <label class="flex cursor-pointer items-start gap-3">
        <input v-model="perPlayerShuffle" type="checkbox" class="mt-1 h-4 w-4 accent-brand-600" />
        <span>
          <span class="block font-bold">{{ t('game.hostDialog.perPlayerShuffle') }}</span>
          <span class="block text-sm text-slate-600 dark:text-slate-300">{{ t('game.hostDialog.perPlayerShuffleHelp') }}</span>
        </span>
      </label>
      <label class="flex cursor-pointer items-start gap-3">
        <input v-model="teamMode" type="checkbox" class="mt-1 h-4 w-4 accent-brand-600" />
        <span>
          <span class="block font-bold">{{ t('game.hostDialog.teamMode') }}</span>
          <span class="block text-sm text-slate-600 dark:text-slate-300">{{ t('game.hostDialog.teamModeHelp') }}</span>
        </span>
      </label>
      <label class="flex cursor-pointer items-start gap-3">
        <input v-model="powerUps" type="checkbox" class="mt-1 h-4 w-4 accent-brand-600" />
        <span>
          <span class="block font-bold">{{ t('game.hostDialog.powerUps') }}</span>
          <span class="block text-sm text-slate-600 dark:text-slate-300">{{ t('game.hostDialog.powerUpsHelp') }}</span>
        </span>
      </label>

      <p v-if="isEmbedded" class="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
        🖥️ {{ t('game.hostDialog.newTab') }}
      </p>
      <p v-if="message" class="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-bold text-red-700 dark:text-red-300" role="alert">{{ message }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="submit" class="btn-primary" :disabled="busy">
          {{ busy ? t('game.hostDialog.creating') : t('game.hostDialog.create') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
