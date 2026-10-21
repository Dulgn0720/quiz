<script setup lang="ts">
import { useRoute } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import ToastHost from '@/components/ToastHost.vue';

const route = useRoute();
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader v-if="!route.meta.fullscreen" />
    <main class="flex-1">
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>
