<script setup lang="ts">
import { useRoute } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import ConfettiLayer from '@/components/ConfettiLayer.vue';
import ToastHost from '@/components/ToastHost.vue';

const route = useRoute();
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader v-if="!route.meta.fullscreen" />
    <main class="flex-1">
      <RouterView v-slot="{ Component, route: current }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="current.path" />
        </Transition>
      </RouterView>
    </main>
    <ToastHost />
    <ConfettiLayer />
  </div>
</template>
