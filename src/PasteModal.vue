<script setup>
import { ref, watch } from "vue";

const props = defineProps({
    show: { type: Boolean, default: false },
});

const emit = defineEmits(["pasted", "cancel"]);

const textarea = ref("");
const error = ref("");

const dialogRef = ref(null);

watch(
    () => props.show,
    (val) => {
        if (val) {
            textarea.value = "";
            error.value = "";
            dialogRef.value?.showModal();
        } else {
            dialogRef.value?.close();
        }
    },
);

function paste() {
    const text = textarea.value.trim();
    if (!text) return;
    if (text.length < 40) {
        error.value = "Invalid ciphertext (context too short)";
        return;
    }
    try {
        atob(text);
    } catch {
        error.value = "Invalid ciphertext (not valid base64)";
        return;
    }
    emit("pasted", text);
}

function cancel() {
    emit("cancel");
}

function onDialogClick(e) {
    if (e.target === dialogRef.value) cancel();
}
</script>

<template>
    <dialog ref="dialogRef" @click="onDialogClick">
        <article>
            <header>
                <p><strong>Paste Ciphertext</strong></p>
            </header>
            <section>
                <p v-if="error" style="color: crimson">{{ error }}</p>
                <label for="paste-area">Paste ciphertext below:</label>
                <textarea
                    id="paste-area"
                    v-model="textarea"
                    rows="6"
                    placeholder="Paste ciphertext here"
                ></textarea>
            </section>
            <footer class="grid">
                <button @click="paste" :disabled="!textarea.trim()">
                    Apply
                </button>
                <button class="secondary" @click="cancel">Cancel</button>
            </footer>
        </article>
    </dialog>
</template>
