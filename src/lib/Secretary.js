// Secretary.js
// The core library for Amnesiac Secretary
// Authored and handmaded by Sumine ZL
// Copyright (c) 2024-2026 Sumine ZL <sumine_zl+amnesiac-secretary@hotmail.com>

const UNIFORM_IV_SIZE = 12;  // in bytes
const UNIFORM_SALT_SIZE = 16;  // in bytes
const UNIFORM_KEY_LENGTH = 256;  // in bits
const UNIFORM_KEY_SIZE = UNIFORM_KEY_LENGTH / 8;  // in bytes
const BASE_ITERATION = 1048320;  // in times
const CHARSET_NUMBER = "0123456789";
const CHARSET_ALPHABET_L = "abcdefghijklmnopqrstuvwxyz";
const CHARSET_ALPHABET_U = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CHARSET_SPECIAL_33 = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ ";
const CHARSET_SPECIAL_32 = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const CHARSET_SPECIAL_29 = "!#$%&()*+,-./:;<=>?@[]^_`{|}~";

let _cipher = null;
let _iv = null;
let _key = null;
let _salt = null;
let _payload = null;

function _genRand( size ) {
    return window.crypto.getRandomValues( new Uint8Array( size ));
}

function _getSpice( buf ) {
    return ( new Uint8Array( buf )).reduce(( a, b ) =>  a ^ b, 0 );
}

function _translate( buf, sequences ) {
    const splits = sequences.reduce(( r, _, i ) => {
        if ( i === 0 ) {
            r.push( 0 );
            return r;
        }
        r.push( r[ i - 1 ] + sequences[ i - 1 ].length );
        return r;
    }, []);
    const buckets = sequences.map(() => { return []; });
    const sequence = sequences.join('');
    const indices = ( new Uint8Array( buf )).reduce(( r, v, i ) => {
        let c = v % sequence.length;
        for ( let j = splits.length - 1; j >= 0; j-- ) {
            if ( c >= splits[j] ) {
                buckets[j].push([ i, c ]);
                break;
            }
        }
        r.push( c );
        return r;
    }, []);
    const bucket = buckets.reduce(( r, v ) => {
        return ( r && ( v.length <= r.length ) ? r : v );
    });
    buckets.every(( v, j ) => {
        if ( v.length === 0 ) {
            if ( bucket.length === 0 ) {
                return false;  // abort
            }
            let [ i, c ] = bucket.pop();
            c = c % sequences[j].length + splits[j];
            indices[i] = c;
            v.push( c );
        }
        return true;  // continue
    });
    const string = indices.map(( c, i, a ) => {
        if ( c === a[ i - 1 ]) {
            c += 1;
        }
        if ( c >= sequence.length ) {
            c = 0;
        }
        return c;
    }).map(( c ) => {
        return sequence[c];
    }).join('');
    return string;
}

function base64ToBuffer( str ) {
    return ( Uint8Array.from(
        window.atob( str ),
        ( c ) => c.charCodeAt( 0 )
    )).buffer;
}

function bufferToBase64( buf ) {
    return window.btoa( String.fromCharCode( ...( new Uint8Array( buf ))));
}

function stringToBuffer( str ) {
    return ( Uint8Array.from(
        String( str ),
        ( c ) => c.charCodeAt( 0 )
    )).buffer;
}

function bufferToString( buf ) {
    return String.fromCharCode( ...( new Uint8Array( buf )));
}

async function compress( buf ) {
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    writer.write( new Uint8Array( buf ));
    writer.close();
    const output = [];
    let size = 0;
    const reader = stream.readable.getReader();
    while ( true ) {
        const { value, done } = await reader.read();
        if ( done ) {
            break;
        }
        output.push( value );
        size += value.byteLength;
    }
    const data = new Uint8Array( size );
    let offset = 0;
    for ( const chunk of output ) {
        data.set( chunk, offset );
        offset += chunk.byteLength;
    }
    return data.buffer;
}

async function decompress( buf ) {
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    writer.write( new Uint8Array( buf ));
    writer.close();
    const output = [];
    const reader = stream.readable.getReader();
    let size = 0;
    while ( true ) {
        const { value, done } = await reader.read();
        if ( done ) {
            break;
        }
        output.push( value );
        size += value.byteLength;
    }
    const data = new Uint8Array( size );
    let offset = 0;
    for ( const chunk of output ) {
        data.set( chunk, offset );
        offset += chunk.byteLength;
    }
    return data.buffer;
}

function pack( arr ) {
    let total = 0;
    const seq = arr.map(( v ) => {
        const data = new Uint8Array( v );
        const size = new Uint8Array(
            (new Uint32Array([ data.byteLength ])).buffer
        );
        const unit = 4;  // fixed
        const chunk = new Uint8Array(
            1 + size.byteLength + data.byteLength
        );
        chunk.set([ unit ], 0 );
        chunk.set( size, 1 );
        chunk.set( data, 1 + unit );
        total += chunk.byteLength;
        return chunk;
    });
    const buf = new Uint8Array( total );
    let offset = 0;
    seq.forEach(( v ) => {
        buf.set( v, offset );
        offset += v.byteLength;
    });
    return buf.buffer;
}

function unpack( buf ) {
    buf = new Uint8Array( buf );
    const seq = [];
    let cursor = 0;
    while ( cursor < buf.byteLength ) {
        const unit = 4;  // fixed
        const size = new Uint32Array(
            ( new Uint8Array(
                buf.slice( cursor + 1, cursor + 1 + unit )
            )).buffer
        );
        const data = new Uint8Array(
            buf.slice(
                cursor + 1 + unit,
                cursor + 1 + unit + size[0]
            )
        );
        seq.push( data.buffer );
        cursor += 1 + unit + size[0];
    }
    return seq;
}

function testCompressionSupport() {
    try {
        return toString.call( CompressionStream ) === '[object Function]' &&
            toString.call( DecompressionStream ) === '[object Function]'
        ;
    } catch ( err ) {
        return false;
    }
}

async function testCryptoSupport() {
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
        if ( ciphertext ) {
            [ _cipher, _iv, _salt, _payload ] = unpack(
                base64ToBuffer( ciphertext )
            );
        } else {  // new cipher
            const cipherSize = Math.ceil( bitLength / 8 );
            const buf = _genRand(
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
        return Crypto.digest('SHA-256', new Uint8Array(  // new Uint8Array() for passing the goddamn tests
            stringToBuffer( passphrase )
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
            salt: new Uint8Array( _salt ),  // new Uint8Array() for passing the goddamn tests
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
        if ( plain ) {  // new cipher
            return Crypto.encrypt({
                name: 'AES-GCM',
                iv: _iv
            }, _key, plain ).then(( v ) => {  // encrypted cipher
                _cipher = v;
            });
        } else {
            // Test the key by trying decrypt the cipher
            return Crypto.decrypt({
                name: 'AES-GCM',
                iv: new Uint8Array( _iv )  // new Uint8Array() for passing the goddamn tests
            }, _key, new Uint8Array( _cipher ));  // new Uint8Array() for passing the goddamn tests
        }
    }).then(() => {  // ignore the result
        return true;
    }).catch(( err ) => {
        console.error( err );
        throw err;
    }).finally(() => {
        plain = null;
        spice = null;
    });
}

/**
 * strength values: 95, 94, 91, 64, 62, 36, 10
 * 95 - ASCII chars from 32 to 126, including Space
 * 94 - ASCII chars from 33 to 126, excluding Space
 * 91 - ASCII chars from 33 to 126, excluding Space, Double/Single Quotes, Backslash
 * 62 - Alphanumerics, with both upper and lower cases
 * 36 - Alphanumerics, with only lower cases
 * 10 - Numbers from 0 to 9
 * 0  - Raw Base64 without any translations
 */
async function generate(
    identity1, identity2, revision, length, strength = 91
) {
    if ( ! isUnlocked() ) {
        throw new Error('Not unlocked');
    }
    const Crypto = window.crypto.subtle;
    let context = null;
    let spice = null;
    return Promise.resolve().then(() => {
        return Promise.all([
            Crypto.digest('SHA-256', new Uint8Array(  // new Uint8Array() for passing the goddamn tests
                stringToBuffer( identity1 )
            )),
            Crypto.digest('SHA-256', new Uint8Array(  // new Uint8Array() for passing the goddamn tests
                stringToBuffer( identity2 )
            )),
            Crypto.digest('SHA-256', new Uint8Array(  // new Uint8Array() for passing the goddamn tests
                stringToBuffer( revision )
            )),
            Crypto.digest('SHA-256', new Uint8Array(  // new Uint8Array() for passing the goddamn tests
                stringToBuffer( length )
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
            iv: new Uint8Array( _iv )  // new Uint8Array() for passing the goddamn tests
        }, _key, new Uint8Array( _cipher ));  // new Uint8Array() for passing the goddamn tests
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
            salt: new Uint8Array( _salt ),  // new Uint8Array() for passing the goddamn tests
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
            salt: new Uint8Array( _salt ),  // new Uint8Array() for passing the goddamn tests
            info: context
        }, v, length * 8 );
    }).then(( v ) => {  // generated secret
        // Unidirectional information tranlation
        switch ( strength ) {
        case 0:
            return bufferToBase64( v );
        // 10 - Numbers from 0 to 9
        case 10:
            return _translate( v, [
                CHARSET_NUMBER
            ]);
        // 36 - Alphanumerics, with only lower cases
        case 36:
            return _translate( v, [
                CHARSET_NUMBER,
                CHARSET_ALPHABET_L
            ]);
        // 62 - Alphanumerics, with both upper and lower cases
        case 62:
            return _translate( v, [
                CHARSET_NUMBER,
                CHARSET_ALPHABET_L,
                CHARSET_ALPHABET_U
            ]);
        // 91 - ASCII chars from 33 to 126, excluding Space, Double/Single Quotes, Backslash
        case 91:
            return _translate( v, [
                CHARSET_NUMBER,
                CHARSET_ALPHABET_L,
                CHARSET_ALPHABET_U,
                CHARSET_SPECIAL_29
            ]);
        // 94 - ASCII chars from 33 to 126, excluding Space
        case 94:
            return _translate( v, [
                CHARSET_NUMBER,
                CHARSET_ALPHABET_L,
                CHARSET_ALPHABET_U,
                CHARSET_SPECIAL_32
            ]);
        // 95 - ASCII chars from 32 to 126, including Space
        case 95:
            return _translate( v, [
                CHARSET_NUMBER,
                CHARSET_ALPHABET_L,
                CHARSET_ALPHABET_U,
                CHARSET_SPECIAL_33
            ]);
        default:
            throw new Error(`Invalid strength value: ${strength}`);
        }
    }).catch(( err ) => {
        console.error( err );
        throw err;
    }).finally(() => {
        context = null;
        spice = null;
    });
}

async function getData( key ) {
    if ( _payload ) {
        const Crypto = window.crypto.subtle;
        return Promise.resolve().then(() => {
            return Crypto.decrypt({
                name: 'AES-GCM',
                iv: new Uint8Array( _iv )  // new Uint8Array() for passing the goddamn tests
            }, _key, new Uint8Array( _payload ));  // new Uint8Array() for passing the goddamn tests
        }).then(( v ) => {
            return decompress( v );
        }).then(( v ) => {
            const json = bufferToString( v );
            if ( ! json ) {
                return undefined;
            }
            const data = JSON.parse( json );
            return data[ key ];
        }).catch(( err ) => {
            console.error( err );
            return undefined;
        });
    } else {
        return undefined;
    }
}

async function setData( key, value ) {
    const Crypto = window.crypto.subtle;
    return Promise.resolve({}).then(( v ) => {
        if ( _payload ) {
            return Crypto.decrypt({
                name: 'AES-GCM',
                iv: new Uint8Array( _iv )  // new Uint8Array() for passing the goddamn tests
            }, _key, new Uint8Array( _payload )).then(( v ) => {  // new Uint8Array() for passing the goddamn tests
                return decompress( v );
            }).then(( v ) => {
                const json = bufferToString( v );
                if ( ! json ) {
                    return {};
                }
                const data = JSON.parse( json );
                return data;
            }).catch(( err ) => {
                console.error( err );
                return v;
            });
        }
        return v;
    }).then(( v ) => {
        v[ key ] = value;
        return v;
    }).then(( v ) => {
        const json = JSON.stringify( v );
        const buf = stringToBuffer( json );
        return compress( buf );
    }).then(( v ) => {
        return Crypto.encrypt({
            name: 'AES-GCM',
            iv: _iv
        }, _key, v );
    }).then(( v ) => {
        _payload = v;
    }).catch(( err ) => {
        console.error( err );
        throw err;
    });
}

async function unsetData( key ) {
    if ( _payload ) {
        const Crypto = window.crypto.subtle;
        let value = undefined;
        return Promise.resolve().then(() => {
            return Crypto.decrypt({
                name: 'AES-GCM',
                iv: new Uint8Array( _iv )  // new Uint8Array() for passing the goddamn tests
            }, _key, new Uint8Array( _payload ));  // new Uint8Array() for passing the goddamn tests
        }).then(( v ) => {
            return decompress( v );
        }).then(( v ) => {
            const json = bufferToString( v );
            if ( ! json ) {
                return {};
            }
            const data = JSON.parse( json );
            value = data[ key ];
            delete data[ key ];
            return data;
        }).then(( v ) => {
            const json = JSON.stringify( v );
            const buf = stringToBuffer( json );
            return compress( buf );
        }).then(( v ) => {
            return Crypto.encrypt({
                name: 'AES-GCM',
                iv: _iv
            }, _key, v );
        }).then(( v ) => {
            _payload = v;
            return value;
        }).catch(( err ) => {
            console.error( err );
            return undefined;
        });
    } else {
        return undefined;
    }
}

async function encode( passphrase = '' ) {
    if ( ! isUnlocked() ) {
        throw new Error('Not unlocked');
    }
    const Crypto = window.crypto.subtle;
    let spice = null;
    return Promise.resolve().then(() => {
        if ( passphrase ) {  // new passphrase
            return Promise.resolve().then(() => {
                return Crypto.digest('SHA-256', new Uint8Array(  // new Uint8Array() for passing the goddamn tests
                    stringToBuffer( passphrase )
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
                    salt: new Uint8Array( _salt ),  // new Uint8Array() for passing the goddamn tests
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
                        iv: new Uint8Array( _iv )  // new Uint8Array() for passing the goddamn tests
                    }, _key, new Uint8Array( _cipher ))  // new Uint8Array() for passing the goddamn tests
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
        return bufferToBase64(
            pack([
                cipher, iv, _salt, _payload
            ])
        );
    }).catch(( err ) => {
        console.error( err );
        throw err;
    }).finally(() => {
        spice = null;
    });
}

async function verifyPassphrase(passphrase, ciphertext) {
    const saved = { _cipher, _iv, _key, _salt };
    try {
        await unlock(passphrase, ciphertext);
        return true;
    } catch {
        return false;
    } finally {
        _cipher = saved._cipher;
        _iv = saved._iv;
        _key = saved._key;
        _salt = saved._salt;
    }
}

export default {
    base64ToBuffer,
    bufferToBase64,
    stringToBuffer,
    bufferToString,
    compress,
    decompress,
    pack,
    unpack,
    testCompressionSupport,
    testCryptoSupport,
    reset,
    isUnlocked,
    unlock,
    generate,
    getData,
    setData,
    unsetData,
    encode,
    verifyPassphrase
};
