// Util.js

export default {

    stringToBuffer( str ) {
        return Uint8Array.from( String( str ), ( c ) => c.charCodeAt( 0 ));
    },

    bufferToString( buf ) {
        return String.fromCharCode( ...(new Uint8Array( buf )));
    },

    bufferToBase64( buf ) {
        return window.btoa( String.fromCharCode( ...(new Uint8Array( buf ))));
    },

    base64ToBuffer( str ) {
        return Uint8Array.from( window.atob( str ), ( c ) => c.charCodeAt( 0 ));
    },

    bufferToHex( buf ) {
        return (new Uint8Array( buf )).map(( b ) => {
            return b.toString( 16 ).padStart( 2, '0')
        }).join('');
    },

    async compress( buf ) {
        const stream = new CompressionStream('deflate-raw');
        const writer = stream.writable.getWriter();
        writer.write( buf );
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
        const result = new Uint8Array( size );
        let offset = 0;
        for ( const chunk of output ) {
            result.set( chunk, offset );
            offset += chunk.byteLength;
        }
        return result;
    },

    async decompress( buf ) {
        const stream = new DecompressionStream('deflate-raw');
        const writer = stream.writable.getWriter();
        writer.write( buf );
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
        const result = new Uint8Array( size );
        let offset = 0;
        for ( const chunk of output ) {
            result.set( chunk, offset );
            offset += chunk.byteLength;
        }
        return result;
    },

};
