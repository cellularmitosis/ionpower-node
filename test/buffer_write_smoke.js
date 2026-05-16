// Buffer.prototype.write(string[, offset[, length]][, encoding]) smoke.
// Pg-protocol's buffer-writer.js calls `this.buffer.write(string, offset)`;
// pre-v1.2 we threw "this.buffer.write is not a function".

var assertions = 0;
function eq(label, actual, expected) {
    assertions++;
    if (actual !== expected) {
        console.log('FAIL ' + label + ': expected ' + JSON.stringify(expected)
            + ', got ' + JSON.stringify(actual));
        process.exit(1);
    }
}
function bytesEq(label, buf, expectedBytes) {
    assertions++;
    if (buf.length < expectedBytes.length) {
        console.log('FAIL ' + label + ': buffer too small ('
            + buf.length + ' < ' + expectedBytes.length + ')');
        process.exit(1);
    }
    for (var i = 0; i < expectedBytes.length; i++) {
        if (buf[i] !== expectedBytes[i]) {
            console.log('FAIL ' + label + ': byte[' + i + '] expected '
                + expectedBytes[i] + ', got ' + buf[i]);
            process.exit(1);
        }
    }
}

// (string) — defaults to offset=0, full length, utf8.
var b1 = Buffer.alloc(8);
eq('write(s) returns bytes-written',  b1.write('abc'), 3);
bytesEq('write(s) wrote utf8', b1, [97, 98, 99, 0, 0, 0, 0, 0]);

// (string, offset) — pg-protocol's call shape.
var b2 = Buffer.alloc(8);
eq('write(s,off) returns bytes',  b2.write('xy', 3), 2);
bytesEq('write(s,off) placed at offset', b2, [0, 0, 0, 120, 121, 0, 0, 0]);

// (string, encoding).
var b3 = Buffer.alloc(8);
eq('write(s,enc=utf8) bytes', b3.write('hi', 'utf8'), 2);
bytesEq('write(s,enc=utf8)', b3, [104, 105, 0, 0, 0, 0, 0, 0]);

// (string, offset, encoding).
var b4 = Buffer.alloc(8);
eq('write(s,off,enc) bytes', b4.write('A', 4, 'utf8'), 1);
bytesEq('write(s,off,enc)', b4, [0, 0, 0, 0, 65, 0, 0, 0]);

// (string, offset, length, encoding) — explicit length truncates.
var b5 = Buffer.alloc(8);
eq('write(s,off,len,enc) bytes', b5.write('abcdef', 1, 3, 'utf8'), 3);
bytesEq('write(s,off,len,enc) truncated', b5, [0, 97, 98, 99, 0, 0, 0, 0]);

// length cap: writing more than fits clamps to maxLen.
var b6 = Buffer.alloc(4);
eq('write overflow returns clamped', b6.write('abcdef', 1), 3);
bytesEq('write overflow', b6, [0, 97, 98, 99]);

// hex encoding.
var b7 = Buffer.alloc(3);
eq('write(hex) bytes', b7.write('aabbcc', 'hex'), 3);
bytesEq('write(hex)', b7, [0xaa, 0xbb, 0xcc]);

// base64 encoding.
var b8 = Buffer.alloc(5);
eq('write(base64) bytes', b8.write('aGVsbG8=', 'base64'), 5);
bytesEq('write(base64)', b8, [104, 101, 108, 108, 111]);  // "hello"

// Surface check: Buffer.prototype.write is callable.
if (typeof Buffer.prototype.write !== 'function') {
    console.log('FAIL: Buffer.prototype.write is not a function');
    process.exit(1);
}

// Signed integer writes — pg-protocol uses writeInt32BE for the message-
// body length header. Two's complement on the wire is identical to the
// unsigned form (JS bitwise ops mask via int32 coercion).
var s = Buffer.alloc(4);
eq('writeInt8 positive', s.writeInt8(127, 0), 1);
bytesEq('writeInt8 positive', s, [0x7f, 0, 0, 0]);
s = Buffer.alloc(4);
eq('writeInt8 negative', s.writeInt8(-1, 0), 1);
bytesEq('writeInt8 negative', s, [0xff, 0, 0, 0]);

s = Buffer.alloc(4);
eq('writeInt16BE', s.writeInt16BE(0x1234, 0), 2);
bytesEq('writeInt16BE', s, [0x12, 0x34, 0, 0]);

s = Buffer.alloc(4);
eq('writeInt32BE 0x40', s.writeInt32BE(0x40, 0), 4);
bytesEq('writeInt32BE 0x40', s, [0, 0, 0, 0x40]);
s = Buffer.alloc(4);
eq('writeInt32BE -1', s.writeInt32BE(-1, 0), 4);
bytesEq('writeInt32BE -1', s, [0xff, 0xff, 0xff, 0xff]);

s = Buffer.alloc(4);
eq('writeInt32LE 0x12345678', s.writeInt32LE(0x12345678, 0), 4);
bytesEq('writeInt32LE 0x12345678', s, [0x78, 0x56, 0x34, 0x12]);

console.log('PASS buffer_write_smoke (' + assertions + ' assertions)');
