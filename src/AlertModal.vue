<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    show: { type: Boolean, default: false },
    message: { type: String, default: '' },
});

const emit = defineEmits(['ok']);

const dialogRef = ref(null);

watch(() => props.show, (val) => {
    if (val) {
        dialogRef.value?.showModal();
    } else {
        dialogRef.value?.close();
    }
});

function ok() {
    emit('ok');
}

function onDialogClick(e) {
    if (e.target === dialogRef.value) ok();
}
</script>

<template>
    <dialog ref="dialogRef" @click="onDialogClick">
        <article>
            <header>
                <p><strong>Alert</strong></p>
            </header>
            <section>
                <p>{{ message }}</p>
            </section>
            <footer class="grid">
                <button @click="ok">OK</button>
            </footer>
        </article>
    </dialog>
</template>