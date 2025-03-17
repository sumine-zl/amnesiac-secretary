<script setup>
import { ref } from 'vue';

const props = defineProps({
    title: {
        type: String,
        default: 'Alert',
    },
    message: {
        type: String,
        default: '',
    },
});

const emit = defineEmits([
    'close'
]);

function close() {
    emit('close');
}
</script>

<template>
<dialog>
    <article>
        <header>
            <p>
                <strong>{{title}}</strong>
            </p>
        </header>
        <section v-if="$slots.content">
            <slot name="content"></slot>
        </section>
        <section v-else>
            <p>{{message}}</p>
        </section>
        <footer class="grid">
            <slot name="control"></slot>
            <button class="secondary" @click="close">Close</button>
        </footer>
    </article>
</dialog>
</template>

<style scoped>
</style>
