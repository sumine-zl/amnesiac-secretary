<script setup>
import { ref, computed } from 'vue';
import { STRENGTH_VALUE_MAP } from './constants.js';

const props = defineProps({
    preferences: { type: Array, default: () => [] },
});

const emit = defineEmits(['select-entry', 'remove-entry']);

const search = ref('');
const sortKey = ref(-1);
const sortDesc = ref(false);

const filtered = computed(() => {
    let data = props.preferences.slice();
    const q = search.value.toLowerCase();
    if (q) {
        data = data.filter(v => v[0].toLowerCase().includes(q) || v[1].toLowerCase().includes(q));
    }
    if (sortKey.value >= 0) {
        data.sort((a, b) => {
            const cmp = a[sortKey.value].localeCompare(b[sortKey.value]);
            return sortDesc.value ? -cmp : cmp;
        });
    }
    return data;
});

function toggleSort(idx) {
    if (sortKey.value === idx) {
        sortDesc.value = !sortDesc.value;
    } else {
        sortKey.value = idx;
        sortDesc.value = false;
    }
}

function strengthLabel(val) {
    const idx = STRENGTH_VALUE_MAP.indexOf(val);
    return idx >= 0 ? String(val) : String(val);
}
</script>

<template>
    <div class="preference-list">
        <input type="search" class="search-box" v-model="search" placeholder="Search by service or user..." />
        <div v-if="!filtered.length" class="footnote">No preferences found.</div>
        <table v-else>
            <thead>
                <tr>
                    <th><a href="#" @click.prevent="toggleSort(0)">Service{{ sortKey === 0 ? (sortDesc ? ' ↑' : ' ↓') :
                        '' }}</a></th>
                    <th><a href="#" @click.prevent="toggleSort(1)">User{{ sortKey === 1 ? (sortDesc ? ' ↑' : ' ↓') : ''
                    }}</a></th>
                    <th>Rev</th>
                    <th>Len</th>
                    <th>Strength</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(v, i) in filtered" :key="i">
                    <td><a href="#" @click.prevent="emit('select-entry', v)">{{ v[0] }}</a></td>
                    <td><a href="#" @click.prevent="emit('select-entry', v)">{{ v[1] }}</a></td>
                    <td>{{ v[2] }}</td>
                    <td>{{ v[3] }}</td>
                    <td>{{ strengthLabel(v[4]) }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.preference-list table {
    font-size: 0.9em;
}

.preference-list a {
    text-decoration: none;
}

.preference-list a:hover {
    text-decoration: underline;
}

a.danger-link {
    color: crimson;
}

body.electron .preference-list {
    max-height: 70vh;
    overflow-y: auto;
}

body.electron .search-box {
    border-radius: 0.25rem;
    background-image: none;
    padding-inline: 1rem;
}

body.electron .preference-list table th:nth-child(n+3),
body.electron .preference-list table td:nth-child(n+3) {
    display: none;
}
</style>
