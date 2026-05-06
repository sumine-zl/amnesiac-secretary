// index.js
import { createApp } from "vue";
import IndexApp from "./IndexApp.vue";
import "@picocss/pico";
import "./res/custom.css";

if (window.electronAPI) {
    document.body.classList.add("electron");
}

createApp(IndexApp).mount("#app");
