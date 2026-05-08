<script setup>
import { ref, watch } from 'vue';
import Secretary from './lib/Secretary.js';

const props = defineProps({
    show: { type: Boolean, default: false },
    ciphertext: { type: String, default: '' },
});

const emit = defineEmits(['ciphertext-change', 'cancel']);

const dialogRef = ref(null);
const currentPass = ref('');
const newPass = ref('');
const confirmPass = ref('');
const error = ref('');
const working = ref(false);

watch(() => props.show, (val) => {
    if (val) {
        currentPass.value = '';
        newPass.value = '';
        confirmPass.value = '';
        error.value = '';
        working.value = false;
        dialogRef.value?.showModal();
    } else {
        dialogRef.value?.close();
    }
});

async function confirm() {
    if (newPass.value.length < 8) {
        error.value = 'Passphrase must be at least 8 characters';
        return;
    }
    if (newPass.value !== confirmPass.value) {
        error.value = 'Passphrases do not match';
        return;
    }
    error.value = '';
    working.value = true;
    try {
        const valid = await Secretary.verifyPassphrase(currentPass.value, props.ciphertext);
        if (!valid) {
            error.value = 'Current passphrase is incorrect';
            working.value = false;
            return;
        }
        const newCt = await Secretary.encode(newPass.value);
        const isUnlocked = await Secretary.unlock(newPass.value, newCt);
        if (!isUnlocked) {
            error.value = 'Failed to unlock with the new passphrase';
            working.value = false;
            return;
        }
        emit('ciphertext-change', newCt);
    } catch {
        working.value = false;
    }
}

function cancel() {
    emit('cancel');
}

function onDialogClick(e) {
    if (e.target === dialogRef.value) cancel();
}
</script>

<template>
    <dialog ref="dialogRef" @click="onDialogClick">
        <article>
            <header>
                <p><strong>Change Passphrase</strong></p>
            </header>
            <section>
                <p v-if="error" style="color:crimson">{{ error }}</p>
                <label for="current-pass">Current passphrase:</label>
                <input id="current-pass" type="password" v-model="currentPass" placeholder="Enter current passphrase" />
                <label for="new-pass">New passphrase:</label>
                <input id="new-pass" type="password" v-model="newPass" placeholder="At least 8 characters" />
                <label for="confirm-pass">Confirm new passphrase:</label>
                <input id="confirm-pass" type="password" v-model="confirmPass" placeholder="Repeat the passphrase" />
            </section>
            <footer class="grid">
                <button :aria-busy="working" @click="confirm">Change Passphrase</button>
                <button class="secondary" @click="cancel">Cancel</button>
            </footer>
        </article>
    </dialog>
</template>
