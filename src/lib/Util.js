// Util.js

export default {

    stringToBuffer( str ) {
        return ( Uint8Array.from(
            String( str ),
            ( c ) => c.charCodeAt( 0 )
        )).buffer;
    },

    bufferToString( buf ) {
        return String.fromCharCode( ...( new Uint8Array( buf )));
    },

    bufferToBase64( buf ) {
        return window.btoa( String.fromCharCode( ...( new Uint8Array( buf ))));
    },

    base64ToBuffer( str ) {
        return ( Uint8Array.from(
            window.atob( str ),
            ( c ) => c.charCodeAt( 0 )
        )).buffer;
    },

    bufferToHex( buf ) {
        return ( new Uint8Array( buf )).map(( b ) => {
            return b.toString( 16 ).padStart( 2, '0')
        }).join('');
    },

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
    },

    sba4Pack( arr ) {
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
    },

    sba4Unpack( buf ) {
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

};
