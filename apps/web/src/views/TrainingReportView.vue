<script setup lang="ts">
import { stringifyCsv, type TrainingReport, type TrainingStatus } from '@quiz/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { trainingsApi } from '@/api/trainings';
import { downloadFile } from '@/game/report';

/** Admins: who has passed a training, who failed and who has not started, with a CSV export. */
const props = defineProps<{ id: string }>();
const { t } = useI18n();

const report = ref<TrainingReport | null>(null);
const failed = ref(false);
const filter = ref<TrainingStatus | 'all'>('all');
const search = ref('');

onMounted(async () => {
  try {
    report.value = await trainingsApi.report(props.id);
  } catch {
    failed.value = true;
  }
});

const total = computed(() => report.value?.rows.length ?? 0);
const share = (n: number) => (total.value ? Math.round((n / total.value) * 100) : 0);

const rows = computed(() => {
  const q = search.value.trim().toLocaleLowerCase();
  return (report.value?.rows ?? []).filter(
    (r) =>
      (filter.value === 'all' || r.status === filter.value) &&
      (!q || `${r.displayName} ${r.email} ${r.department ?? ''}`.toLocaleLowerCase().includes(q)),
  );
});

const date = (iso?: string) => (iso ? iso.slice(0, 10) : '');

function exportCsv(): void {
  const r = report.value;
  if (!r) return;
  // Spreadsheet apps run cells starting with these as formulas.
  const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
  const lines = [
    [r.training.title],
    [],
    [
      t('trainings.col.name'),
      t('trainings.col.email'),
      t('trainings.col.department'),
      t('trainings.col.status'),
      t('trainings.col.attempts'),
      t('trainings.col.best'),
      t('trainings.col.passedAt'),
      t('trainings.col.certificate'),
    ],
    ...r.rows.map((x) => [
      safe(x.displayName),
      safe(x.email),
      safe(x.department ?? ''),
      t(`trainings.status.${x.status}`),
      String(x.attempts),
      x.bestPercent === undefined ? '' : String(x.bestPercent),
      date(x.passedAt),
      x.certificateId ?? '',
    ]),
  ];
  downloadFile(`training-${r.training.id}-${new Date().toISOString().slice(0, 10)}.csv`, stringifyCsv(lines, { bom: true }));
}
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-8">
    <RouterLink to="/trainings" class="text-sm font-bold text-brand-600 hover:underline dark:text-brand-300">← {{ t('trainings.title') }}</RouterLink>
    <p v-if="failed" class="mt-6 rounded-2xl bg-red-50 p-4 text-center font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
      {{ t('common.error') }}
    </p>
    <div v-else-if="!report" class="card mt-6 h-64 animate-pulse" aria-hidden="true" />
    <template v-else>
      <div class="mt-4 flex flex-wrap items-end gap-3">
        <div class="mr-auto">
          <h1 class="text-3xl font-bold">📊 {{ report.training.title }}</h1>
          <p class="mt-1 text-ink-600 dark:text-ink-300">
            {{ t('trainings.passMark', { n: report.training.passPercent }) }}
            <template v-if="report.training.department"> · {{ report.training.department }}</template>
            <template v-if="report.training.dueDate"> · {{ t('trainings.due', { date: report.training.dueDate }) }}</template>
          </p>
        </div>
        <button type="button" class="btn-primary" @click="exportCsv">⬇ {{ t('game.report.download') }}</button>
      </div>

      <!-- Completion at a glance -->
      <div class="mt-6 grid gap-3 sm:grid-cols-3">
        <div v-for="s in (['passed', 'failed', 'todo'] as const)" :key="s" class="card p-5">
          <p class="text-sm font-bold text-ink-500 dark:text-ink-400">{{ t(`trainings.status.${s}`) }}</p>
          <p class="font-display text-4xl font-bold tabular-nums">{{ report[s] }}</p>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
            <div
              class="bar h-full rounded-full"
              :class="{ 'bg-emerald-500': s === 'passed', 'bg-rose-500': s === 'failed', 'bg-sky-500': s === 'todo' }"
              :style="{ width: `${share(report[s])}%` }"
            />
          </div>
          <p class="mt-1 text-xs text-ink-500">{{ share(report[s]) }}%</p>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-2">
        <button
          v-for="f in (['all', 'todo', 'failed', 'passed'] as const)"
          :key="f"
          type="button"
          class="rounded-full px-4 py-1.5 text-sm font-bold ring-1 transition"
          :class="filter === f ? 'bg-brand-500 text-white ring-brand-500' : 'ring-ink-200 hover:bg-ink-50 dark:ring-white/15 dark:hover:bg-white/5'"
          @click="filter = f"
        >
          {{ f === 'all' ? t('trainings.all') : t(`trainings.status.${f}`) }}
        </button>
        <input v-model="search" class="input ml-auto w-full sm:w-64" :placeholder="t('trainings.search')" />
      </div>

      <div class="card mt-4 overflow-x-auto">
        <table class="w-full min-w-[40rem] text-left">
          <thead class="border-b border-ink-100 text-sm text-ink-500 dark:border-white/10 dark:text-ink-400">
            <tr>
              <th scope="col" class="px-4 py-3">{{ t('trainings.col.name') }}</th>
              <th scope="col" class="px-4 py-3">{{ t('trainings.col.department') }}</th>
              <th scope="col" class="px-4 py-3">{{ t('trainings.col.status') }}</th>
              <th scope="col" class="px-4 py-3 text-right">{{ t('trainings.col.attempts') }}</th>
              <th scope="col" class="px-4 py-3 text-right">{{ t('trainings.col.best') }}</th>
              <th scope="col" class="px-4 py-3">{{ t('trainings.col.passedAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.email" class="border-b border-ink-50 last:border-0 dark:border-white/5">
              <td class="px-4 py-3">
                <span class="block font-bold">{{ r.displayName }}</span>
                <span class="block text-xs text-ink-500">{{ r.email }}</span>
              </td>
              <td class="px-4 py-3">{{ r.department ?? '—' }}</td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2.5 py-0.5 text-sm font-bold"
                  :class="{
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200': r.status === 'passed',
                    'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200': r.status === 'failed',
                    'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200': r.status === 'todo',
                  }"
                >{{ t(`trainings.status.${r.status}`) }}</span>
              </td>
              <td class="px-4 py-3 text-right tabular-nums">{{ r.attempts }}</td>
              <td class="px-4 py-3 text-right tabular-nums">{{ r.bestPercent === undefined ? '—' : `${r.bestPercent}%` }}</td>
              <td class="px-4 py-3">
                <RouterLink v-if="r.certificateId" :to="{ name: 'certificate', params: { id: r.certificateId } }" class="font-bold text-brand-600 hover:underline dark:text-brand-300">
                  🎓 {{ date(r.passedAt) }}
                </RouterLink>
                <span v-else>—</span>
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-ink-500">{{ t('trainings.noRows') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.bar {
  transition: width 0.9s cubic-bezier(0.2, 0.9, 0.3, 1);
}
</style>
