// index.js
import { createApp } from 'vue'
import IndexApp from './IndexApp.vue'
import '@picocss/pico';
import './res/picocss-fixes.css'
import './res/common.css'

createApp( IndexApp ).mount('#app')
