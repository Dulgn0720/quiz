<script setup lang="ts">
import { GAME_ERRORS, type PlayerPublic } from '@quiz/shared';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ConnectionBanner from '@/components/game/ConnectionBanner.vue';
import CountdownCard from '@/components/game/CountdownCard.vue';
import LeaderboardList from '@/components/game/LeaderboardList.vue';
import PlayerChips from '@/components/game/PlayerChips.vue';
import PodiumPanel from '@/components/game/PodiumPanel.vue';
import QuestionStage from '@/components/game/QuestionStage.vue';
import ResultsTable from '@/components/game/ResultsTable.vue';
import RevealChart from '@/components/game/RevealChart.vue';
import RevealedAnswer from '@/components/game/RevealedAnswer.vue';
import RoundSummaryPanel from '@/components/game/RoundSummaryPanel.vue';
import ShareRoom from '@/components/game/ShareRoom.vue';
import SoundToggles from '@/components/SoundToggles.vue';
import { useGameSounds } from '@/game/useGameSounds';
import { useToast } from '@/composables/useToast';
import { useGameStore, type Ack } from '@/stores/game';

const props = defineProps<{ pin: string }>();

const { t } = useI18n();
const toast = useToast();
const game = useGameStore();
const busy = ref(false);
useGameSounds();

onMounted(() => game.host(props.pin));
watch(
  () => props.pin,
  (pin) => game.host(pin),
);
onBeforeUnmount(() => game.reset());

const room = computed(() => game.room);
const phase = computed(() => game.phase);
const players = computed(() => room.value?.players ?? []);
const fatalError = computed(() =>
  game.error === GAME_ERRORS.unauthorized || game.error === GAME_ERRORS.notFound ? game.error : null,
);

async function run(action: () => Promise<Ack>): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  const result = await action();
  busy.value = false;
  if (!result.ok) toast.error(t(`game.errors.${result.error}`));
}

const canAdvance = computed(() =>
  ['reveal', 'leaderboard', 'round_summary'].includes(phase.value?.phase ?? ''),
);
const canPause = computed(() => phase.value?.phase === 'question' || phase.value?.phase === 'countdown');

const nextLabel = computed(() => {
  const p = phase.value;
  if (p?.phase === 'round_summary') return p.isLastRound ? t('game.controls.showResults') : t('game.controls.nextRound');
  if (p?.phase === 'reveal') return t('game.controls.continue');
  return t('game.controls.nextQuestion');
});

const next = () => run(() => game.command('host:next'));
const skip = () => run(() => game.command('host:skip'));
const start = () => run(() => game.command('host:start'));
const togglePause = () => run(() => game.setPaused(!room.value?.paused));
const toggleLock = () => run(() => game.setLocked(!room.value?.locked));

function end(): void {
  const inLobby = phase.value?.phase === 'lobby';
  if (!window.confirm(inLobby ? t('game.controls.closeConfirm') : t('game.controls.endConfirm'))) return;
  void run(() => game.command('host:end'));
}

function kick(player: PlayerPublic): void {
  if (window.confirm(t('game.lobby.kickConfirm', { name: player.nickname }))) void run(() => game.kick(player.id));
}

/** Space / → advances, P pauses: handy with a clicker or keyboard at the projector. */
function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName)) return;
  if ((event.key === ' ' || event.key === 'ArrowRight') && canAdvance.value) {
    event.preventDefault();
    void next();
  } else if (event.key.toLowerCase() === 'p' && canPause.value) {
    void togglePause();
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col px-4 py-6">
    <ConnectionBanner />

    <div v-if="fatalError" class="card mx-auto mt-16 max-w-md p-8 text-center" role="alert">
      <p class="text-lg font-bold">{{ t(`game.errors.${fatalError}`) }}</p>
      <RouterLink to="/quizzes" class="btn-primary mt-6">{{ t('game.podium.backToQuizzes') }}</RouterLink>
    </div>

    <div v-else-if="game.ended === 'closed'" class="card mx-auto mt-16 max-w-md p-8 text-center" role="status">
      <p class="text-lg font-bold">{{ t('game.ended.closedHost') }}</p>
      <RouterLink to="/quizzes" class="btn-primary mt-6">{{ t('game.podium.backToQuizzes') }}</RouterLink>
    </div>

    <p v-else-if="!room || !phase" class="mt-16 text-center text-slate-500 dark:text-slate-400">{{ t('common.loading') }}</p>

    <template v-else>
      <header class="mb-6 flex flex-wrap items-center gap-3">
        <h1 class="mr-auto text-xl font-black">{{ room.quizTitle }}</h1>
        <span class="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-bold text-slate-700 dark:text-slate-200">
          PIN {{ room.pin }}
        </span>
        <span class="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-bold text-slate-700 dark:text-slate-200">
          👥 {{ players.length }}
        </span>
        <SoundToggles music />
      </header>

      <div class="flex flex-1 flex-col justify-center">
        <Transition name="phase" mode="out-in">
        <!-- Lobby -->
        <div v-if="phase.phase === 'lobby'" class="flex flex-col gap-6">
          <ShareRoom :pin="room.pin" />
          <div class="text-center">
            <h2 class="text-2xl font-black">{{ t('game.lobby.players', { n: players.length }, players.length) }}</h2>
            <p v-if="players.length === 0" class="mt-2 animate-pulse font-semibold text-slate-500 dark:text-slate-400">{{ t('game.lobby.waiting') }}</p>
          </div>
          <PlayerChips :players="players" kickable @kick="kick" />
        </div>

        <CountdownCard v-else-if="phase.phase === 'countdown'" :countdown="phase" />

        <QuestionStage
          v-else-if="phase.phase === 'question'"
          :question="phase.question"
          :answered="game.answerCount.answered"
          :total="game.answerCount.total"
        />

        <div v-else-if="phase.phase === 'reveal'" class="flex flex-col gap-8">
          <QuestionStage :question="phase.question" :reveal="phase.reveal" />
          <RevealedAnswer :question="phase.question" :answer="phase.reveal.answer" />
          <RevealChart :question="phase.question" :reveal="phase.reveal" />
          <p class="text-center font-bold text-slate-600 dark:text-slate-300">
            {{ t('game.reveal.answeredCount', { answered: phase.reveal.answeredCount, total: phase.reveal.playerCount }) }}
          </p>
          <p v-if="phase.reveal.explanation" class="mx-auto max-w-2xl rounded-2xl bg-sky-50 dark:bg-sky-950/40 p-4 text-center text-lg text-sky-900 dark:text-sky-200">
            💡 {{ phase.reveal.explanation }}
          </p>
        </div>

        <div v-else-if="phase.phase === 'leaderboard'" class="mx-auto w-full max-w-2xl">
          <h2 class="mb-6 text-center text-4xl font-black">{{ t('game.leaderboard.title') }}</h2>
          <LeaderboardList :entries="phase.leaderboard" />
        </div>

        <RoundSummaryPanel v-else-if="phase.phase === 'round_summary'" :round="phase.round" :leaderboard="phase.leaderboard" />

        <div v-else-if="phase.phase === 'podium'" class="flex flex-col gap-10">
          <h2 class="text-center text-4xl font-black">{{ t('game.podium.title') }}</h2>
          <PodiumPanel :results="phase.results" />
          <ResultsTable :results="phase.results" />
        </div>
        </Transition>
      </div>

      <!-- Host controls -->
      <nav
        class="sticky bottom-0 -mx-4 mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-950/95 px-4 py-3 backdrop-blur"
        :aria-label="t('game.controls.label')"
      >
        <template v-if="phase.phase === 'lobby'">
          <button type="button" class="btn-secondary" :aria-pressed="room.locked" @click="toggleLock">
            {{ room.locked ? `🔒 ${t('game.lobby.unlock')}` : `🔓 ${t('game.lobby.lock')}` }}
          </button>
          <button type="button" class="btn-danger" @click="end">{{ t('game.controls.closeRoom') }}</button>
          <button type="button" class="btn-primary px-8 text-base" :disabled="busy || players.length === 0" @click="start">
            ▶ {{ t('game.lobby.start') }}
          </button>
        </template>
        <template v-else-if="phase.phase === 'podium'">
          <RouterLink to="/quizzes" class="btn-primary">{{ t('game.podium.backToQuizzes') }}</RouterLink>
        </template>
        <template v-else>
          <button v-if="canPause" type="button" class="btn-secondary" :disabled="busy" @click="togglePause">
            {{ room.paused ? `▶ ${t('game.controls.resume')}` : `❚❚ ${t('game.controls.pause')}` }}
          </button>
          <button v-if="canPause" type="button" class="btn-secondary" :disabled="busy" @click="skip">
            ⏭ {{ t('game.controls.skip') }}
          </button>
          <button type="button" class="btn-danger" @click="end">{{ t('game.controls.end') }}</button>
          <button v-if="canAdvance" type="button" class="btn-primary px-8 text-base" :disabled="busy" @click="next">
            {{ nextLabel }} →
          </button>
        </template>
      </nav>
    </template>
  </section>
</template>
