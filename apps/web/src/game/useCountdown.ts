import { computed, onBeforeUnmount, ref, toValue, watchEffect, type MaybeRefOrGetter } from 'vue';
import { serverNow } from './clock';

/**
 * Milliseconds left until `endsAt` on the server clock. While paused the
 * server sends the remaining time instead, which is shown frozen.
 */
export function useCountdown(
  endsAt: MaybeRefOrGetter<number | undefined>,
  pausedRemainingMs: MaybeRefOrGetter<number | undefined>,
) {
  const now = ref(serverNow());
  let frame = 0;

  const tick = () => {
    now.value = serverNow();
    frame = requestAnimationFrame(tick);
  };

  watchEffect((onCleanup) => {
    if (toValue(endsAt) === undefined || toValue(pausedRemainingMs) !== undefined) return;
    frame = requestAnimationFrame(tick);
    onCleanup(() => cancelAnimationFrame(frame));
  });
  onBeforeUnmount(() => cancelAnimationFrame(frame));

  const remainingMs = computed(() => {
    const paused = toValue(pausedRemainingMs);
    if (paused !== undefined) return paused;
    const end = toValue(endsAt);
    return end === undefined ? 0 : Math.max(0, end - now.value);
  });
  const seconds = computed(() => Math.ceil(remainingMs.value / 1000));
  return { remainingMs, seconds };
}
