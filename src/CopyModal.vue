<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    show: { type: Boolean, default: false },
    secret: { type: String, default: '' },
});

const emit = defineEmits(['close', 'copied']);

const showSecret = ref(false);
const copied = ref(false);
const dialogRef = ref(null);

watch(() => props.show, (val) => {
    if (val) {
        showSecret.value = false;
        copied.value = false;
        dialogRef.value?.showModal();
    } else {
        dialogRef.value?.close();
        navigator.clipboard.writeText('');
    }
});

function copy() {
    navigator.clipboard.writeText(props.secret);
    copied.value = true;
    emit('copied');
}

function close() {
    emit('close');
}

function onDialogClick(e) {
    if (e.target === dialogRef.value) close();
}
</script>

<template>
    <dialog ref="dialogRef" @click="onDialogClick">
        <article>
            <header>
                <p><strong>Generated Secret</strong></p>
            </header>
            <section>
                <input :type="showSecret ? 'text' : 'password'" :value="secret" readonly />
                <p v-if="!showSecret">Make sure no one is looking!</p>
                <p v-if="copied">Copied to clipboard!</p>
                <p><small>Clipboard will be cleared when this dialog is closed.</small></p>
            </section>
            <footer class="grid">
                <button @click="copy">Copy to Clipboard</button>
                <button class="danger" @click="showSecret = !showSecret">{{ showSecret ? 'Hide' : 'Show' }}</button>
                <button class="secondary" @click="close">Close</button>
            </footer>
        </article>
    </dialog>
</template>