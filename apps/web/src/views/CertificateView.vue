<script setup lang="ts">
import type { TrainingCertificate } from '@quiz/shared';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { trainingsApi } from '@/api/trainings';
import BrandMark from '@/components/BrandMark.vue';
import Mascot from '@/components/Mascot.vue';

/** A printable training certificate (A4 landscape); "Save as PDF" in the print dialog makes the file. */
const props = defineProps<{ id: string }>();
const { t } = useI18n();

const cert = ref<TrainingCertificate | null>(null);
const failed = ref(false);

onMounted(async () => {
  try {
    cert.value = await trainingsApi.certificate(props.id);
  } catch {
    failed.value = true;
  }
});

const date = (iso: string) => {
  const d = new Date(iso);
  return t('certificate.date', { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
};

function print(): void {
  window.print();
}
</script>

<template>
  <div class="cert-page min-h-dvh bg-ink-100 px-4 py-6 dark:bg-ink-950">
    <div class="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center gap-2">
      <RouterLink to="/trainings" class="btn-ghost mr-auto">← {{ t('trainings.title') }}</RouterLink>
      <button v-if="cert" type="button" class="btn-primary" @click="print">🖨️ {{ t('certificate.print') }}</button>
    </div>

    <div v-if="failed" class="card mx-auto max-w-md p-8 text-center">
      <div class="flex justify-center"><Mascot mood="dizzy" :size="120" /></div>
      <p class="mt-4 text-lg font-bold">{{ t('certificate.missing') }}</p>
    </div>
    <div v-else-if="!cert" class="mx-auto aspect-[297/210] max-w-5xl animate-pulse rounded-3xl bg-white/60" aria-hidden="true" />

    <article v-else class="certificate mx-auto aspect-[297/210] max-w-5xl">
      <div class="frame">
        <div class="corner corner-tl" aria-hidden="true" />
        <div class="corner corner-tr" aria-hidden="true" />
        <div class="corner corner-bl" aria-hidden="true" />
        <div class="corner corner-br" aria-hidden="true" />

        <header class="flex items-center justify-center gap-3">
          <BrandMark :size="44" />
          <span class="font-display text-xl font-bold tracking-wide text-ink-900">Agula Quiz</span>
        </header>

        <h1 class="title font-display">{{ t('certificate.title') }}</h1>
        <p class="lead">{{ t('certificate.awardedTo') }}</p>
        <p class="name font-display">{{ cert.displayName }}</p>
        <p v-if="cert.department" class="dept">{{ cert.department }}</p>
        <p class="body">{{ t('certificate.body', { title: cert.trainingTitle, n: cert.percent }) }}</p>

        <footer class="footer">
          <div>
            <p class="label">{{ t('certificate.issued') }}</p>
            <p class="value">{{ date(cert.passedAt) }}</p>
          </div>
          <div class="seal" aria-hidden="true">
            <span class="seal-inner">🏅<br /><span class="seal-text">{{ cert.percent }}%</span></span>
          </div>
          <div class="text-right">
            <p class="label">{{ t('certificate.number') }}</p>
            <p class="value font-mono text-xs">{{ cert.certificateId }}</p>
          </div>
        </footer>
        <div class="mascot" aria-hidden="true"><Mascot mood="cool" :size="96" outfit="scarf" /></div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.certificate {
  background: #fffaf3;
  border-radius: 1.5rem;
  box-shadow: 0 30px 80px -30px rgb(10 14 32 / 0.45);
  padding: 2.5%;
  color: #0a0e20;
  container-type: inline-size;
  animation: cert-in 0.7s cubic-bezier(0.2, 1.2, 0.4, 1) both;
}
.frame {
  position: relative;
  height: 100%;
  border: 3px solid #f57c14;
  outline: 1px solid #f57c14;
  outline-offset: 6px;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 50% 0%, rgb(245 124 20 / 0.1), transparent 55%),
    repeating-linear-gradient(45deg, transparent 0 22px, rgb(245 124 20 / 0.035) 22px 23px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4% 8%;
  gap: 1.2cqi;
}
.corner {
  position: absolute;
  width: 7cqi;
  height: 7cqi;
  border-color: #e2630a;
  border-style: solid;
}
.corner-tl {
  top: 1.2cqi;
  left: 1.2cqi;
  border-width: 4px 0 0 4px;
}
.corner-tr {
  top: 1.2cqi;
  right: 1.2cqi;
  border-width: 4px 4px 0 0;
}
.corner-bl {
  bottom: 1.2cqi;
  left: 1.2cqi;
  border-width: 0 0 4px 4px;
}
.corner-br {
  bottom: 1.2cqi;
  right: 1.2cqi;
  border-width: 0 4px 4px 0;
}
.title {
  font-size: 6cqi;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #e2630a;
  line-height: 1.1;
}
.lead {
  font-size: 1.8cqi;
  color: #4a5068;
}
.name {
  font-size: 4.6cqi;
  font-weight: 700;
  border-bottom: 2px solid rgb(245 124 20 / 0.5);
  padding: 0 4cqi 0.6cqi;
}
.dept {
  font-size: 1.7cqi;
  font-weight: 700;
  color: #4a5068;
}
.body {
  max-width: 70cqi;
  font-size: 2cqi;
  line-height: 1.5;
}
.footer {
  margin-top: 2cqi;
  display: grid;
  width: 100%;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: 2cqi;
  text-align: left;
}
.label {
  font-size: 1.3cqi;
  color: #6b7085;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.value {
  font-size: 1.7cqi;
  font-weight: 700;
}
.seal {
  width: 12cqi;
  height: 12cqi;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  background: radial-gradient(circle, #fcd34d, #f59e0b 65%, #d97706);
  box-shadow:
    0 0 0 4px #fff7e6,
    0 0 0 6px #f59e0b;
  animation: seal-spin 1.1s 0.4s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.seal-inner {
  font-size: 3.4cqi;
  line-height: 1;
  text-align: center;
}
.seal-text {
  font-size: 1.6cqi;
  font-weight: 800;
  color: #7c2d12;
}
.mascot {
  position: absolute;
  right: 3%;
  top: 6%;
  opacity: 0.95;
}
@keyframes cert-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }
}
@keyframes seal-spin {
  from {
    transform: scale(0) rotate(-180deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .certificate,
  .seal {
    animation: none;
  }
}
@media print {
  @page {
    size: A4 landscape;
    margin: 0;
  }
  .no-print {
    display: none !important;
  }
  .cert-page {
    background: white !important;
    padding: 0 !important;
  }
  .certificate {
    max-width: none;
    width: 297mm;
    height: 210mm;
    border-radius: 0;
    box-shadow: none;
    animation: none;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
</style>
