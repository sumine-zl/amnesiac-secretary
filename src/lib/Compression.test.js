// Compression.test.js
// Authored and handmaded by Sumine ZL
// Copyright (c) 2024-2026 Sumine ZL <sumine_zl+amnesiac-secretary@hotmail.com>

import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import Compression from './Compression'

describe('Compression convertions', () => {

    test('buffer compression & decompression', async () => {
        const str = await readFile( __filename, 'utf8');
        const buf = Compression.stringToBuffer( str );
        let result;
        result = await Compression.compress( buf );
        expect( result ).toBeTruthy();
        expect( result.byteLength ).toBeLessThan( buf.byteLength );
        result = await Compression.decompress( result );
        expect( result ).toBeTruthy();
        expect( result ).toBeInstanceOf( ArrayBuffer );
        expect(( new Uint8Array( result )).toString() ).toBe(
            ( new Uint8Array( buf )).toString()
        );
    });
});
