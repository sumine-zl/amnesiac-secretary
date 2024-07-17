// Secretary.test.js

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
