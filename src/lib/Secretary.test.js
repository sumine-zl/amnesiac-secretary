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

describe('Secretary procedure', () => {

    test('secret generation', async () => {
        const passphrase = genRandomString( 32 );
        const service = genRandomString( 16 );
        const user = genRandomString( 16 );
        const revision = 0;
        const length = 12;
        let result;
        result = await Secretary.unlock( passphrase );
        expect( result ).toBeTruthy();
        let result1;
        result1 = await Secretary.generate( service, user, revision, length );
        expect( result1 ).toBeTypeOf('string');
        expect( result1.length ).toBe( length );
        let result2;
        result2 = await Secretary.generate( service, user, revision, length + 1 );
        expect( result2 ).toBeTypeOf('string');
        expect( result2.length ).toBe( length + 1 );
        expect( result2 == result1 ).toBeFalsy();
        let result3;
        result3 = await Secretary.generate( service, user, revision + 1, length );
        expect( result3 ).toBeTypeOf('string');
        expect( result3.length ).toBe( length );
        expect( result3 == result1 ).toBeFalsy();
        expect( result3 == result2 ).toBeFalsy();
        let result4;
        result4 = await Secretary.generate( service, user + '1', revision, length );
        expect( result4 ).toBeTypeOf('string');
        expect( result4.length ).toBe( length );
        expect( result4 == result1 ).toBeFalsy();
        expect( result4 == result2 ).toBeFalsy();
        expect( result4 == result3 ).toBeFalsy();
        let result5;
        result5 = await Secretary.generate( service + '1', user, revision, length );
        expect( result5 ).toBeTypeOf('string');
        expect( result5.length ).toBe( length );
        expect( result5 == result1 ).toBeFalsy();
        expect( result5 == result2 ).toBeFalsy();
        expect( result5 == result3 ).toBeFalsy();
        expect( result5 == result4 ).toBeFalsy();
        let result6;
        result6 = await Secretary.generate( service, user, revision, length );
        expect( result6 ).toBeTypeOf('string');
        expect( result6.length ).toBe( length );
        expect( result6 == result1 ).toBeTruthy();
    });

    test('ciphertext encoding & decoding', async () => {
        const passphrase1 = genRandomString( 32 );
        const passphrase2 = passphrase1 + '1';
        const service = genRandomString( 16 );
        const user = genRandomString( 16 );
        const revision = 0;
        const length = 12;
        let result;
        result = await Secretary.unlock( passphrase1 );
        expect( result ).toBeTruthy();
        let secret;
        secret = await Secretary.generate( service, user, revision, length );
        expect( secret ).toBeTypeOf('string');
        expect( secret.length ).toBe( length );
        let ciphertext;
        ciphertext = await Secretary.encode();
        expect( ciphertext ).toBeTruthy();
        expect( ciphertext ).toBeTypeOf('string');
        await Secretary.reset();
        try {
            result = await Secretary.unlock( passphrase2, ciphertext );
            expect( result ).toBeFalsy();
        } catch ( err ) {
            expect( err ).toBeInstanceOf( Error );
        }
        result = await Secretary.unlock( passphrase1, ciphertext );
        expect( result ).toBeTruthy();
        result = await Secretary.generate( service, user, revision, length );
        expect( result === secret ).toBeTruthy();
        result = await Secretary.encode( passphrase2 );
        expect( result === ciphertext ).toBeFalsy();
        ciphertext = result;
        await Secretary.reset();
        result = await Secretary.unlock( passphrase2, ciphertext );
        expect( result ).toBeTruthy();
    });
});
