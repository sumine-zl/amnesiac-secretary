// Compression.js
// The compression library for Amnesiac Secretary
// Authored and handmaded by Sumine ZL
// Copyright (c) 2024-2026 Sumine ZL <sumine_zl+amnesiac-secretary@hotmail.com>

export default {

    testCompressionSupport() {
        return ( typeof CompressionStream === 'function' &&
            typeof DecompressionStream === 'function'
        );
    },

    async compress( buf ) {
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
    },

    async decompress( buf ) {
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
};
