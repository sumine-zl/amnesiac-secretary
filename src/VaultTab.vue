<script setup>
import { ref, computed, watch } from 'vue';
import Secretary from './lib/Secretary.js';
import { INPUT_MAX_CIPHER_LENGTH } from './constants.js';
import ChangePassphraseModal from './ChangePassphraseModal.vue';
import ConfirmModal from './ConfirmModal.vue';
import AlertModal from './AlertModal.vue';

const props = defineProps({
    ciphertext: { type: String, default: '' },
    preferences: { type: Array, default: () => [] },
    unlocked: { type: Boolean, default: false },
    exportedOnce: { type: Boolean, default: false },
    lastImportSource: { type: [String, null], default: null },
});

const emit = defineEmits([
    'unlocked-change',
    'ciphertext-change',
    'preferences-change',
    'exported',
    'clear',
    'request-paste',
]);

const passphrase = ref('');
const cipherLength = ref(1024);
const unlocking = ref(false);
const error = ref('');

const showChangePass = ref(false);
const showDeleteConfirm = ref(false);
const showExportAlert = ref(false);

const isElectron = computed(() => !!window.electronAPI);
const hasCiphertext = computed(() => !!props.ciphertext);
const chosenBitLength = computed(() => {
    if (props.ciphertext) return 'N/A, existing ciphertext will be used';
    return cipherLength.value;
});

watch(passphrase, () => { error.value = ''; });

async function unlock() {
    if (passphrase.value.length < 1) {
        error.value = 'Passphrase must be at least 8 characters';
        return;
    }
    error.value = '';
    unlocking.value = true;
    const ct = props.ciphertext;
    const pp = passphrase.value;
    passphrase.value = '';
    try {
        const result = await Secretary.unlock(pp, ct, cipherLength.value);
        if (!result) throw new Error();
        emit('unlocked-change', true, true);
        const savedPrefs = await Secretary.getData('prefs');
        if (savedPrefs !== undefined && Array.isArray(savedPrefs)) {
            emit('preferences-change', savedPrefs);
        }
    } catch {
        error.value = 'Wrong passphrase or invalid ciphertext';
        unlocking.value = false;
        return;
    }
    unlocking.value = false;
}

function lock() {
    Secretary.reset();
    emit('unlocked-change', false);
}

async function exportBundle() {
    try {
        let ct;
        if (props.unlocked) {
            ct = await Secretary.encode('');
        } else {
            ct = props.ciphertext;
        }
        await saveOrDownload(ct);
        emit('exported');
    } catch {
        return;
    }
}

async function saveOrDownload(content) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const filename = `Vault-${year}${month}${day}_${hours}${minutes}${seconds}.txt`;
    if (isElectron.value) {
        await window.electronAPI.saveFile(content, filename);
    } else {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function getFormattedDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

async function generateNewVault() {
    if (passphrase.value.length < 8) {
        error.value = 'Passphrase must be at least 8 characters';
        return;
    }
    error.value = '';
    unlocking.value = true;
    const pp = passphrase.value;
    passphrase.value = '';
    try {
        await Secretary.unlock(pp, '', cipherLength.value);
        await Secretary.setData('prefs', []);
        const ct = await Secretary.encode('');
        emit('ciphertext-change', ct);
        emit('unlocked-change', true, true);
    } catch {
        unlocking.value = false;
        return;
    }
    unlocking.value = false;
}

function requestDelete() {
    if (props.exportedOnce) {
        showDeleteConfirm.value = true;
    } else {
        showExportAlert.value = true;
    }
}

function confirmDelete() {
    showDeleteConfirm.value = false;
    doDelete();
}

function dismissExportAlert() {
    showExportAlert.value = false;
}

function doDelete() {
    Secretary.reset();
    emit('clear');
}

function cancelDelete() {
    showDeleteConfirm.value = false;
}

async function handleImport() {
    async function processContent(text) {
        emit('ciphertext-change', text.trim());
    }
    if (isElectron.value) {
        const content = await window.electronAPI.openFile();
        if (content !== null && content !== undefined) {
            await processContent(content);
        }
    } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.json,*';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            const text = await file.text();
            await processContent(text);
        };
        input.click();
    }
}
</script>

<template>
    <div>
        <!-- State A: locked with ciphertext -->
        <section v-if="hasCiphertext && !unlocked">
            <fieldset>
                <p>Local vault found. Enter passphrase to unlock:</p>
                <input type="password" v-model="passphrase" required placeholder="The passphrase for this vault"
                    @keyup.enter="unlock" />
                <p v-if="error" style="color:crimson">{{ error }}</p>
                <div class="controls grid">
                    <button :aria-busy="unlocking" @click="unlock">Unlock</button>
                    <button class="outline" @click="exportBundle">Export</button>
                    <button class="outline danger" @click="requestDelete">Delete</button>
                </div>
            </fieldset>
        </section>

        <!-- State B: no ciphertext, not unlocked -->
        <section v-else-if="!hasCiphertext && !unlocked">
            <fieldset>
                <label>Bit length for new cipher: <strong>{{ cipherLength }}</strong></label>
                <input type="range" min="256" :max="INPUT_MAX_CIPHER_LENGTH" step="256" v-model.number="cipherLength" />
                <label>Enter a memorable passphrase:</label>
                <input type="password" v-model="passphrase" required placeholder="Choose a strong passphrase"
                    @keyup.enter="generateNewVault" />
                <small>You only need to remember this one passphrase. Do not save it anywhere.</small>
                <p v-if="error" style="color:crimson">{{ error }}</p>
                <div class="controls grid">
                    <button :aria-busy="unlocking" @click="generateNewVault">Create Vault</button>
                    <button class="outline" @click="handleImport">Import File</button>
                    <button class="outline" @click="$emit('request-paste')">Paste</button>
                </div>
            </fieldset>
        </section>

        <!-- State C: unlocked -->
        <section v-else-if="unlocked">
            <p>Vault is unlocked. You can now generate passwords in the Generator tab.</p>
            <p v-if="error" style="color:crimson">{{ error }}</p>
            <div class="controls grid">
                <button class="outline" @click="lock">Lock</button>
                <button @click="exportBundle">Export</button>
                <button @click="showChangePass = true">Change Passphrase</button>
                <button class="danger" @click="requestDelete">Delete</button>
            </div>
        </section>
    </div>
    <ChangePassphraseModal :show="showChangePass" :ciphertext="ciphertext"
        @ciphertext-change="showChangePass = false; $emit('ciphertext-change', $event)"
        @cancel="showChangePass = false" />
    <AlertModal :show="showExportAlert"
        message="You must export the current vault before deleting it. Please use the Export button first."
        @ok="dismissExportAlert" />
    <ConfirmModal :show="showDeleteConfirm" message="Are you sure you want to delete the vault?" requireText="DELETE"
        @confirm="confirmDelete" @cancel="cancelDelete" />
</template>