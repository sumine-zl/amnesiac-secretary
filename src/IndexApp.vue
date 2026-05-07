<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { version as VERSION } from '../package.json';
import Secretary from './lib/Secretary.js';
import { APPLICATION_NAME, SOURCE_REPO } from './constants.js';
import VaultTab from './VaultTab.vue';
import GeneratorTab from './GeneratorTab.vue';
import CopyModal from './CopyModal.vue';
import PasteModal from './PasteModal.vue';

const HOSTNAME = window.location.hostname;

const features = computed(() => ({
    compress: Secretary.testCompressionSupport(),
    crypto: Secretary.testCryptoSupport(),
}));

const unlocked = ref(false);
const activeTab = ref(0);
const ciphertext = ref('');
const preferences = ref([]);
const exportedOnce = ref(false);
const lastImportSource = ref(null);

const showPasteModal = ref(false);
const showCopyModal = ref(false);
const secretToShow = ref('');

onMounted(() => {
    document.title = `${APPLICATION_NAME} v${VERSION}`;
    const savedCt = localStorage.getItem('ciphertext');
    if (savedCt) ciphertext.value = savedCt;
});

watch(preferences, async (val) => {
    if (Secretary.isUnlocked()) {
        await Secretary.setData('prefs', val);
        const newCt = await Secretary.encode('');
        ciphertext.value = newCt;
        localStorage.setItem('ciphertext', newCt);
    }
    exportedOnce.value = false;
}, { deep: true });

watch([ciphertext, unlocked], () => {
    if (ciphertext.value) {
        if (/^[A-Za-z0-9+/]+=*$/.test(ciphertext.value)) {
            localStorage.setItem('ciphertext', ciphertext.value);
        }
    } else {
        localStorage.removeItem('ciphertext');
    }
});

function onUnlockedChange(val, fromCreation) {
    unlocked.value = val;
    if (val) lastImportSource.value = null;
    if (val) activeTab.value = fromCreation ? 1 : 0;
}

function onCiphertextChange(val) {
    ciphertext.value = val;
    lastImportSource.value = 'import';
    exportedOnce.value = false;
}

function onPreferencesChange(val) {
    preferences.value = val;
}

function onExported() {
    exportedOnce.value = true;
}

function onClear() {
    unlocked.value = false;
    ciphertext.value = '';
    preferences.value = [];
    exportedOnce.value = false;
    lastImportSource.value = null;
    localStorage.removeItem('ciphertext');
}

function onGeneratedSecret(secret) {
    secretToShow.value = secret;
    showCopyModal.value = true;
}

function onCopyModalClose() {
    showCopyModal.value = false;
    secretToShow.value = '';
}

function onPasteRequest() {
    showPasteModal.value = true;
}

function onPasted(data) {
    showPasteModal.value = false;
    if (!data) return;
    ciphertext.value = data;
    lastImportSource.value = 'paste';
    exportedOnce.value = false;
}

function onPasteCancel() {
    showPasteModal.value = false;
}
</script>

<template>
    <div v-if="!features.crypto">Your browser does not support WebCrypto, please try with another one</div>
    <div v-else-if="!features.compress">Your browser does not support CompressionStream, please try with another one
    </div>
    <main class="container" v-else>
        <article class="demo-warning" v-show="HOSTNAME === 'sumine-zl.github.io'">
            <span>This page is for demonstration only. For security, please build from the <a target="_blank"
                    :href="SOURCE_REPO">source repo</a> and run it by yourself.</span>
        </article>

        <article class="main-frame">
            <nav role="tablist" class="tab-bar">
                <a role="tab" :aria-selected="activeTab === 0" :class="{ active: activeTab === 0 }"
                    @click="activeTab = 0" href="#">Vault</a>
                <a role="tab" :aria-selected="activeTab === 1" :class="[{ active: activeTab === 1 }, { disabled: !unlocked }]"
                    :aria-disabled="!unlocked" @click.prevent="unlocked && (activeTab = 1)"
                    href="#">Generator</a>
            </nav>

            <div v-show="activeTab === 0" role="tabpanel">
                <VaultTab :ciphertext="ciphertext" :preferences="preferences" :unlocked="unlocked"
                    :exportedOnce="exportedOnce" :lastImportSource="lastImportSource"
                    @unlocked-change="onUnlockedChange" @ciphertext-change="onCiphertextChange"
                    @preferences-change="onPreferencesChange" @exported="onExported" @clear="onClear"
                    @request-paste="onPasteRequest" />
            </div>

            <div v-show="activeTab === 1" role="tabpanel">
                <GeneratorTab :preferences="preferences" :unlocked="unlocked" @preferences-change="onPreferencesChange"
                    @generated-secret="onGeneratedSecret" />
            </div>
        </article>

        <footer class="annotation">
            <hr class="separator" />
            <section>
                <small class="footnote">Copyright &copy; 2024-2026 Sumine ZL</small>
                <small class="footnote right">Amnesiac Secretary v{{ VERSION }} (<a target="_blank"
                        :href="SOURCE_REPO">Source Code</a>)</small>
            </section>
        </footer>
    </main>

    <CopyModal :show="showCopyModal" :secret="secretToShow" @close="onCopyModalClose" @copied="() => { }" />

    <PasteModal :show="showPasteModal" @pasted="onPasted" @cancel="onPasteCancel" />
</template>

<style scoped>
.demo-warning {
    background-color: gold;
    font-size: 0.8em;
}

.tab-bar {
    display: flex;
    border-bottom: 2px solid #ccc;
    margin-bottom: 1.5rem;
    gap: 0;
}

.tab-bar a {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    background: none !important;
    border-top: none !important;
    border-left: none !important;
    border-right: none !important;
    border-radius: 0;
    color: #666;
    margin: 0;
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-size: inherit;
    margin-bottom: -2px;
    border-bottom: 2px solid transparent;
    transition: border-color 0.2s, color 0.2s;
}

.tab-bar a:hover:not(.disabled) {
    border-bottom-color: #999 !important;
    background: none !important;
}

.tab-bar a.active:hover {
    border-bottom-color: #0066cc !important;
    color: #0066cc !important;
}

.tab-bar a.active {
    color: #0066cc !important;
    border-bottom-color: #0066cc !important;
    border-bottom-style: solid !important;
}

.tab-bar a.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.footnote {
    color: grey;
    font-size: 14px;
}

.footnote.right {
    float: right;
}

body.electron main.container {
    padding: var(--pico-spacing);
    margin-top: 0;
    margin-left: auto;
    margin-right: auto;
}

body.electron article.main-frame {
    margin: 0;
    padding: 0;
}

body.electron footer.annotation {
    display: none;
}
</style>