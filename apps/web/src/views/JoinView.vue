<script setup lang="ts">
import { AVATARS, LIMITS, PIN_LENGTH, nicknameSchema, teamSchema, type RoomInfo } from '@quiz/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { gamesApi } from '@/api/games';
import { session } from '@/game/session';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { shortTitle } from '@/brand/topics';

const props = defineProps<{ pin?: string }>();

const { t } = useI18n();
const router = useRouter();
const game = useGameStore();

const pinInput = ref(props.pin ?? '');
const room = ref<RoomInfo | null>(null);
const checking = ref(false);
const joining = ref(false);
const message = ref('');

const auth = useAuthStore();
const identity =
  session.lastIdentity() ??
  (auth.user ? { nickname: auth.user.displayName.slice(0, LIMITS.nicknameMax), avatar: auth.user.avatar ?? '' } : null);
const nickname = ref(identity?.nickname ?? '');
const avatar = ref<string>(
  identity && (AVATARS as readonly string[]).includes(identity.avatar)
    ? identity.avatar
    : AVATARS[Math.floor(Math.random() * AVATARS.length)]!,
);

const pinValid = computed(() => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pinInput.value));
const nicknameValid = computed(() => nicknameSchema.safeParse(nickname.value).success);
/** Team games: the department from the profile (or the portal) is suggested. */
const team = ref(auth.user?.department ?? '');
const teamValid = computed(() => !room.value?.teamMode || teamSchema.safeParse(team.value).success);

async function checkPin(pin: string): Promise<void> {
  message.value = '';
  // Already in this room from this browser: go straight back in.
  if (session.player(pin)) {
    await router.replace({ name: 'play', params: { pin } });
    return;
  }
  checking.value = true;
  try {
    const info = await gamesApi.info(pin);
    if (info.status === 'finished' || info.status === 'aborted') message.value = t('game.errors.finished');
    else if (info.locked) message.value = t('game.errors.locked');
    else room.value = info;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) message.value = t('game.errors.not_found');
    else if (error instanceof ApiError && error.status === 429) message.value = t('game.errors.rate_limited');
    else if (error instanceof ApiError && error.isNetworkError) message.value = t('common.networkError');
    else message.value = t('game.errors.not_found');
  } finally {
    checking.value = false;
  }
}

function submitPin(): void {
  pinInput.value = pinInput.value.replace(/\D/g, '');
  if (!pinValid.value) return;
  if (props.pin !== pinInput.value) void router.replace({ name: 'join-pin', params: { pin: pinInput.value } });
  else void checkPin(pinInput.value);
}

async function submitJoin(): Promise<void> {
  if (!room.value || !nicknameValid.value || !teamValid.value || joining.value) return;
  joining.value = true;
  message.value = '';
  const result = await game.join(room.value.pin, nickname.value, avatar.value, room.value.teamMode ? team.value : undefined);
  joining.value = false;
  if (result.ok) await router.push({ name: 'play', params: { pin: room.value.pin } });
  else message.value = result.error === 'network' ? t('common.networkError') : t(`game.errors.${result.error}`);
}

function changePin(): void {
  room.value = null;
  message.value = '';
  void router.replace({ name: 'join' });
}

onMounted(() => {
  if (props.pin) void checkPin(props.pin);
});
watch(
  () => props.pin,
  (pin) => {
    room.value = null;
    if (pin) {
      pinInput.value = pin;
      void checkPin(pin);
    }
  },
);
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center px-4 py-10">
    <form v-if="!room" class="card flex flex-col gap-4 p-6" @submit.prevent="submitPin">
      <h1 class="text-center text-3xl font-bold">{{ t('game.join.title') }}</h1>
      <label class="block">
        <span class="label text-center">{{ t('game.join.pin') }}</span>
        <input
          v-model="pinInput"
          class="input text-center font-display text-4xl font-bold tracking-[0.3em] placeholder:text-ink-300 dark:placeholder:text-white/20"
          inputmode="numeric"
          pattern="[0-9]*"
          enterkeyhint="go"
          autocomplete="off"
          :maxlength="PIN_LENGTH"
          placeholder="••••••"
          :aria-invalid="message ? true : undefined"
          aria-describedby="join-message"
          autofocus
        />
      </label>
      <button type="submit" class="btn-primary py-4 text-lg" :disabled="!pinValid || checking">
        {{ checking ? t('game.join.checking') : t('game.join.next') }}
      </button>
      <p v-if="message" id="join-message" class="text-center font-bold text-red-600 dark:text-red-400" role="alert">{{ message }}</p>
    </form>

    <form v-else class="card flex flex-col gap-5 p-6" @submit.prevent="submitJoin">
      <div class="text-center">
        <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">PIN {{ room.pin }}</p>
        <h1 class="text-balance font-display text-2xl font-bold">{{ shortTitle(room.quizTitle) }}</h1>
        <p v-if="room.playerCount > 0" class="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {{ t('game.join.alreadyIn', { n: room.playerCount }) }}
        </p>
      </div>

      <label class="block">
        <span class="label">{{ t('game.join.nickname') }}</span>
        <input
          v-model="nickname"
          class="input text-lg font-bold"
          :maxlength="LIMITS.nicknameMax"
          :placeholder="t('game.join.nicknamePlaceholder')"
          autocomplete="nickname"
          enterkeyhint="go"
          aria-describedby="join-message"
          autofocus
        />
      </label>

      <label v-if="room.teamMode" class="block">
        <span class="label">🏢 {{ t('game.join.team') }}</span>
        <input
          v-model="team"
          class="input text-lg font-bold"
          maxlength="40"
          list="room-teams"
          :placeholder="t('game.join.teamPlaceholder')"
          autocomplete="organization"
        />
        <datalist id="room-teams">
          <option v-for="name in room.teams" :key="name" :value="name" />
        </datalist>
        <span v-if="room.teams.length" class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="name in room.teams"
            :key="name"
            type="button"
            class="chip px-3 py-1 text-sm ring-1 transition"
            :class="team === name ? 'bg-brand-500 text-ink-950 ring-brand-500' : 'ring-slate-200 dark:ring-white/15'"
            @click="team = name"
          >
            {{ name }}
          </button>
        </span>
      </label>

      <button type="submit" class="btn-primary py-4 text-lg" :disabled="!nicknameValid || !teamValid || joining">
        {{ joining ? t('game.join.joining') : t('game.join.submit') }}
      </button>
      <p v-if="message" id="join-message" class="text-center font-bold text-red-600 dark:text-red-400" role="alert">{{ message }}</p>

      <fieldset>
        <legend class="label">{{ t('game.join.avatar') }}</legend>
        <div class="grid grid-cols-8 gap-1.5" role="radiogroup">
          <label
            v-for="emoji in AVATARS"
            :key="emoji"
            class="grid h-11 cursor-pointer place-items-center rounded-xl text-2xl ring-1 ring-slate-200 dark:ring-slate-700 transition has-[:checked]:bg-brand-100 dark:has-[:checked]:bg-brand-500/30 has-[:checked]:scale-110 has-[:checked]:ring-2 has-[:checked]:ring-brand-500 has-[:focus-visible]:ring-4"
          >
            <input v-model="avatar" type="radio" name="avatar" :value="emoji" class="sr-only" />
            <span aria-hidden="true">{{ emoji }}</span>
            <span class="sr-only">{{ emoji }}</span>
          </label>
        </div>
      </fieldset>
      <p v-if="!auth.user" class="text-center text-sm text-slate-500 dark:text-slate-400">
        {{ t('game.join.guestHint') }}
        <RouterLink :to="{ name: 'login', query: { redirect: `/join/${room.pin}` } }" class="font-bold text-brand-700 dark:text-brand-300 underline">
          {{ t('nav.signIn') }}
        </RouterLink>
      </p>
      <button type="button" class="btn-ghost" @click="changePin">{{ t('game.join.changePin') }}</button>
    </form>
  </section>
</template>
