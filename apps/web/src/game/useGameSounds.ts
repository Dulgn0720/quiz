import { onBeforeUnmount, watch } from 'vue';
import { useConfetti } from '@/composables/useConfetti';
import { useGameStore } from '@/stores/game';
import { sound } from './sound';

/**
 * Plays sounds, music and confetti in reaction to what the server sends.
 * The host screen gets background music; phones only get short effects.
 */
export function useGameSounds() {
  const game = useGameStore();
  const confetti = useConfetti();

  watch(
    () => {
      const p = game.phase;
      if (!p) return '';
      const index = 'question' in p ? p.question.globalIndex : 'globalIndex' in p ? p.globalIndex : '';
      return `${p.phase}:${index}`;
    },
    (key, previous) => {
      const p = game.phase;
      if (!p || key === previous) return;
      const host = game.isHost;
      switch (p.phase) {
        case 'lobby':
          if (host) sound.music('lobby');
          break;
        case 'countdown':
          sound.music(null);
          if (p.roundStart) sound.play('whoosh');
          break;
        case 'question':
          sound.play('go');
          if (host) sound.music('question');
          break;
        case 'reveal':
          sound.music(null);
          if (host) sound.play('reveal');
          else if (p.you?.correct) {
            sound.play('correct');
            confetti.burst({ count: 60, y: 0.4 });
          } else sound.play('wrong');
          break;
        case 'leaderboard':
        case 'round_summary':
          sound.play('whoosh');
          if (host && p.phase === 'round_summary') sound.music('lobby');
          break;
        case 'podium': {
          sound.music(null);
          sound.play('fanfare');
          const rank = p.you?.rank;
          if (host || (rank !== undefined && rank <= 3)) confetti.celebrate();
          break;
        }
      }
    },
    { immediate: true },
  );

  // The host hears every new player arrive in the lobby.
  watch(
    () => game.room?.players.length ?? 0,
    (count, before) => {
      if (game.isHost && game.phase?.phase === 'lobby' && count > (before ?? 0)) sound.play('join');
    },
  );

  // A quick pop when a player locks in an answer.
  watch(
    () => game.submitted,
    (value) => value && sound.play('answer'),
  );

  onBeforeUnmount(() => sound.music(null));
}
