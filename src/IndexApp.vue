<script setup>
import { computed, onMounted, reactive } from 'vue';
import Util from './lib/Util.js';
import Secretary from './lib/Secretary.js';
import Dialog from './lib/Dialog.vue';
import {  version as VERSION } from '../package.json';

// Constants
const APPLICATION_NAME = 'Amnesiac Secretary';

// Configs
const INPUT_MAX_CIPHER_LENGTH = 4096;
const INPUT_MAX_REVISION = 15;
const INPUT_MAX_LENGTH = 32;
const STRENGTH_VALUE_MAP = [
    10, 36, 62, 91, 94, 95
];

// Defaults
const defaultState = {
    unlocked: false,
    unlocking: false,
    generating: false,
    showSecret: false,
    sortIndex: -1,
    sortDescend: false, // true for ascending
};
const defaultCredential = {
    cipherLength: 1024,
    ciphertext: '',
    passphrase: ''
};
const defaultInput = {
    service: '',
    user: '',
    revision: 0,
    length: 12,
    strengthIndex: STRENGTH_VALUE_MAP.indexOf( 91 ),
    newPass: ''
};
const defaultOutput = {
    secret: '',
    exportedText: ''
};

// States
const state = reactive( Object.assign({}, defaultState ));

// credentials
const credential = reactive( Object.assign({}, defaultCredential ));

// Inputs
const input = reactive( Object.assign({}, defaultInput ));

// Outputs
const output = reactive( Object.assign({}, defaultOutput ));

// Sorters
const sorters = reactive(['', '', '', '', '']);

// List of preferences
const preferences = reactive([]);

// Bit length for the new cipher
const chosenBitLength = computed(() => {
    return ( ! credential.ciphertext ? credential.cipherLength :
        'N/A, The existing ciphertext above will be used'
    );
});
// Check for browser features
const features = computed(() => {
    return {
        compress: Util.testCompressionSupport(),
        crypto: Secretary.testEnvironment()
    };
});
// Disable the inputs except unlock section while under computing
const inputDisabled = computed(() => {
    return !state.unlocked || state.generating;
});
// Strength value
const strengthValue = computed(() => {
    return STRENGTH_VALUE_MAP[ input.strengthIndex ];
});
// Strength description
const strengthDesc = computed(() => {
    return [
        'Only numbers from 0 to 9 (NOT RECOMMENDED)',
        'Numbers and lowercased alphabets',
        'Numbers, alphabets with both upper and lower cases',
        'Numbers, alphabets with all cases, special characters excluding Space, Double/Single Quotes, Backslash',
        'Numbers, alphabets with all cases, special characters excluding Space',
        'Numbers, alphabets with all cases, special characters including Space (BE CAUTION)'
    ][ input.strengthIndex ];
});
// Data table
const preferenceData = computed(() => {
    let data = preferences.slice( 0 );
    if ( state.sortIndex === -1 ) {
        return data;
    }
    if ( state.sortDescend ) {
        return data.sort(( a, b ) => {
            return a[ state.sortIndex ].localeCompare( b[ state.sortIndex ])
        });
    } else {
        return data.sort(( a, b ) => {
            return b[ state.sortIndex ].localeCompare( a[ state.sortIndex ])
        });
    }
});

// Dialogs
const alertDialog = reactive({
    show: false,
    message: ''
});
const confirmDialog = reactive({
    show: false,
    message: '',
    confirmed: false,
});
const secretDialog = reactive({
    show: false
});
// Dialog promise resolve
let dialogResolve = null;

function hideAllDialogs() {
    alertDialog.show = false;
    confirmDialog.show = false;
    secretDialog.show = false;
}

async function alert( msg ) {
    hideAllDialogs();
    alertDialog.message = msg;
    alertDialog.show = true;
    return new Promise(( resolve ) => {
        dialogResolve = resolve;
    });
}

async function confirm( msg ) {
    hideAllDialogs();
    confirmDialog.message = msg;
    confirmDialog.show = true;
    return new Promise(( resolve ) => {
        dialogResolve = resolve;
    });
}

function dialogClosed( type ) {
    hideAllDialogs();
    dialogResolve( type );
}

function resetArray( array ) {
    array.splice( 0, array.length );
}

function resetObject( target, source ) {
    for ( const key in source ) {
        target[ key ] = source[ key ];
    }
}

function copyToClipboard( text ) {
    navigator.clipboard.writeText( text );
}

function clearClipboard() {
    navigator.clipboard.writeText('');
}

async function confirmPassphrase() {
    if ( credential.passphrase.length < 8 ) {
        await alert('The passphrase must be at least 8 characters');
        return;
    }
    state.unlocking = true;
    clearClipboard();
    let ciphertext = credential.ciphertext;
    let bitLength = credential.cipherLength;
    let payload = null;
    if ( ciphertext ) {
        [ ciphertext, payload ] = ciphertext.split('|');
    }
    const passphrase = credential.passphrase;
    credential.passphrase = '';
    try {
        const result = await Secretary.unlock(
            passphrase,
            ciphertext,
            bitLength
        );
        if ( ! result ) {
            throw new Error();
        }
        credential.ciphertext = '';
        state.unlocked = true;
    } catch ( err ) {
        alert('Failed to process with the passphrase');  // no wait
        state.unlocking = false;
        return;
    }
    if ( payload ) {
        const buf = await Util.decompress( Util.base64ToBuffer( payload ));
        const arr = JSON.parse( Util.bufferToString( buf ));
        if ( ! Array.isArray( arr )) {
            console.error('Invalid preferences data from the ciphertext, discarded');
        } else {
            arr.forEach(( v ) => {
                preferences.push( v );
            });
        }
    }
    state.unlocking = false;
}

async function resetPassphrase() {
    const choice = await confirm('Are you sure want to reset all the data?');
    if ( choice === 'confirm') {
        Secretary.reset();
        resetObject( output, defaultOutput );
        resetObject( input, defaultInput );
        resetObject( credential, defaultCredential );
        resetObject( state, defaultState );
        resetArray( preferences );
    }
}

async function generateSecret() {
    if ( ! input.service ) {
        await alert('The service identity cannot be empty');
        return;
    }
    if ( ! input.user ) {
        await alert('The user identity cannot be empty');
        return;
    }
    state.generating = true;
    try {
        output.secret = await Secretary.generate(
            input.service,
            input.user,
            input.revision,
            input.length,
            STRENGTH_VALUE_MAP[ input.strengthIndex ]
        );
    } catch ( err ) {
        await alert('Failed to generate secret');
        state.generating = false;
        return;
    }
    let offset = 0;
    let hit = preferences.some(( v, i ) => {
        if ( v[0] !== input.service ) {
            return false;
        }
        if ( offset === 0 ) {
            offset = i;
        }
        if ( v[1] !== input.user ) {
            return false;
        }
        preferences[i][2] = input.revision;
        preferences[i][3] = input.length;
        preferences[i][4] = STRENGTH_VALUE_MAP[ input.strengthIndex ];
        return true;
    });
    if ( hit ) {
        state.generating = false;
        return;
    }
    preferences.splice( offset, 0, [
        input.service,
        input.user,
        input.revision,
        input.length,
        STRENGTH_VALUE_MAP[ input.strengthIndex ]
    ]);
    state.generating = false;
}

function resetSecret() {
    resetObject( output, defaultOutput );
    resetObject( input, defaultInput );
}

async function copySecret() {
    navigator.clipboard.writeText( output.secret );
    resetObject( output, defaultOutput );
    await alert('The generated secret is copied to the clipboard (Closing this dialog will clear the clipboard)');
    clearClipboard();
}

function clearSecret() {
    resetObject( output, defaultOutput );
}

async function exportCiphertext() {
    if ( input.newPass && input.newPass.length < 8 ) {
        await alert('The length of new passphrase must be at least 8 characters');
        return;
    }
    try {
        output.exportedText = await Secretary.encode( input.newPass );
    } catch ( err ) {
        await alert('Failed to export ciphertext');
        return;
    }
}

async function exportAsBundle() {
    if ( input.newPass && input.newPass.length < 8 ) {
        await alert('The length of new passphrase must be at least 8 characters');
        return;
    }
    let ciphertext;
    try {
        ciphertext = await Secretary.encode( input.newPass );
    } catch ( err ) {
        await alert('Failed to export ciphertext');
        return;
    }
    const buf = await Util.compress(
        Util.stringToBuffer(
            JSON.stringify( preferences )
        )
    );
    const payload = Util.bufferToBase64( buf );
    output.exportedText = ciphertext + '|' + payload;
}

async function copyBundle() {
    copyToClipboard( output.exportedText );
    resetObject( output, defaultOutput );
    await alert('The exported bundle/cipertext is copied to the clipboard (Closing this dialog will clear the clipboard)');
    clearClipboard();
}

function clearBundle() {
    resetObject( output, defaultOutput );
}

function autofillForm() {
    if ( input.user ) {
        return;
    }
    preferences.some(( v ) => {
        if ( v[0] !== input.service ) {
            return false;
        }
        input.user = v[1];
        input.revision = v[2];
        input.length = v[3];
        input.strengthIndex = STRENGTH_VALUE_MAP.indexOf( v[4] );
        return true;
    });
}

function applyPreference( index ) {
    const preference = preferences[ index ];
    input.service = preference[0];
    input.user = preference[1];
    input.revision = preference[2];
    input.length = preference[3];
    input.strengthIndex = STRENGTH_VALUE_MAP.indexOf( preference[4] );
}

function removePreference( index ) {
    preferences.splice( index, 1 );
}

async function removeAllPreferences() {
    const choice = await confirm('Are you sure want to remove all the preferences?');
    if ( choice === 'confirm') {
        resetArray( preferences );
    }
}

function sortColumn( index ) {
    if ( state.sortIndex === index ) {
        state.sortDescend = ! state.sortDescend;
    } else {
        state.sortIndex = index;
    }
    sorters.forEach(( v, i ) => {
        sorters[i] = '';
    });
    sorters[ index ] = ( state.sortDescend ? '↑' : '↓' );
}

onMounted(() => {
    document.title = `${APPLICATION_NAME} v${VERSION}`;
});
</script>

<template>
<div v-if="!features.crypto">Your browser does not support WebCrypto, try with another one</div>
<div v-else-if="!features.compress">Your browser does not support CompressionStream, try with another one</div>
<main class="container" v-else>
    <br />
    <article>
        <section>
            <fieldset>
                <label>#1 Paste existing ciphertext if available:</label>
                <textarea v-model.trim="credential.ciphertext" :disabled="state.unlocked" :aria-busy="state.unlocking" placeholder="Leaving this empty will generate a new one automatically"></textarea>
                <label>#0 Or choose a bit length for the new cipher: <span>{{chosenBitLength}}</span></label>
                <input type="range" min="256" :max="INPUT_MAX_CIPHER_LENGTH" step="256" v-model.number="credential.cipherLength" :disabled="state.unlocked || credential.ciphertext.length > 0" />
                <label>#2 Enter the passphrase for the ciphertext:</label>
                <input type="password" v-model="credential.passphrase" required :disabled="state.unlocked" :placeholder="(credential.ciphertext ? 'The passphrase of the ciphertext above' : 'Use a memorable passphrase for the new cipher')" @keyup.enter="confirmPassphrase" />
                <small>Do not save this passphrase in any place other than your brain, you only need to remember this one</small>
                <div class="grid">
                    <button :disabled="state.unlocked" :aria-busy="state.unlocking" aria-label="Unlocking..." @click="confirmPassphrase">{{(state.unlocked ? 'Unlocked' : '#3 Confirm')}}</button>
                    <button class="outline" :disabled="state.unlocking" @click="resetPassphrase">#9 Reset</button>
                </div>
            </fieldset>
        </section>
        <hr class="separator" />
        <section>
            <fieldset>
                <label>#4 Service identity, case-sensitive:</label>
                <input type="text" v-model.trim="input.service" :disabled="inputDisabled" placeholder="Domain Name / Software Title / etc." @input="clearSecret();autofillForm()" />
                <label>#5 User identity, case-sensitive:</label>
                <input type="text" v-model.trim="input.user" :disabled="inputDisabled" placeholder="Username / Email / etc." @input="clearSecret" />
                <label>Revision of the secret: <span>{{input.revision}}</span></label>
                <input type="range" min="0" :max="INPUT_MAX_REVISION" v-model.number="input.revision" :disabled="inputDisabled" @input="clearSecret" />
                <label>Length of the secret: <span>{{input.length}}</span></label>
                <input type="range" min="8" :max="INPUT_MAX_LENGTH" v-model.number="input.length" :disabled="inputDisabled" @input="clearSecret" />
                <label>Strength of the secret: <span>{{strengthValue}}</span></label>
                <input type="range" min="0" :max="STRENGTH_VALUE_MAP.length - 1" v-model.number="input.strengthIndex" :disabled="inputDisabled" @input="clearSecret" />
                <small>{{strengthDesc}}</small>
                <div class="grid">
                    <button :disabled="inputDisabled" :aria-busy="state.generating" @click="generateSecret">#6 Generate</button>
                    <button class="outline" :disabled="inputDisabled" @click="resetSecret">Reset</button>
                </div>
            </fieldset>
        </section>
        <hr class="separator" />
        <section>
            <fieldset>
                <label>Generated secret:</label>
                <input type="password" v-model="output.secret" readonly :disabled="inputDisabled" />
                <div class="grid">
                    <button :disabled="inputDisabled || !output.secret" @click="copySecret">#7 Copy</button>
                    <button class="danger" :disabled="inputDisabled || !output.secret" @click="secretDialog.show = true">Show</button>
                    <button class="outline" :disabled="inputDisabled" @click="clearSecret">Clear</button>
                </div>
            </fieldset>
        </section>
        <hr class="separator" />
        <section>
            <fieldset>
                <label>New Passphrase:</label>
                <input type="password" v-model="input.newPass" :disabled="inputDisabled" placeholder="Leave this empty if you want to keep current passphrase unchanged" />
                <label>Export ciphertext:</label>
                <textarea v-model="output.exportedText" readonly :disabled="inputDisabled" placeholder="Choose either [Export Ciphertext] to export only the ciphertext or [Export All] to generate a bundle of ciphertext along with all the preferences"></textarea>
                <small>NOTICE: Be sure to save the ciphertext in a safe place</small>
                <div class="grid">
                    <button :disabled="inputDisabled" @click="exportCiphertext">Export Ciphertext</button>
                    <button :disabled="inputDisabled" @click="exportAsBundle">#8 Export All</button>
                    <button class="outline" :disabled="inputDisabled || !output.exportedText" @click="copyBundle">Copy</button>
                    <button class="outline" :disabled="inputDisabled" @click="clearBundle">Clear</button>
                </div>
            </fieldset>
        </section>
        <hr class="separator" />
        <section>
            <fieldset>
                <label>Manage preferences:</label>
                <table>
                    <thead>
                        <tr>
                            <th><a class="sort" href="javascript:;" @click="sortColumn(0)">Service {{sorters[0]}}</a></th>
                            <th><a href="javascript:;" @click="sortColumn(1)">User {{sorters[1]}}</a></th>
                            <th>Revision</th>
                            <th>Length</th>
                            <th>Strength</th>
                            <th><a href="javascript:;" @click="removeAllPreferences">Remove All</a></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="( v, i ) in preferenceData">
                            <td><a href="javascript:;" @click="applyPreference(i)">{{v[0]}}</a></td>
                            <td><a href="javascript:;" @click="applyPreference(i)">{{v[1]}}</a></td>
                            <td>{{v[2]}}</td>
                            <td>{{v[3]}}</td>
                            <td>{{v[4]}}</td>
                            <td><a href="javascript:;" @click="removePreference(i)">Remove</a></td>
                        </tr>
                    </tbody>
                </table>
            </fieldset>
        </section>
    </article>
    <hr class="separator" />
    <section>
        <small class="footnote">Copyright &copy; 2024-2025 Sumine ZL</small>
        <small class="footnote right">Amnesiac Secretary v{{VERSION}} (<a target="_blank" href="https://github.com/sumine-zl/amnesiac-secretary">Source Code</a>)</small>
    </section>
</main>
<Dialog :open="alertDialog.show" :title="'ALERT'" :message="alertDialog.message" @close="dialogClosed('close')"></Dialog>
<Dialog :open="confirmDialog.show" :title="'ALERT'" :message="confirmDialog.message" @close="dialogClosed('cancel')">
    <template #control>
        <button @click="dialogClosed('confirm')">Confirm</button>
    </template>
</Dialog>
<Dialog :open="secretDialog.show" :title="'CAUTION'" @close="secretDialog.show=false;state.showSecret=false">
    <template #content>
        <input :type="(state.showSecret ? 'text' : 'password')" v-model="output.secret" readonly />
        <p>Make sure there is no body else at you back!</p>
    </template>
    <template #control>
        <button v-show="!state.showSecret" class="danger" @click="state.showSecret = !state.showSecret">Show the secret</button>
    </template>
</Dialog>
</template>

<style scoped>
table {
    font-size: 0.9em;
}
table a {
    text-decoration: none;
}
table a:hover {
    text-decoration: underline;
}
</style>
