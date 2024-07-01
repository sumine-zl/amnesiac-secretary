// Util.test.js

import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import Util from './Util'

describe('Util convertions', () => {

    test('string <--> buffer inter-conversion', () => {
        const length = 32;
        const str = String.fromCharCode( ...(
            [...Array( length ).keys()].map(( i ) => {
                return 33 + Math.floor( Math.random() * 94 );
            })
        ));
        let result;
        result = Util.stringToBuffer( str );
        expect( result ).toBeTruthy();
        expect( result ).toBeInstanceOf( Uint8Array );
        expect( result.byteLength ).toBe( str.length );
        result = Util.bufferToString( result );
        expect( result ).toBeTypeOf('string');
        expect( result ).toBe( str );
    });

    test('buffer <--> base64 inter-conversion', () => {
        const length = 32;
        const buf = Uint8Array.from(
            [...Array( length ).keys()].map(( i ) => {
                return Math.floor( Math.random() * 256 );
            })
        );
        let result;
        result = Util.bufferToBase64( buf );
        expect( result ).toBeTruthy();
        expect( result ).toBeTypeOf('string');
        expect( result.length ).toBeGreaterThan( buf.byteLength );
        result = Util.base64ToBuffer( result );
        expect( result ).toBeInstanceOf( Uint8Array );
        expect( result.toString() ).toBe( buf.toString() );
    });

    test('buffer compression & decompression', async () => {
        const str = await readFile( __filename, 'utf8');
        const buf = Util.stringToBuffer( str );
        let result;
        result = await Util.compress( buf );
        expect( result ).toBeTruthy();
        expect( result.byteLength ).toBeLessThan( buf.byteLength );
        result = await Util.decompress( result );
        expect( result ).toBeInstanceOf( Uint8Array );
        expect( result.toString() ).toBe( buf.toString() );
    });

});
