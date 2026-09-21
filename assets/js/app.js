import { createApp } from 'vue';
import { router } from './router/router.js';

const App = {
  template: `<router-view />`,
};

createApp(App).use(router).mount('#app');
