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
import ReactionLayer from '@/components/game/ReactionLayer.vue';
import Mascot from '@/components/Mascot.vue';
import AwardsPanel from '@/components/game/AwardsPanel.vue';
import RevealMascot from '@/components/game/RevealMascot.vue';
import TipCarousel from '@/components/game/TipCarousel.vue';
import BrandMark from '@/components/BrandMark.vue';
import SoundToggles from '@/components/SoundToggles.vue';
import { shortTitle } from '@/brand/topics';
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
  <div class="dark stage min-h-dvh">
  <ReactionLayer />
  <section class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-28 pt-5">
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
      <header class="mb-6 flex flex-wrap items-center gap-3 rounded-full bg-white/5 py-2 pl-2 pr-3 ring-1 ring-white/10 backdrop-blur">
        <RouterLink to="/" :aria-label="t('nav.home')"><BrandMark :size="40" /></RouterLink>
        <h1 class="mr-auto truncate font-display text-lg font-bold">{{ shortTitle(room.quizTitle) }}</h1>
        <template v-if="phase.phase !== 'lobby'">
          <span class="chip bg-white/10 px-3 py-1 text-base tracking-widest">
            PIN <span class="font-display">{{ room.pin }}</span>
          </span>
          <span class="chip bg-white/10 px-3 py-1 text-base">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6.5 6.5 0 0 1 3.5 6" /></svg>
            <span class="tabular-nums">{{ players.length }}</span>
          </span>
        </template>
        <SoundToggles music />
      </header>

      <div class="flex flex-1 flex-col" :class="phase.phase === 'lobby' ? 'justify-start' : 'justify-center'">
        <Transition name="phase" mode="out-in">
        <!-- Lobby -->
        <div v-if="phase.phase === 'lobby'" class="flex flex-col gap-6">
          <ShareRoom :pin="room.pin" />
          <div class="text-center">
            <h2 :key="players.length" class="animate-pop text-3xl font-bold">
              {{ t('game.lobby.players', { n: players.length }, players.length) }}
            </h2>
          </div>
          <div v-if="players.length === 0" class="flex justify-center">
            <Mascot mood="wave" :size="150" :say="t('mascot.lobbyHost')" />
          </div>
          <TipCarousel v-if="players.length" size="lg" />
          <PlayerChips :players="players" kickable size="lg" @kick="kick" />
        </div>

        <CountdownCard v-else-if="phase.phase === 'countdown'" :countdown="phase" />

        <QuestionStage
          v-else-if="phase.phase === 'question'"
          :question="phase.question"
          :answered="game.answerCount.answered"
          :total="game.answerCount.total"
        />

        <div v-else-if="phase.phase === 'reveal'" class="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div class="flex min-w-0 flex-col gap-6">
            <QuestionStage :question="phase.question" :reveal="phase.reveal" />
            <RevealedAnswer :question="phase.question" :answer="phase.reveal.answer" size="lg" :choices="false" />
          </div>
          <aside class="flex flex-col gap-4">
            <RevealMascot :reveal="phase.reveal" :seed="phase.question.globalIndex" />
            <RevealChart v-if="!('options' in phase.question)" :question="phase.question" :reveal="phase.reveal" />
            <p class="rounded-2xl bg-white/5 px-4 py-3 text-center text-lg font-bold text-slate-200 ring-1 ring-white/10">
              {{ t('game.reveal.answeredCount', { answered: phase.reveal.answeredCount, total: phase.reveal.playerCount }) }}
            </p>
            <p v-if="phase.reveal.explanation" class="rounded-2xl bg-sky-500/10 p-5 text-lg leading-relaxed text-sky-100 ring-1 ring-sky-400/20">
              <span aria-hidden="true">💡</span> {{ phase.reveal.explanation }}
            </p>
          </aside>
        </div>

        <div v-else-if="phase.phase === 'leaderboard'" class="mx-auto w-full max-w-4xl">
          <h2 class="mb-8 text-center text-5xl font-bold">{{ t('game.leaderboard.title') }}</h2>
          <LeaderboardList :entries="phase.leaderboard.slice(0, 5)" size="lg" />
          <p v-if="phase.leaderboard.length > 5" class="mt-4 text-center text-lg text-slate-400">
            {{ t('game.leaderboard.more', { n: phase.leaderboard.length - 5 }) }}
          </p>
        </div>

        <RoundSummaryPanel v-else-if="phase.phase === 'round_summary'" :round="phase.round" :leaderboard="phase.leaderboard" />

        <div v-else-if="phase.phase === 'podium'" class="flex flex-col gap-10">
          <div class="flex items-center justify-center gap-4">
            <Mascot mood="celebrate" :size="110" />
            <h2 class="text-center text-5xl font-bold">{{ t('game.podium.title') }}</h2>
            <Mascot mood="celebrate" :size="110" class="-scale-x-100" />
          </div>
          <PodiumPanel :results="phase.results" />
          <AwardsPanel :results="phase.results" />
          <ResultsTable :results="phase.results" size="lg" />
        </div>
        </Transition>
      </div>

      <!-- Host controls -->
      <nav
        class="fixed inset-x-0 bottom-4 z-20 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-2 rounded-full bg-ink-900/80 px-3 py-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
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
  </div>
</template>
