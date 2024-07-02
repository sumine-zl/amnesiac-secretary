// Secretary.js

import Util from './Util.js';

const Crypto = window.crypto.subtle;

const BASE_ITERATION = 1048320;  // in times
const CIPHER_BUFFER_SIZE = 92;  // in bytes
const SALT_SPLIT_POINT = 12;  // in bytes
const UNIFORM_KEY_LENGTH = 256;  // in bits
const UNIFORM_SALT_SIZE = 28;  // in bytes

let _cipher = null;
let _key = null;
let _salt = null;

function _genRand( size ) {
    return window.crypto.getRandomValues( new Uint8Array( size ));
}

function _getSpice( buf ) {
    return (new Uint8Array( buf )).reduce(( a, b ) =>  a ^ b, 0 );
}

async function init() {
    reset();
}

async function unlock( passphrase, ciphertext = '' ) {
    reset();
    let encrypted = null;
    let spice = null;
    return Promise.resolve().then(() => {
        let buf = null;
        if ( ciphertext ) {
            buf = Util.base64ToBuffer( ciphertext );
            encrypted = buf.slice( 0, buf.byteLength - UNIFORM_SALT_SIZE );
        } else {
            buf = _genRand( CIPHER_BUFFER_SIZE );
            _cipher = buf.slice( 0, buf.byteLength - UNIFORM_SALT_SIZE );
        }
        _salt = buf.slice( buf.byteLength - UNIFORM_SALT_SIZE );
        return Crypto.digest('SHA-256', Util.stringToBuffer( passphrase ));
    }).then(( v ) => {  // digested passphrase
        spice = _getSpice( v );
        return Crypto.importKey(
            'raw',
            v,
            'PBKDF2',
            false,
            ['deriveBits']
        );
    }).then(( v ) => {  // imported passphrase key
        return Crypto.deriveBits({
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: _salt.slice( SALT_SPLIT_POINT ),
            iterations: BASE_ITERATION + spice
        }, v, UNIFORM_KEY_LENGTH );
    }).then(( v ) => {  // derived passphrase bits
        _key = v;
        return Crypto.importKey(
            'raw',
            v,
            'AES-GCM',
            false,
            ['decrypt']
        );
    }).then(( v ) => {  // imported derived passphrase key
        if ( encrypted ) {
            return Promise.resolve().then(() => {
                return Crypto.decrypt({
                    name: 'AES-GCM',
                    iv: _salt.slice( 0, SALT_SPLIT_POINT )
                }, v, encrypted );
            }).then(( v ) => {  // decrypted cipher
                _cipher = new Uint8Array( v );
            });
        }
        return Promise.resolve();
    }).then(() => {
        return true;
    }).catch(( err ) => {
        console.error( err );
        throw err;
    });
}

async function reset() {
    _cipher = null;
    _key = null;
    _salt = null;
}

async function generate( identity1, identity2, revision, length ) {
    if ( ! _cipher || ! _key || ! _salt ) {
        throw new Error('No cipher unlocked');
    }
    let context = null;
    let spice = null;
    return Promise.resolve().then(() => {
        return Promise.all([
            Crypto.digest('SHA-256', Util.stringToBuffer( identity1 )),
            Crypto.digest('SHA-256', Util.stringToBuffer( identity2 )),
            Crypto.digest('SHA-256', Util.stringToBuffer( revision )),
            Crypto.digest('SHA-256', Util.stringToBuffer( length ))
        ]);
    }).then(( identities ) => {  // digests of identities
        //return new Blob( identities ).arrayBuffer();
        const joined = new Uint8Array( 4 * UNIFORM_KEY_LENGTH / 8 );
        identities.forEach(( buf, i ) => {
            joined.set( new Uint8Array( buf ), i * UNIFORM_KEY_LENGTH / 8 );
        });
        return joined;
    }).then(( v )=> { // joined digests
        return Crypto.digest('SHA-256', v );
    }).then(( v ) => {  // digested joined identities
        context = v;
        spice = _getSpice( v );
        return Crypto.importKey(
            'raw',
            _cipher,
            'PBKDF2',
            false,
            ['deriveBits']
        );
    }).then(( v ) => {  // imported cipher key
        return Crypto.deriveBits({
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: _salt.slice( SALT_SPLIT_POINT ),
            iterations: BASE_ITERATION + spice
        }, v, UNIFORM_KEY_LENGTH );
    }).then(( v ) => {  // derived cipher bits
        return Crypto.importKey(
            'raw',
            v,
            'HKDF',
            false,
            ['deriveBits']
        );
    }).then(( v ) => {  // imported derived cipher key
        return Crypto.deriveBits({
            name: 'HKDF',
            hash: 'SHA-256',
            salt: _salt.slice( SALT_SPLIT_POINT ),
            info: context
        }, v, length * 8 );
    }).then(( v ) => {  // generated secret
        return String.fromCharCode( ...(new Uint8Array( v )).map(( b ) => {
            return ( b % 94 ) + 33;
        }));
    }).catch(( err ) => {
        console.error( err );
        throw err;
    });
}

async function encode( passphrase = '' ) {
    if ( ! _cipher || ! _key || ! _salt ) {
        throw new Error('No cipher unlocked');
    }
    let spice = null;
    return Promise.resolve().then(() => {
        if ( passphrase ) {
            return Promise.resolve().then(() => {
                return Crypto.digest('SHA-256', Util.stringToBuffer(
                    passphrase
                ));
            }).then(( v ) => {  // digested passphrase
                spice = _getSpice( v );
                return Crypto.importKey(
                    'raw',
                    v,
                    'PBKDF2',
                    false,
                    ['deriveBits']
                );
            }).then(( v ) => {  // imported passphrase key
                return Crypto.deriveBits({
                    name: 'PBKDF2',
                    hash: 'SHA-256',
                    salt: _salt.slice( SALT_SPLIT_POINT ),
                    iterations: BASE_ITERATION + spice
                }, v, UNIFORM_KEY_LENGTH );
            });
        }
        return Promise.resolve( _key );
    }).then(( v ) => {
        return Crypto.importKey(
            'raw',
            v,
            'AES-GCM',
            false,
            ['encrypt']
        );
    }).then(( v ) => {  // imported key
        return Crypto.encrypt({
            name: 'AES-GCM',
            iv: _salt.slice( 0, SALT_SPLIT_POINT )
        }, v, _cipher );
    }).then(( v ) => {  // encrypted cipher
        //return new Blob([ new Uint8Array( v ), _salt ]).arrayBuffer();
        const joined = new Uint8Array( v.byteLength + UNIFORM_SALT_SIZE );
        joined.set( new Uint8Array( v ), 0 );
        joined.set( _salt, v.byteLength );
        return joined;
    }).then(( v ) => {  // combined cipher
        return Util.bufferToBase64( v );
    }).catch(( err ) => {
        console.error( err );
        throw err;
    });
}

export default {
    init,
    unlock,
    reset,
    generate,
    encode,
};
