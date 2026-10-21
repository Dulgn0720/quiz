import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { useTheme } from './composables/useTheme';
import { installAudioUnlock } from './game/sound';
import { i18n } from './i18n';
import { router } from './router';
import './styles/main.css';

useTheme();
installAudioUnlock();

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app');
