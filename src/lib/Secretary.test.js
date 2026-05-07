// Secretary.test.js
// Authored and handmaded by Sumine ZL
// Copyright (c) 2024-2026 Sumine ZL <sumine_zl+amnesiac-secretary@hotmail.com>

import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import Secretary from './Secretary'

function genRandomString( length ) {
    return String.fromCharCode( ...(
        [...Array( length ).keys()].map(( i ) => {
            return 33 + Math.floor( Math.random() * 94 );
        })
    ));
}

describe('Regular procedure', () => {

    test('string <--> buffer inter-conversion', () => {
        const length = 32;
        const str = String.fromCharCode( ...(
            [...Array( length ).keys()].map(( i ) => {
                return 33 + Math.floor( Math.random() * 94 );
            })
        ));
        let result;
        result = Secretary.stringToBuffer( str );
        expect( result ).toBeTruthy();
        expect( result ).toBeInstanceOf( ArrayBuffer );
        expect( result.byteLength ).toBe( str.length );
        result = Secretary.bufferToString( result );
        expect( result ).toBeTruthy();
        expect( result ).toBeTypeOf('string');
        expect( result ).toBe( str );
    });

    test('buffer <--> base64 inter-conversion', () => {
        const length = 32;
        const buf = ( Uint8Array.from(
            [...Array( length ).keys()].map(( i ) => {
                return Math.floor( Math.random() * 256 );
            })
        )).buffer;
        let result;
        result = Secretary.bufferToBase64( buf );
        expect( result ).toBeTruthy();
        expect( result ).toBeTypeOf('string');
        expect( result.length ).toBeGreaterThan( buf.byteLength );
        result = Secretary.base64ToBuffer( result );
        expect( result ).toBeTruthy();
        expect( result ).toBeInstanceOf( ArrayBuffer );
        expect(( new Uint8Array( result )).toString() ).toBe(
            ( new Uint8Array( buf )).toString()
        );
    });

    test('buffer compression & decompression', async () => {
        const str = await readFile( __filename, 'utf8');
        const buf = Secretary.stringToBuffer( str );
        let result;
        result = await Secretary.compress( buf );
        expect( result ).toBeTruthy();
        expect( result.byteLength ).toBeLessThan( buf.byteLength );
        result = await Secretary.decompress( result );
        expect( result ).toBeTruthy();
        expect( result ).toBeInstanceOf( ArrayBuffer );
        expect(( new Uint8Array( result )).toString() ).toBe(
            ( new Uint8Array( buf )).toString()
        );
    });

    test('simple binary array (4 bytes edition) pack & unpack', async () => {
        const length = 10;
        const arr = [];
        for ( let i = 0; i < length; i++ ) {
            arr.push(( Uint8Array.from(
                [...Array( length ).keys()].map(( i ) => {
                    return Math.floor( Math.random() * 256 );
                })
            )).buffer );
        }
        let result = Secretary.pack( arr );
        expect( result ).toBeTruthy();
        expect( result ).toBeInstanceOf( ArrayBuffer );
        result = Secretary.unpack( result );
        expect( result ).toBeTruthy();
        expect( result ).toBeInstanceOf( Array );
        expect( result ).toHaveLength( length );
        for ( let i = 0; i < length; i++ ) {
            expect( result[i] ).toBeTruthy();
            expect( result[i] ).toBeInstanceOf( ArrayBuffer );
            expect(( new Uint8Array( result[i])).every(( v, j ) => {
                return v === ( new Uint8Array( arr[i] ))[j];
            })).toBeTruthy();
        }
    });

    test('secret generation', async () => {
        const passphrase = genRandomString( 32 );
        const service = genRandomString( 16 );
        const user = genRandomString( 16 );
        const revision = Math.floor( 15 * Math.random() );
        const length = Math.floor( 23 * Math.random() + 8 );
        const strength = 91;
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[`\-=~!@#$%^&*()_+|\[\]{};:,./<>?]).+$/;
        let unlocked = await Secretary.unlock( passphrase );
        expect( unlocked ).toBeTruthy();
        let secrets = [];
        let secret;
        secret = await Secretary.generate( service, user, revision, length, strength );
        expect( secret ).toBeTypeOf('string');
        expect( secret.length ).toBe( length );
        expect( regex.test( secret )).toBeTruthy();
        expect( secrets.includes( secret )).toBeFalsy();
        secrets.push( secret );
        secret = await Secretary.generate( service, user, revision, length, 94 );
        expect( secret ).toBeTypeOf('string');
        expect( secret.length ).toBe( length );
        expect( /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[`\-=\\~!@#$%^&*()_+|\[\]{};':",./<>?]).+$/.test( secret )).toBeTruthy();
        expect( secrets.includes( secret )).toBeFalsy();
        secrets.push( secret );
        secret = await Secretary.generate( service, user, revision, length + 1, strength );
        expect( secret ).toBeTypeOf('string');
        expect( secret.length ).toBe( length + 1 );
        expect( regex.test( secret )).toBeTruthy();
        expect( secrets.includes( secret )).toBeFalsy();
        secrets.push( secret );
        secret = await Secretary.generate( service, user, revision + 1, length, strength );
        expect( secret ).toBeTypeOf('string');
        expect( secret.length ).toBe( length );
        expect( regex.test( secret )).toBeTruthy();
        expect( secrets.includes( secret )).toBeFalsy();
        secrets.push( secret );
        secret = await Secretary.generate( service, user + '1', revision, length, strength );
        expect( secret ).toBeTypeOf('string');
        expect( secret.length ).toBe( length );
        expect( regex.test( secret )).toBeTruthy();
        expect( secrets.includes( secret )).toBeFalsy();
        secrets.push( secret );
        secret = await Secretary.generate( service + '1', user, revision, length, strength );
        expect( secret ).toBeTypeOf('string');
        expect( secret.length ).toBe( length );
        expect( regex.test( secret )).toBeTruthy();
        expect( secrets.includes( secret )).toBeFalsy();
        secrets.push( secret );
    });

    test('ciphertext encoding & decoding', async () => {
        const passphrase1 = genRandomString( 32 );
        const passphrase2 = genRandomString( 32 );
        const service = genRandomString( 16 );
        const user = genRandomString( 16 );
        const revision = Math.floor( 16 * Math.random() );
        const length = Math.floor( 24 * Math.random() + 8 );
        const strength = 91;
        let unlocked;
        unlocked = await Secretary.unlock( passphrase1 );
        expect( unlocked ).toBeTruthy();
        let secret = await Secretary.generate( service, user, revision, length, strength );
        expect( secret ).toBeTypeOf('string');
        expect( secret.length ).toBe( length );
        let ciphertext = await Secretary.encode();
        expect( ciphertext ).toBeTruthy();
        expect( ciphertext ).toBeTypeOf('string');
        await Secretary.reset();
        try {
            unlocked = await Secretary.unlock( passphrase2, ciphertext );
            expect( unlocked ).toBeFalsy();
        } catch ( err ) {
            expect( err ).toBeInstanceOf( Error );
        }
        unlocked = await Secretary.unlock( passphrase1, ciphertext );
        expect( unlocked ).toBeTruthy();
        let secret2 = await Secretary.generate( service, user, revision, length, strength );
        expect( secret2 === secret ).toBeTruthy();
        let ciphertext2 = await Secretary.encode( passphrase2 );
        expect( ciphertext2 === ciphertext ).toBeFalsy();
        await Secretary.reset();
        unlocked = await Secretary.unlock( passphrase2, ciphertext2 );
        expect( unlocked ).toBeTruthy();
    });
});
