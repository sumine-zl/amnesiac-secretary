<script setup>
import { ref, computed, watch } from "vue";
import Secretary from "./lib/Secretary.js";
import {
    INPUT_MAX_REVISION,
    INPUT_MAX_LENGTH,
    STRENGTH_VALUE_MAP,
} from "./constants.js";
import PreferenceList from "./PreferenceList.vue";
import ConfirmModal from "./ConfirmModal.vue";

const props = defineProps({
    preferences: { type: Array, default: () => [] },
    unlocked: { type: Boolean, default: false },
});

const emit = defineEmits(["preferences-change", "generated-secret"]);

const service = ref("");
const user = ref("");
const revision = ref(0);
const length = ref(12);
const strengthIndex = ref(STRENGTH_VALUE_MAP.indexOf(91));

const generating = ref(false);
const showConfirmRemove = ref(false);
const showConfirmUpdate = ref(false);
const pendingUpdate = ref(null);
const removeTarget = ref(null);

const inputDisabled = computed(() => !props.unlocked || generating.value);

const canGenerate = computed(
    () =>
        props.unlocked && !!service.value && !!user.value && !generating.value,
);

const strengthValue = computed(() => STRENGTH_VALUE_MAP[strengthIndex.value]);

const strengthDesc = computed(() => {
    const descs = [
        "Only numbers from 0 to 9 (not recommended)",
        "Numbers and lowercase letters",
        "Numbers, uppercase and lowercase letters",
        "Numbers, letters, special characters excluding Space, Quotes, and Backslash",
        "Numbers, letters, special characters excluding Space",
        "Numbers, letters, special characters including Space (use with caution)",
    ];
    return descs[strengthIndex.value] || "";
});

const matchIndex = computed(() => {
    if (!service.value || !user.value) return -1;
    for (let i = 0; i < props.preferences.length; i++) {
        const v = props.preferences[i];
        if (v[0] === service.value && v[1] === user.value) return i;
    }
    return -1;
});

const canForget = computed(() => matchIndex.value >= 0 && !generating.value);

watch(
    () => props.unlocked,
    (val) => {
        if (!val) resetForm();
    },
);

function autofillForm() {
    if (user.value) return;
    for (const v of props.preferences) {
        if (v[0] === service.value) {
            user.value = v[1];
            revision.value = v[2];
            length.value = v[3];
            strengthIndex.value = STRENGTH_VALUE_MAP.indexOf(v[4]);
            return;
        }
    }
}

async function generateSecret() {
    if (!service.value) return;
    if (!user.value) return;
    generating.value = true;
    try {
        const secret = await Secretary.generate(
            service.value,
            user.value,
            revision.value,
            length.value,
            STRENGTH_VALUE_MAP[strengthIndex.value],
        );
        emit("generated-secret", secret);
    } catch {
        generating.value = false;
        return;
    }
    generating.value = false;
}

function doSave(prefs) {
    emit("preferences-change", prefs);
}

function save() {
    if (!service.value || !user.value) return;
    const prefs = [...props.preferences];
    let hit = false;
    for (let i = 0; i < prefs.length; i++) {
        if (prefs[i][0] === service.value && prefs[i][1] === user.value) {
            pendingUpdate.value = i;
            showConfirmUpdate.value = true;
            hit = true;
            break;
        }
    }
    if (!hit) {
        prefs.splice(0, 0, [
            service.value,
            user.value,
            revision.value,
            length.value,
            STRENGTH_VALUE_MAP[strengthIndex.value],
        ]);
        doSave(prefs);
    }
}

function confirmUpdate() {
    showConfirmUpdate.value = false;
    if (pendingUpdate.value === null) return;
    const prefs = [...props.preferences];
    prefs[pendingUpdate.value] = [
        service.value,
        user.value,
        revision.value,
        length.value,
        STRENGTH_VALUE_MAP[strengthIndex.value],
    ];
    pendingUpdate.value = null;
    doSave(prefs);
}

function cancelUpdate() {
    showConfirmUpdate.value = false;
    pendingUpdate.value = null;
}

function resetForm() {
    service.value = "";
    user.value = "";
    revision.value = 0;
    length.value = 12;
    strengthIndex.value = STRENGTH_VALUE_MAP.indexOf(91);
}

function requestForget() {
    if (matchIndex.value < 0) return;
    removeTarget.value = props.preferences[matchIndex.value];
    showConfirmRemove.value = true;
}

function confirmForget() {
    showConfirmRemove.value = false;
    if (!removeTarget.value) return;
    const prefs = props.preferences.filter(
        (v) =>
            !(v[0] === removeTarget.value[0] && v[1] === removeTarget.value[1]),
    );
    emit("preferences-change", prefs);
    removeTarget.value = null;
}

function cancelForget() {
    showConfirmRemove.value = false;
    removeTarget.value = null;
}

function selectEntry(v) {
    service.value = v[0];
    user.value = v[1];
    revision.value = v[2];
    length.value = v[3];
    strengthIndex.value = STRENGTH_VALUE_MAP.indexOf(v[4]);
    window.scrollTo(0, 0);
}
</script>

<template>
    <div class="generator-layout">
        <section class="generator-form">
            <fieldset>
                <label>Service identity, case-sensitive:</label>
                <input
                    type="text"
                    v-model.trim="service"
                    :disabled="inputDisabled"
                    placeholder="Domain Name / Software Title / etc."
                    @input="autofillForm()"
                />
                <label>User identity, case-sensitive:</label>
                <input
                    type="text"
                    v-model.trim="user"
                    :disabled="inputDisabled"
                    placeholder="Username / Email / etc."
                />
                <label
                    >Revision: <strong>{{ revision }}</strong></label
                >
                <input
                    type="range"
                    min="0"
                    :max="INPUT_MAX_REVISION"
                    v-model.number="revision"
                    :disabled="inputDisabled"
                />
                <label
                    >Length: <strong>{{ length }}</strong></label
                >
                <input
                    type="range"
                    min="8"
                    :max="INPUT_MAX_LENGTH"
                    v-model.number="length"
                    :disabled="inputDisabled"
                />
                <label
                    >Strength: <strong>{{ strengthValue }}</strong></label
                >
                <input
                    type="range"
                    min="0"
                    :max="STRENGTH_VALUE_MAP.length - 1"
                    v-model.number="strengthIndex"
                    :disabled="inputDisabled"
                />
                <small>{{ strengthDesc }}</small>
                <div class="grid">
                    <button
                        :disabled="!canGenerate"
                        :aria-busy="generating"
                        @click="generateSecret"
                    >
                        Generate
                    </button>
                    <button
                        :disabled="!canGenerate || generating"
                        class="outline"
                        @click="save"
                    >
                        Save
                    </button>
                    <button
                        :disabled="!canForget"
                        class="danger"
                        @click="requestForget"
                    >
                        Forget
                    </button>
                    <button
                        class="outline"
                        :disabled="inputDisabled"
                        @click="resetForm"
                    >
                        Reset
                    </button>
                </div>
            </fieldset>
        </section>
        <hr class="form-prefs-sep" />
        <section class="generator-prefs">
            <h5>Preferences</h5>
            <PreferenceList
                :preferences="preferences"
                @select-entry="selectEntry"
                @remove-entry="
                    (v) => {
                        removeTarget = v;
                        showConfirmRemove = true;
                    }
                "
            />
        </section>
    </div>
    <ConfirmModal
        :show="showConfirmRemove"
        message="Are you sure you want to forget this preference? Type CONFIRM to proceed."
        requireText="CONFIRM"
        @confirm="confirmForget"
        @cancel="cancelForget"
    />
    <ConfirmModal
        :show="showConfirmUpdate"
        message="A preference for this service and user already exists. Update it with the current settings?"
        @confirm="confirmUpdate"
        @cancel="cancelUpdate"
    />
</template>

<style scoped>
.generator-layout {
    display: block;
}

.generator-form {
    min-width: 0;
    grid-area: form;
}

.generator-prefs {
    min-width: 0;
    grid-area: perfs;
}

hr.form-prefs-sep {
    margin-top: 1.5rem;
}

body.electron .generator-layout {
    display: grid;
    grid-template-columns: 1fr 2fr;
    grid-template-areas: "perfs form";
    gap: var(--pico-spacing);
}

body.electron .generator-prefs {
    border-right: 1px solid var(--pico-table-border-color);
    padding-right: 1rem;
}

body.electron .generator-prefs h5 {
    font-weight: normal;
    margin-bottom: 0.5rem;
}

body.electron hr.form-prefs-sep {
    display: none;
}
</style>
