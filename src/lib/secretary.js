// Secretary.js

import Util from './Util.js';

const UNIFORM_IV_SIZE = 12;  // in bytes
const UNIFORM_SALT_SIZE = 16;  // in bytes
const UNIFORM_KEY_LENGTH = 256;  // in bits
const UNIFORM_KEY_SIZE = UNIFORM_KEY_LENGTH / 8;  // in bytes
const BASE_ITERATION = 1048320;  // in times

let _cipher = null;
let _iv = null;
let _key = null;
let _salt = null;

function _genRand( size ) {
    return window.crypto.getRandomValues( new Uint8Array( size ));
}

function _getSpice( buf ) {
    return ( new Uint8Array( buf )).reduce(( a, b ) =>  a ^ b, 0 );
}

async function testEnvironment() {
    const toString = Object.prototype.toString;
    try {
        const getRandomValues = window.crypto.getRandomValues;
        const Crypto = window.crypto.subtle;
        return toString.call( getRandomValues ) === '[object Function]' &&
            toString.call( Crypto.importKey ) === '[object Function]' &&
            toString.call( Crypto.exportKey ) === '[object Function]' &&
            toString.call( Crypto.digest ) === '[object Function]' &&
            toString.call( Crypto.deriveBits ) === '[object Function]' &&
            toString.call( Crypto.deriveKey ) === '[object Function]' &&
            toString.call( Crypto.encrypt ) === '[object Function]' &&
            toString.call( Crypto.decrypt ) === '[object Function]'
        ;
    } catch ( err ) {
        return false;
    }
}

function reset() {
    _cipher = null;
    _iv = null;
    _key = null;
    _salt = null;
}

function isUnlocked() {
    return _cipher && _key && _salt;
}

async function unlock( passphrase, ciphertext = '', bitLength = 1024 ) {
    reset();
    const Crypto = window.crypto.subtle;
    let plain = null;
    let spice = null;
    return Promise.resolve().then(() => {
        let promise = null;
        if ( ciphertext ) {
            [ _cipher, _iv, _salt ] = Util.sba4Unpack(
                Util.base64ToBuffer( ciphertext )
            );
            promise = Promise.resolve();
        } else {
            let cipherSize = Math.ceil( bitLength / 8 );
            let buf = _genRand(
                cipherSize + UNIFORM_IV_SIZE + UNIFORM_SALT_SIZE
            );
            plain = buf.slice( 0, cipherSize );
            _iv = buf.slice(
                cipherSize,
                cipherSize + UNIFORM_IV_SIZE
            );
            _salt = buf.slice(
                cipherSize + UNIFORM_IV_SIZE,
                cipherSize + UNIFORM_IV_SIZE + UNIFORM_SALT_SIZE
            );
        }
        return Crypto.digest('SHA-256', new Uint8Array(  // new Uint8array() for passing the goddamn tests
            Util.stringToBuffer( passphrase )
        ));
    }).then(( v ) => {  // digested passphrase
        spice = _getSpice( v );
        return Crypto.importKey(
            'raw',
            v,
            'PBKDF2',
            false,
            ['deriveKey']
        );
    }).then(( v ) => {  // imported passphrase key
        return Crypto.deriveKey({
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: new Uint8Array( _salt ),  // new Uint8array() for passing the goddamn tests
            iterations: BASE_ITERATION + spice
        }, v, {
            name: 'AES-GCM',
            length: 256
        }, false, [
            'encrypt',
            'decrypt'
        ]);
    }).then(( v ) => {  // derived passphrase key
        _key = v;
        if ( plain ) {
            return Crypto.encrypt({
                name: 'AES-GCM',
                iv: _iv
            }, v, plain ).then(( v ) => {  // encrypted cipher
                _cipher = v;
            });
        } else {
            return Crypto.decrypt({
                name: 'AES-GCM',
                iv: new Uint8Array( _iv )  // new Uint8array() for passing the goddamn tests
            }, _key, new Uint8Array( _cipher ));  // new Uint8array() for passing the goddamn tests
        }
    }).then(() => {  // ignore
        return true;
    }).catch(( err ) => {
        console.error( err );
        throw err;
    }).finally(() => {
        plain = null;
        spice = null;
    });
}

async function generate( identity1, identity2, revision, length ) {
    if ( ! isUnlocked() ) {
        throw new Error('Not unlocked');
    }
    const Crypto = window.crypto.subtle;
    let context = null;
    let spice = null;
    return Promise.resolve().then(() => {
        return Promise.all([
            Crypto.digest('SHA-256', new Uint8Array(  // new Uint8array() for passing the goddamn tests
                Util.stringToBuffer( identity1 )
            )),
            Crypto.digest('SHA-256', new Uint8Array(  // new Uint8array() for passing the goddamn tests
                Util.stringToBuffer( identity2 )
            )),
            Crypto.digest('SHA-256', new Uint8Array(  // new Uint8array() for passing the goddamn tests
                Util.stringToBuffer( revision )
            )),
            Crypto.digest('SHA-256', new Uint8Array(  // new Uint8array() for passing the goddamn tests
                Util.stringToBuffer( length )
            ))
        ]);
    }).then(( identities ) => {  // digests of identities
        // Commented for incompatibility of the tests
        //return new Blob( identities ).arrayBuffer();
        const joined = new Uint8Array( 4 * UNIFORM_KEY_SIZE );
        identities.forEach(( buf, i ) => {
            joined.set( new Uint8Array( buf ), i * UNIFORM_KEY_SIZE );
        });
        return joined;
    }).then(( v )=> { // joined digests
        return Crypto.digest('SHA-256', v );
    }).then(( v ) => {  // digested joined identities
        context = v;
        spice = _getSpice( v );
        return Crypto.decrypt({
            name: 'AES-GCM',
            iv: new Uint8Array( _iv )  // new Uint8array() for passing the goddamn tests
        }, _key, new Uint8Array( _cipher ));  // new Uint8array() for passing the goddamn tests
    }).then(( v ) => {  // decrypted cipher
        return Crypto.importKey(
            'raw',
            v,
            'PBKDF2',
            false,
            ['deriveBits']
        );
    }).then(( v ) => {  // imported cipher key
        // WebCrypto does not support PBKDF2 deriveKey() for HKDF directly
        return Crypto.deriveBits({
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: new Uint8Array( _salt ),  // new Uint8array() for passing the goddamn tests
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
            salt: new Uint8Array( _salt ),  // new Uint8array() for passing the goddamn tests
            info: context
        }, v, length * 8 );
    }).then(( v ) => {  // generated secret
        return String.fromCharCode( ...( new Uint8Array( v )).map(( b ) => {
            return ( b % 94 ) + 33;  // unidirectional info tranlation
        }));
    }).catch(( err ) => {
        console.error( err );
        throw err;
    }).finally(() => {
        context = null;
        spice = null;
    });
}

async function encode( passphrase = '' ) {
    const Crypto = window.crypto.subtle;
    if ( ! isUnlocked() ) {
        throw new Error('Not unlocked');
    }
    let spice = null;
    return Promise.resolve().then(() => {
        if ( passphrase ) {
            return Promise.resolve().then(() => {
                return Crypto.digest('SHA-256', new Uint8Array(  // new Uint8array() for passing the goddamn tests
                    Util.stringToBuffer( passphrase )
                ));
            }).then(( v ) => {  // digested passphrase
                spice = _getSpice( v );
                return Crypto.importKey(
                    'raw',
                    v,
                    'PBKDF2',
                    false,
                    ['deriveKey']
                );
            }).then(( v ) => {  // imported passphrase key
                return Crypto.deriveKey({
                    name: 'PBKDF2',
                    hash: 'SHA-256',
                    salt: new Uint8Array( _salt ),  // new Uint8array() for passing the goddamn tests
                    iterations: BASE_ITERATION + spice
                }, v, {
                    name: 'AES-GCM',
                    length: 256
                }, false, [
                    'encrypt'
                ]);
            }).then(( v ) => {  // derived passphrase key
                return Promise.all([
                    v,
                    Crypto.decrypt({
                        name: 'AES-GCM',
                        iv: new Uint8Array( _iv )  // new Uint8array() for passing the goddamn tests
                    }, _key, new Uint8Array( _cipher ))  // new Uint8array() for passing the goddamn tests
                ]);
            }).then(([ key, cipher ]) => {
                const iv = _genRand( UNIFORM_IV_SIZE );
                return Promise.all([
                    iv,
                    Crypto.encrypt({
                        name: 'AES-GCM',
                        iv: iv
                    }, key, cipher )
                ]);
            });
        }
        return Promise.resolve([ _iv, _cipher ]);
    }).then(([ iv, cipher ]) => {
        return Util.bufferToBase64(
            Util.sba4Pack([
                cipher, iv, _salt
            ])
        );
    }).catch(( err ) => {
        console.error( err );
        throw err;
    }).finally(() => {
        spice = null;
    });
}

export default {
    testEnvironment,
    reset,
    isUnlocked,
    unlock,
    generate,
    encode
};
