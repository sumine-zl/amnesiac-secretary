<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    show: { type: Boolean, default: false },
    message: { type: String, default: '' },
    requireText: { type: String, default: '' },
});

const emit = defineEmits(['confirm', 'cancel']);

const typedText = ref('');

const dialogRef = ref(null);

watch(() => props.show, (val) => {
    if (val) {
        typedText.value = '';
        dialogRef.value?.showModal();
    } else {
        dialogRef.value?.close();
    }
});

function confirm() {
    if (props.requireText && typedText.value !== props.requireText) return;
    emit('confirm');
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
                <p><strong>Confirm</strong></p>
            </header>
            <section>
                <p>{{ message }}</p>
                <div v-if="requireText">
                    <label>Type <kbd>{{ requireText }}</kbd> to confirm:</label>
                    <input type="text" v-model="typedText" @keyup.enter="confirm" />
                </div>
            </section>
            <footer class="grid">
                <button @click="confirm" :disabled="!!requireText && typedText !== requireText">Confirm</button>
                <button class="secondary" @click="cancel">Cancel</button>
            </footer>
        </article>
    </dialog>
</template>