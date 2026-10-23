<script setup lang="ts">
import { GAME_ERRORS, rankForLevel, type AnswerPayload } from '@quiz/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import AnswerForm from '@/components/game/AnswerForm.vue';
import ConnectionBanner from '@/components/game/ConnectionBanner.vue';
import CountdownCard from '@/components/game/CountdownCard.vue';
import GameTimer from '@/components/game/GameTimer.vue';
import LeaderboardList from '@/components/game/LeaderboardList.vue';
import PlayerChips from '@/components/game/PlayerChips.vue';
import PlayerResult from '@/components/game/PlayerResult.vue';
import PodiumPanel from '@/components/game/PodiumPanel.vue';
import PowerUpBar from '@/components/game/PowerUpBar.vue';
import QuestionHeader from '@/components/game/QuestionHeader.vue';
import RevealedAnswer from '@/components/game/RevealedAnswer.vue';
import LevelBar from '@/components/LevelBar.vue';
import RankUpCelebration from '@/components/RankUpCelebration.vue';
import LockedAnswer from '@/components/game/LockedAnswer.vue';
import ChatButton from '@/components/game/ChatButton.vue';
import ReactionBar from '@/components/game/ReactionBar.vue';
import TeamRace from '@/components/game/TeamRace.vue';
import Mascot from '@/components/Mascot.vue';
import TapMascot from '@/components/game/TapMascot.vue';
import TipCarousel from '@/components/game/TipCarousel.vue';
import RoundSummaryPanel from '@/components/game/RoundSummaryPanel.vue';
import SoundToggles from '@/components/SoundToggles.vue';
import { useGameSounds } from '@/game/useGameSounds';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';

const props = defineProps<{ pin: string }>();

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const game = useGameStore();
const auth = useAuthStore();
useGameSounds();

function enter(pin: string): void {
  if (!game.resume(pin)) void router.replace({ name: 'join-pin', params: { pin } });
}
onMounted(() => enter(props.pin));
watch(() => props.pin, enter);

const phase = computed(() => game.phase);
/** Changes whenever the screen should animate to a new state. */
const phaseKey = computed(() => {
  const p = phase.value;
  if (!p) return '';
  return `${p.phase}:${'question' in p ? p.question.globalIndex : ''}`;
});
const me = computed(() => game.me);
const myId = computed(() => me.value?.playerId);
const myTeam = computed(() => game.room?.players.find((p) => p.id === myId.value)?.team);
// A new wrestling title after the game gets its own ceremony.
const rankUpLevel = ref<number | null>(null);
watch(
  () => game.progress,
  (p) => {
    if (p && rankForLevel(p.level).code !== rankForLevel(p.previousLevel).code) rankUpLevel.value = p.level;
  },
);
const myScore = computed(() => game.room?.players.find((p) => p.id === myId.value)?.score ?? 0);

/** The answer this player gave to the open question, from the server or just sent. */
const lockedAnswer = computed(() => {
  const p = phase.value;
  if (p?.phase !== 'question') return undefined;
  if (p.yourAnswer) return p.yourAnswer;
  return game.submitted?.questionIndex === p.question.globalIndex ? game.submitted.answer : undefined;
});

const fatalError = computed(() => {
  const e = game.error;
  return e === GAME_ERRORS.notFound || e === GAME_ERRORS.finished || e === GAME_ERRORS.kicked ? e : null;
});

async function submit(answer: AnswerPayload): Promise<void> {
  const result = await game.submitAnswer(answer);
  if (!result.ok && result.error !== GAME_ERRORS.alreadyAnswered) toast.error(t(`game.errors.${result.error}`));
}

function leave(): void {
  if (phase.value?.phase !== 'podium' && !window.confirm(t('game.player.leaveConfirm'))) return;
  game.leave();
  void router.push({ name: 'home' });
}
</script>

<template>
  <div class="dark stage min-h-dvh">
  <section class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <ConnectionBanner />

    <div v-if="game.ended || fatalError" class="card mt-16 p-8 text-center" role="alert">
      <p class="text-5xl" aria-hidden="true">{{ game.ended === 'kicked' || fatalError === 'kicked' ? '🚪' : '👋' }}</p>
      <p class="mt-4 text-lg font-bold">
        {{
          game.ended === 'kicked'
            ? t('game.ended.kicked')
            : game.ended === 'closed'
              ? t('game.ended.closed')
              : t(`game.errors.${fatalError}`)
        }}
      </p>
      <RouterLink :to="{ name: 'join' }" class="btn-primary mt-6">{{ t('game.ended.joinAnother') }}</RouterLink>
    </div>

    <p v-else-if="!phase || !me" class="mt-16 text-center text-slate-500 dark:text-slate-400">{{ t('common.loading') }}</p>

    <template v-else>
      <header class="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 bg-ink-950/70 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <span class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-2xl leading-none" aria-hidden="true">{{ me.avatar }}</span>
        <span class="mr-auto truncate font-bold">{{ me.nickname }}</span>
        <span
          v-if="phase.phase !== 'lobby'"
          class="rounded-full bg-brand-500 px-3 py-1 font-display font-bold tabular-nums text-ink-950"
          aria-live="polite"
        >
          <span class="sr-only">{{ t('game.player.score') }}: </span>{{ myScore }}
        </span>
        <ChatButton :my-id="myId" />
        <SoundToggles />
        <button type="button" class="btn-icon" :aria-label="t('game.player.leave')" @click="leave">✕</button>
      </header>

      <Transition name="phase" mode="out-in">
      <div :key="phaseKey" class="flex flex-1 flex-col">
        <div v-if="phase.phase === 'lobby'" class="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <TapMascot>
            <span class="absolute -right-4 bottom-2 grid h-14 w-14 animate-pop place-items-center rounded-full bg-white/10 text-4xl ring-2 ring-brand-400" aria-hidden="true">
              {{ me.avatar }}
            </span>
          </TapMascot>
          <div>
            <h1 class="text-3xl font-bold">{{ t('game.player.youAreIn') }}</h1>
            <p class="mt-2 font-semibold text-slate-300">{{ t('game.player.waitingForHost') }}</p>
          </div>
          <PlayerChips v-if="game.room" :players="game.room.players" :highlight-id="myId" />
          <ReactionBar />
          <TipCarousel />
        </div>

        <CountdownCard v-else-if="phase.phase === 'countdown'" :countdown="phase" />

        <div v-else-if="phase.phase === 'question'" class="flex flex-1 flex-col gap-4">
          <QuestionHeader :question="phase.question" />
          <div class="flex items-center gap-3">
            <h2 class="flex-1 text-xl font-bold leading-snug">{{ phase.question.prompt }}</h2>
            <GameTimer :ends-at="phase.question.endsAt" :paused-remaining-ms="phase.question.pausedRemainingMs" :total="phase.question.timeLimit" />
          </div>
          <img v-if="phase.question.imageUrl" :src="phase.question.imageUrl" alt="" class="max-h-48 self-center rounded-xl object-contain" />

          <div v-if="phase.you?.eliminated" class="card flex flex-1 flex-col items-center justify-center p-8 text-center">
            <p class="text-5xl" aria-hidden="true">👀</p>
            <p class="mt-3 text-lg font-bold">{{ t('game.player.eliminated') }}</p>
          </div>
          <LockedAnswer v-else-if="lockedAnswer" :question="phase.question" :answer="lockedAnswer" />
          <p v-else-if="phase.question.pausedRemainingMs !== undefined" class="card p-8 text-center text-lg font-bold" role="status">
            ❚❚ {{ t('game.player.paused') }}
          </p>
          <template v-else>
            <PowerUpBar v-if="phase.powerUps" :question="phase.question" :power-ups="phase.powerUps" />
            <AnswerForm :question="phase.question" :hidden="phase.powerUps?.hidden" @submit="submit" />
          </template>
        </div>

        <div v-else-if="phase.phase === 'reveal'" class="flex flex-1 flex-col justify-center gap-6">
          <PlayerResult v-if="phase.you" :result="phase.you" :seed="phase.question.globalIndex" />
          <RevealedAnswer :question="phase.question" :answer="phase.reveal.answer" />
          <p v-if="phase.reveal.explanation" class="rounded-2xl bg-sky-500/10 p-4 text-sky-100 ring-1 ring-sky-400/20">
            <span aria-hidden="true">💡</span> {{ phase.reveal.explanation }}
          </p>
          <ReactionBar />
        </div>

        <div v-else-if="phase.phase === 'leaderboard'" class="flex flex-col gap-6">
          <div v-if="phase.you" class="card p-6 text-center">
            <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('game.player.yourRank') }}</p>
            <p class="text-6xl font-black tabular-nums">#{{ phase.you.rank }}</p>
            <p v-if="phase.you.rank < phase.you.previousRank" class="font-bold text-emerald-600">
              ▲ {{ t('game.player.climbed', { n: phase.you.previousRank - phase.you.rank }) }}
            </p>
          </div>
          <TeamRace v-if="phase.teams?.length" :teams="phase.teams" :highlight="myTeam" />
          <LeaderboardList :entries="phase.leaderboard" :highlight-id="myId" />
          <ReactionBar />
        </div>

        <div v-else-if="phase.phase === 'round_summary'" class="flex flex-col gap-6">
          <RoundSummaryPanel :round="phase.round" :leaderboard="phase.leaderboard" :highlight-id="myId" />
          <TeamRace v-if="phase.teams?.length" :teams="phase.teams" :highlight="myTeam" />
        </div>

        <div v-else-if="phase.phase === 'podium'" class="flex flex-col gap-8">
          <div class="flex flex-col items-center">
            <Mascot :mood="!phase.you ? 'happy' : phase.you.rank === 1 ? 'cool' : phase.you.rank <= 3 ? 'celebrate' : 'love'" :size="120" />
            <h1 class="text-center text-3xl font-bold">{{ t('game.podium.title') }}</h1>
          </div>
          <div v-if="phase.teams?.length" class="flex flex-col gap-3">
            <p class="rounded-2xl bg-gradient-to-r from-amber-400 to-brand-500 px-4 py-3 text-center font-display text-xl font-bold text-ink-950">
              🏆 {{ t('game.teams.winner', { team: phase.teams[0]!.team }) }}
            </p>
            <TeamRace :teams="phase.teams" :highlight="myTeam" />
          </div>
          <PodiumPanel :results="phase.results" :highlight-id="myId" />
          <dl v-if="phase.you" class="grid grid-cols-2 gap-3">
            <div class="card p-4 text-center">
              <dt class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ t('game.player.yourRank') }}</dt>
              <dd class="text-3xl font-black">#{{ phase.you.rank }}</dd>
            </div>
            <div class="card p-4 text-center">
              <dt class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ t('game.podium.score') }}</dt>
              <dd class="text-3xl font-black tabular-nums">{{ phase.you.score }}</dd>
            </div>
            <div class="card p-4 text-center">
              <dt class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ t('game.podium.correct') }}</dt>
              <dd class="text-3xl font-black">{{ phase.you.correctCount }}/{{ phase.you.questionCount }}</dd>
            </div>
            <div class="card p-4 text-center">
              <dt class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ t('game.podium.bestStreak') }}</dt>
              <dd class="text-3xl font-black">🔥 {{ phase.you.bestStreak }}</dd>
            </div>
          </dl>
          <div v-if="game.progress" class="card animate-pop p-5" role="status">
            <p class="text-center text-2xl font-black text-brand-700 dark:text-brand-300">+{{ game.progress.xpEarned }} XP</p>
            <p v-if="game.progress.level > game.progress.previousLevel" class="text-center font-black text-amber-600">
              🎉 {{ t('profile.levelUp', { n: game.progress.level }) }}
            </p>
            <LevelBar class="mt-3" :progress="game.progress.progress" :xp="game.progress.xp" />
            <ul v-if="game.progress.newBadges.length" class="mt-4 flex flex-wrap justify-center gap-2">
              <li
                v-for="badge in game.progress.newBadges"
                :key="badge.code"
                class="flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 font-bold text-amber-900 dark:text-amber-200"
              >
                <span aria-hidden="true">{{ badge.icon }}</span> {{ t(`badges.${badge.code}.name`) }}
              </li>
            </ul>
          </div>
          <RouterLink v-else-if="!auth.user" to="/register" class="card block p-4 text-center font-bold text-brand-700 dark:text-brand-300">
            {{ t('profile.signUpForXp') }}
          </RouterLink>
          <ReactionBar />
          <button type="button" class="btn-primary" @click="leave">{{ t('game.ended.joinAnother') }}</button>
        </div>
      </div>
      </Transition>
    </template>
  </section>
  <RankUpCelebration v-if="rankUpLevel !== null" :level="rankUpLevel" @close="rankUpLevel = null" />
  </div>
</template>
