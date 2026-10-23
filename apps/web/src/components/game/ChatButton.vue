<script setup lang="ts">
import { CHAT, CHAT_QUICK, GAME_ERRORS } from '@quiz/shared';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@/composables/useToast';
import { sound } from '@/game/sound';
import { useGameStore } from '@/stores/game';

/** Players' comment box: a floating bubble that opens a sheet with the room's chat. */
const props = defineProps<{ myId?: string }>();

const { t } = useI18n();
const game = useGameStore();
const toast = useToast();

const open = ref(false);
const text = ref('');
const sending = ref(false);
const seen = ref(0);
const list = ref<HTMLElement | null>(null);

const unread = computed(() => (open.value ? 0 : Math.max(0, game.chat.length - seen.value)));

watch(
  () => game.chat.length,
  async (n) => {
    if (open.value) {
      seen.value = n;
      await nextTick();
      list.value?.scrollTo({ top: list.value.scrollHeight, behavior: 'smooth' });
    }
  },
);

async function toggle(): Promise<void> {
  open.value = !open.value;
  if (open.value) {
    seen.value = game.chat.length;
    await nextTick();
    list.value?.scrollTo({ top: list.value.scrollHeight });
  }
}

async function send(message: string): Promise<void> {
  if (!message.trim() || sending.value) return;
  sending.value = true;
  const result = await game.sendChat(message);
  sending.value = false;
  if (result.ok) {
    text.value = '';
    sound.play('pop');
    return;
  }
  if (result.error === GAME_ERRORS.rateLimited) toast.info(t('game.chat.slowDown'));
  else toast.error(t(`game.errors.${result.error}`));
}
</script>

<template>
  <div v-if="game.chatEnabled" class="relative">
    <button
      type="button"
      class="btn-icon relative text-xl"
      :aria-label="t('game.chat.open')"
      :aria-expanded="open"
      @click="toggle"
    >
      💬
      <span
        v-if="unread"
        class="absolute -right-1 -top-1 grid h-5 min-w-5 animate-pop place-items-center rounded-full bg-rose-500 px-1 text-[0.65rem] font-extrabold text-white"
      >
        {{ unread > 9 ? '9+' : unread }}
      </span>
    </button>

    <Transition name="sheet">
      <section
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[70dvh] max-w-xl flex-col rounded-t-3xl bg-ink-900/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-left shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
        :aria-label="t('game.chat.title')"
      >
        <div class="flex items-center">
          <h2 class="mr-auto font-display text-lg font-bold">💬 {{ t('game.chat.title') }}</h2>
          <button type="button" class="btn-icon" :aria-label="t('common.close')" @click="open = false">✕</button>
        </div>

        <ol ref="list" class="mt-2 flex-1 space-y-1.5 overflow-y-auto pr-1" aria-live="polite">
          <li v-if="!game.chat.length" class="py-6 text-center text-sm text-slate-400">{{ t('game.chat.empty') }}</li>
          <li
            v-for="m in game.chat"
            :key="m.id"
            class="flex items-start gap-2 rounded-2xl px-3 py-1.5"
            :class="m.playerId === props.myId ? 'bg-brand-500/15 ring-1 ring-brand-400/30' : 'bg-white/5'"
          >
            <span class="text-xl" aria-hidden="true">{{ m.avatar }}</span>
            <p class="min-w-0 flex-1 break-words text-sm">
              <span class="font-bold text-brand-200">{{ m.nickname }}</span>
              {{ m.text }}
            </p>
          </li>
        </ol>

        <div class="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" :aria-label="t('game.chat.quick')">
          <button
            v-for="q in CHAT_QUICK"
            :key="q"
            type="button"
            class="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold transition hover:bg-white/20 active:scale-95"
            :disabled="sending"
            @click="send(q)"
          >
            {{ q }}
          </button>
        </div>

        <form class="mt-2 flex gap-2" @submit.prevent="send(text)">
          <label class="sr-only" for="chat-input">{{ t('game.chat.placeholder') }}</label>
          <input
            id="chat-input"
            v-model="text"
            class="input min-w-0 flex-1"
            :maxlength="CHAT.maxLength"
            :placeholder="t('game.chat.placeholder')"
            autocomplete="off"
            enterkeyhint="send"
          />
          <button type="submit" class="btn-primary shrink-0 px-4" :disabled="sending || !text.trim()">{{ t('game.chat.send') }}</button>
        </form>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
