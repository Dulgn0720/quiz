<script setup lang="ts">
import type { QuizSummary, RoomVisibility } from '@quiz/shared';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { gamesApi } from '@/api/games';
import { session } from '@/game/session';

const props = defineProps<{ quiz: Pick<QuizSummary, 'id' | 'title'> | null }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const router = useRouter();

const dialog = ref<HTMLDialogElement>();
const visibility = ref<RoomVisibility>('private');
const perPlayerShuffle = ref(true);
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
  try {
    const game = await gamesApi.create({
      quizId: props.quiz.id,
      visibility: visibility.value,
      perPlayerShuffle: perPlayerShuffle.value,
    });
    session.saveHostToken(game.pin, game.hostToken);
    emit('close');
    await router.push({ name: 'host', params: { pin: game.pin } });
  } catch (error) {
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
        <p class="mt-1 text-sm font-semibold text-slate-600">{{ quiz?.title }}</p>
      </div>

      <fieldset class="flex flex-col gap-2">
        <legend class="label">{{ t('game.hostDialog.visibility') }}</legend>
        <label
          v-for="option in ['private', 'public'] as const"
          :key="option"
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
        >
          <input v-model="visibility" type="radio" name="visibility" :value="option" class="mt-1 accent-brand-600" />
          <span>
            <span class="block font-bold">{{ t(`game.hostDialog.${option}`) }}</span>
            <span class="block text-sm text-slate-600">{{ t(`game.hostDialog.${option}Help`) }}</span>
          </span>
        </label>
      </fieldset>

      <label class="flex cursor-pointer items-start gap-3">
        <input v-model="perPlayerShuffle" type="checkbox" class="mt-1 h-4 w-4 accent-brand-600" />
        <span>
          <span class="block font-bold">{{ t('game.hostDialog.perPlayerShuffle') }}</span>
          <span class="block text-sm text-slate-600">{{ t('game.hostDialog.perPlayerShuffleHelp') }}</span>
        </span>
      </label>

      <p v-if="message" class="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{{ message }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="submit" class="btn-primary" :disabled="busy">
          {{ busy ? t('game.hostDialog.creating') : t('game.hostDialog.create') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
