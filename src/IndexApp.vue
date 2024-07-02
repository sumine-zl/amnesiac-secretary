<script setup>
import { reactive, onMounted } from 'vue';
import Util from './lib/Util.js';
import Secretary from './lib/Secretary.js';
import Dialog from './lib/Dialog.vue';
import { version as VERSION } from '../package.json';

// Configs
const REVISION_MAX = 15;
const LENGTH_MAX = 32;

// Defaults
const defaultState = {
    unlocked: false,
    unlocking: false,
    showSecret: false,
};
const defaultCredential = {
    ciphertext: '',
    passphrase: '',
};
const defaultInput = {
    service: '',
    user: '',
    revision: 0,
    length: 12,
    newPass: '',
};
const defaultOutput ={
    secret: '',
    exportedText: '',
};

// States
const state = reactive( Object.assign({}, defaultState ));

// credentials
const credential = reactive( Object.assign({}, defaultCredential ));

// Inputs
const input = reactive( Object.assign({}, defaultInput ));

// Outputs
const output = reactive( Object.assign({}, defaultOutput ));

// List of preferences
const preferences = reactive([]);

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

async function alert( msg, closedCallback ) {
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
    if ( ciphertext ) {
        const [ section1, section2 ] = ciphertext.split('|');
        ciphertext = section1;
        if ( section2 ) {
            const buf = await Util.decompress( Util.base64ToBuffer( section2 ));
            const arr = JSON.parse( Util.bufferToString( buf ));
            if ( ! Array.isArray( arr )) {
                console.error('Invalid preferences data from the ciphertext');
            } else {
                arr.forEach(( v ) => {
                    preferences.push( v );
                });
            }
        }
    }
    const passphrase = credential.passphrase;
    credential.passphrase = '';
    try {
        const result = await Secretary.unlock( passphrase, ciphertext );
        if ( ! result ) {
            throw new Error();
        }
        credential.ciphertext = '';
        state.unlocked = true;
    } catch ( err ) {
        alert('Failed to process with the passphrase');  // no wait
    }
    state.unlocking = false;
}

async function resetPassphrase() {
    const choice = await confirm('Are you sure want to reset all the data?');
    if ( choice === 'confirm') {
        await Secretary.reset();
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
    try {
        output.secret = await Secretary.generate(
            input.service,
            input.user,
            input.revision,
            input.length
        );
    } catch ( err ) {
        await alert('Failed to generate secret');
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
        return true;
    });
    if ( hit ) {
        return;
    }
    preferences.splice( offset, 0, [
        input.service,
        input.user,
        input.revision,
        input.length
    ]);
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
    const base64 = Util.bufferToBase64( buf );
    output.exportedText = ciphertext + '|' + base64;
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
        return true;
    });
}

async function removeAllPreferences() {
    const choice = await confirm('Are you sure want to remove all the preferences?');
    if ( choice === 'confirm') {
        resetArray( preferences );
    }
}

function removePreference( index ) {
    preferences.splice( index, 1 );
}

onMounted(() => {
    return Secretary.init();  // no wait
});
</script>

<template>
<main class="container">
    <br />
    <article>
        <section>
            <fieldset>
                <label>#1 Paste existing ciphertext if available:</label>
                <textarea v-model.trim="credential.ciphertext" :disabled="state.unlocked" :aria-busy="state.unlocking" placeholder="Or leave this empty and a new one will be generated automatically"></textarea>
                <label>#2 Enter the passphrase for the ciphertext:</label>
                <input type="password" v-model="credential.passphrase" required :disabled="state.unlocked" placeholder="Use a memorable passphrase" />
                <small>Do not save this passphrase in any place other than your brain, you only need to remember this one</small>
                <div class="grid">
                    <button :disabled="state.unlocked" :aria-busy="state.unlocking" aria-label="Unlocking..." @click="confirmPassphrase">{{(state.unlocked ? 'Unlocked' : '#3 Confirm')}}</button>
                    <button class="outline" :disabled="state.unlocking" @click="resetPassphrase">Reset</button>
                </div>
            </fieldset>
        </section>
        <hr class="separator" />
        <section>
            <fieldset>
                <label>#4 Service identity, case-sensitive:</label>
                <input type="text" v-model.trim="input.service" :disabled="!state.unlocked" placeholder="Domain Name / Software Title / etc." @input="autofillForm" />
                <label>#5 User identity, case-sensitive:</label>
                <input type="text" v-model.trim="input.user" :disabled="!state.unlocked" placeholder="Username / Email / etc." />
                <label>Revision of the secret: <span>{{input.revision}}</span></label>
                <input type="range" min="0" :max="REVISION_MAX" v-model.number="input.revision" :disabled="!state.unlocked" />
                <label>Length of the secret: <span>{{input.length}}</span></label>
                <input type="range" min="8" :max="LENGTH_MAX" v-model.number="input.length" :disabled="!state.unlocked" />
                <small>&nbsp;</small>
                <div class="grid">
                    <button :disabled="!state.unlocked" @click="generateSecret">#6 Generate</button>
                    <button class="outline" :disabled="!state.unlocked" @click="resetSecret">Reset</button>
                </div>
            </fieldset>
        </section>
        <hr class="separator" />
        <section>
            <fieldset>
                <label>Generated secret:</label>
                <input type="password" v-model="output.secret" readonly :disabled="!state.unlocked" />
                <div class="grid">
                    <button :disabled="!state.unlocked || !output.secret" @click="copySecret">#7 Copy</button>
                    <button class="danger" :disabled="!state.unlocked || !output.secret" @click="secretDialog.show = true">Show</button>
                    <button class="outline" :disabled="!state.unlocked" @click="clearSecret">Clear</button>
                </div>
            </fieldset>
        </section>
        <hr class="separator" />
        <section>
            <fieldset>
                <label>New Passphrase:</label>
                <input type="password" v-model="input.newPass" :disabled="!state.unlocked" placeholder="Leave this empty if you want to keep current passphrase unchanged" />
                <label>Export ciphertext:</label>
                <textarea v-model="output.exportedText" readonly :disabled="!state.unlocked" placeholder="Choose either [Export Ciphertext] to export only the ciphertext or [Export Bundle] to generate a bundle of ciphertext along with all the preferences"></textarea>
                <small>NOTICE: Be sure to save the ciphertext in a safe place</small>
                <div class="grid">
                    <button :disabled="!state.unlocked" @click="exportCiphertext">Export Ciphertext</button>
                    <button :disabled="!state.unlocked" @click="exportAsBundle">#8 Export As Bundle</button>
                    <button class="outline" :disabled="!state.unlocked || !output.exportedText" @click="copyBundle">Copy</button>
                    <button class="outline" :disabled="!state.unlocked" @click="clearBundle">Clear</button>
                </div>
            </fieldset>
        </section>
        <hr class="separator" />
        <section>
            <fieldset>
                <label>Manage preferences:</label>
                <table>
                    <tr>
                        <th>Service</th>
                        <th>User</th>
                        <th>Revision</th>
                        <th>Length</th>
                        <th><a href="javascript:;" @click="removeAllPreferences">Remove All</a></th>
                    </tr>
                    <tr v-for="( v, i ) in preferences">
                        <td>{{ v[0] }}</td>
                        <td>{{ v[1] }}</td>
                        <td>{{ v[2] }}</td>
                        <td>{{ v[3] }}</td>
                        <td><a href="javascript:;" @click="removePreference(i)">Remove</a></td>
                    </tr>
                </table>
            </fieldset>
        </section>
    </article>
    <hr class="separator" />
    <section>
        <small class="footnote">Copyright &copy; 2024 Sumine_ZL</small>
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
</style>
