import type { AppSettings, LoginRequest, RegisterRequest, UpdateProfileRequest, UserProfile, UserPublic } from '@quiz/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { authToken, setAuthToken } from '@/auth/token';

/** The optional signed-in account. Guests can do everything except progression. */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserPublic | null>(null);
  const profile = ref<UserProfile | null>(null);
  /** True until the saved token has been checked. */
  const restoring = ref(authToken() !== null);

  const settings = ref<AppSettings>({ restrictQuizEditing: false });

  const signedIn = computed(() => user.value !== null);
  /** False when the server only lets admins create or change quizzes and this user is not one. */
  const canEditQuizzes = computed(() => !settings.value.restrictQuizEditing || user.value?.isAdmin === true);

  async function restore(): Promise<void> {
    void authApi
      .settings()
      .then((value) => (settings.value = value))
      .catch(() => undefined);
    if (!authToken()) {
      restoring.value = false;
      return;
    }
    try {
      await refresh();
    } catch (error) {
      // An expired or revoked token: forget it. Network errors keep it for later.
      if (error instanceof ApiError && error.status === 401) logout();
    } finally {
      restoring.value = false;
    }
  }

  async function refresh(): Promise<UserProfile> {
    const me = await authApi.me();
    profile.value = me;
    user.value = me;
    return me;
  }

  async function login(body: LoginRequest): Promise<void> {
    const res = await authApi.login(body);
    setAuthToken(res.token);
    user.value = res.user;
    void refresh().catch(() => undefined);
  }

  async function register(body: RegisterRequest): Promise<void> {
    const res = await authApi.register(body);
    setAuthToken(res.token);
    user.value = res.user;
    void refresh().catch(() => undefined);
  }

  async function update(body: UpdateProfileRequest): Promise<void> {
    user.value = await authApi.updateMe(body);
    if (profile.value) profile.value = { ...profile.value, ...user.value };
  }

  function logout(): void {
    setAuthToken(null);
    user.value = null;
    profile.value = null;
  }

  return { user, profile, restoring, settings, signedIn, canEditQuizzes, restore, refresh, login, register, update, logout };
});
