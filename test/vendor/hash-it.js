'use strict';

/**
 * based on string passed, get the integer hash value
 * through bitwise operation (based on spinoff of dbj2
 * with enhancements for reduced collisions)
 */
function hash$1(string) {
    let index = string.length;
    let hashA = 5381;
    let hashB = 52711;
    let charCode;
    while (index--) {
        charCode = string.charCodeAt(index);
        hashA = (hashA * 33) ^ charCode;
        hashB = (hashB * 33) ^ charCode;
    }
    return (hashA >>> 0) * 4096 + (hashB >>> 0);
}

const SEPARATOR = '|';
const XML_ELEMENT_REGEXP = /\[object ([HTML|SVG](.*)Element)\]/;
const CLASSES = {
    '[object Arguments]': 0,
    '[object Array]': 1,
    '[object ArrayBuffer]': 2,
    '[object AsyncFunction]': 3,
    '[object AsyncGeneratorFunction]': 4,
    '[object BigInt]': 5,
    '[object BigInt64Array]': 6,
    '[object BigUint64Array]': 7,
    '[object Blob]': 8,
    '[object Boolean]': 9,
    '[object DataView]': 10,
    '[object Date]': 11,
    '[object DocumentFragment]': 12,
    '[object Error]': 13,
    '[object Event]': 14,
    '[object Float32Array]': 15,
    '[object Float64Array]': 16,
    '[object Function]': 17,
    '[object Generator]': 18,
    '[object GeneratorFunction]': 19,
    '[object Int8Array]': 20,
    '[object Int16Array]': 21,
    '[object Map]': 22,
    '[object Number]': 23,
    '[object Object]': 24,
    '[object Promise]': 25,
    '[object RegExp]': 26,
    '[object Set]': 27,
    '[object SharedArrayBuffer]': 28,
    '[object String]': 29,
    '[object Uint8Array]': 30,
    '[object Uint8ClampedArray]': 31,
    '[object Uint16Array]': 32,
    '[object Uint32Array]': 33,
    '[object WeakMap]': 34,
    '[object WeakRef]': 35,
    '[object WeakSet]': 36,
    CUSTOM: 37,
    ELEMENT: 38,
};
const ARRAY_LIKE_CLASSES = {
    '[object Arguments]': 1,
    '[object Array]': 2,
};
const NON_ENUMERABLE_CLASSES = {
    '[object Blob]': 1,
    '[object Generator]': 2,
    '[object Promise]': 3,
    '[object WeakMap]': 4,
    '[object WeakRef]': 5,
    '[object WeakSet]': 6,
};
const PRIMITIVE_WRAPPER_CLASSES = {
    '[object AsyncFunction]': 1,
    '[object AsyncGeneratorFunction]': 2,
    '[object Boolean]': 3,
    '[object Function]': 4,
    '[object GeneratorFunction]': 5,
    '[object Number]': 6,
    '[object String]': 7,
};
const TYPED_ARRAY_CLASSES = {
    '[object BigInt64Array]': 1,
    '[object BigUint64Array]': 2,
    '[object Float32Array]': 3,
    '[object Float64Array]': 4,
    '[object Int8Array]': 5,
    '[object Int16Array]': 6,
    '[object Uint8Array]': 7,
    '[object Uint8ClampedArray]': 8,
    '[object Uint16Array]': 9,
    '[object Uint32Array]': 10,
};
const RECURSIVE_CLASSES = {
    '[object Arguments]': 1,
    '[object Array]': 2,
    '[object ArrayBuffer]': 3,
    '[object BigInt64Array]': 4,
    '[object BigUint64Array]': 5,
    '[object DataView]': 6,
    '[object Float32Array]': 7,
    '[object Float64Array]': 8,
    '[object Int8Array]': 9,
    '[object Int16Array]': 10,
    '[object Map]': 11,
    '[object Object]': 12,
    '[object Set]': 13,
    '[object SharedArrayBuffer]': 14,
    '[object Uint8Array]': 15,
    '[object Uint8ClampedArray]': 16,
    '[object Uint16Array]': 17,
    '[object Uint32Array]': 18,
    CUSTOM: 19,
};
const HASHABLE_TYPES = {
    bigint: 'i',
    boolean: 'b',
    empty: 'e',
    function: 'g',
    number: 'n',
    object: 'o',
    string: 's',
    symbol: 's',
};

function namespaceComplexValue(classType, value) {
    return HASHABLE_TYPES.object + SEPARATOR + CLASSES[classType] + SEPARATOR + value;
}

const NON_ENUMERABLE_CLASS_CACHE = new WeakMap();
let refId = 0;
function getUnsupportedHash(value, classType) {
    const cached = NON_ENUMERABLE_CLASS_CACHE.get(value);
    if (cached) {
        return cached;
    }
    const toCache = namespaceComplexValue(classType, 'NOT_ENUMERABLE' + SEPARATOR + refId++);
    NON_ENUMERABLE_CLASS_CACHE.set(value, toCache);
    return toCache;
}

function sortByKey(first, second) {
    return first[0] > second[0];
}
function sortBySelf(first, second) {
    return first > second;
}
function sort(array, fn) {
    let subIndex;
    let value;
    for (let index = 0; index < array.length; ++index) {
        value = array[index];
        for (subIndex = index - 1; ~subIndex && fn(array[subIndex], value); --subIndex) {
            array[subIndex + 1] = array[subIndex];
        }
        array[subIndex + 1] = value;
    }
    return array;
}

// eslint-disable-next-line @typescript-eslint/unbound-method
const toString = Object.prototype.toString;
function stringifyComplexType(value, classType, state) {
    if (RECURSIVE_CLASSES[classType]) {
        return stringifyRecursiveAsJson(classType, value, state);
    }
    if (classType === '[object Date]') {
        return namespaceComplexValue(classType, value.getTime());
    }
    if (classType === '[object RegExp]') {
        return namespaceComplexValue(classType, value.toString());
    }
    if (classType === '[object Event]') {
        return namespaceComplexValue(classType, [
            value.bubbles,
            value.cancelBubble,
            value.cancelable,
            value.composed,
            value.currentTarget,
            value.defaultPrevented,
            value.eventPhase,
            value.isTrusted,
            value.returnValue,
            value.target,
            value.type,
        ].join());
    }
    if (classType === '[object Error]') {
        return namespaceComplexValue(classType, value.message + SEPARATOR + value.stack);
    }
    if (classType === '[object DocumentFragment]') {
        return namespaceComplexValue(classType, stringifyDocumentFragment(value));
    }
    const element = classType.match(XML_ELEMENT_REGEXP);
    if (element) {
        return namespaceComplexValue('ELEMENT', element[1] + SEPARATOR + value.outerHTML);
    }
    if (NON_ENUMERABLE_CLASSES[classType]) {
        return getUnsupportedHash(value, classType);
    }
    if (PRIMITIVE_WRAPPER_CLASSES[classType]) {
        return namespaceComplexValue(classType, value.toString());
    }
    // This would only be hit with custom `toStringTag` values
    return stringifyRecursiveAsJson('CUSTOM', value, state);
}
function stringifyRecursiveAsJson(classType, value, state) {
    const cached = state.cache.get(value);
    if (cached) {
        return namespaceComplexValue(classType, 'RECURSIVE~' + cached);
    }
    state.cache.set(value, ++state.id);
    if (classType === '[object Object]') {
        return value[Symbol.iterator]
            ? getUnsupportedHash(value, classType)
            : namespaceComplexValue(classType, stringifyObject(value, state));
    }
    if (ARRAY_LIKE_CLASSES[classType]) {
        return namespaceComplexValue(classType, stringifyArray(value, state));
    }
    if (classType === '[object Map]') {
        return namespaceComplexValue(classType, stringifyMap(value, state));
    }
    if (classType === '[object Set]') {
        return namespaceComplexValue(classType, stringifySet(value, state));
    }
    if (TYPED_ARRAY_CLASSES[classType]) {
        return namespaceComplexValue(classType, value.join());
    }
    if (classType === '[object ArrayBuffer]') {
        return namespaceComplexValue(classType, stringifyArrayBuffer(value));
    }
    if (classType === '[object DataView]') {
        return namespaceComplexValue(classType, stringifyArrayBuffer(value.buffer));
    }
    if (NON_ENUMERABLE_CLASSES[classType]) {
        return getUnsupportedHash(value, classType);
    }
    return namespaceComplexValue('CUSTOM', stringifyObject(value, state));
}
function stringifyArray(value, state) {
    let index = value.length;
    const result = new Array(index);
    while (--index >= 0) {
        result[index] = stringify(value[index], state);
    }
    return result.join();
}
function stringifyArrayBufferModern(buffer) {
    return Buffer.from(buffer).toString('utf8');
}
function stringifyArrayBufferFallback(buffer) {
    return String.fromCharCode.apply(null, new Uint16Array(buffer));
}
function stringifyArrayBufferNone() {
    return 'UNSUPPORTED';
}
function stringifyDocumentFragment(fragment) {
    const children = fragment.children;
    let index = children.length;
    const innerHTML = new Array(index);
    while (--index >= 0) {
        innerHTML[index] = children[index].outerHTML;
    }
    return innerHTML.join();
}
const stringifyArrayBuffer = typeof Buffer !== 'undefined' && typeof Buffer.from === 'function'
    ? stringifyArrayBufferModern
    : typeof Uint16Array === 'function'
        ? stringifyArrayBufferFallback
        : stringifyArrayBufferNone;
function stringifyMap(map, state) {
    const result = new Array(map.size);
    let index = 0;
    map.forEach((value, key) => {
        result[index++] = [stringify(key, state), stringify(value, state)];
    });
    sort(result, sortByKey);
    while (--index >= 0) {
        result[index] = '[' + result[index][0] + ',' + result[index][1] + ']';
    }
    return '[' + result.join() + ']';
}
function stringifyObject(value, state) {
    const properties = sort(Object.getOwnPropertyNames(value), sortBySelf);
    const length = properties.length;
    const result = new Array(length);
    let index = length;
    while (--index >= 0) {
        result[index] = properties[index] + ':' + stringify(value[properties[index]], state);
    }
    return '{' + result.join() + '}';
}
function stringifySet(set, state) {
    const result = new Array(set.size);
    let index = 0;
    set.forEach((value) => {
        result[index++] = stringify(value, state);
    });
    return '[' + sort(result, sortBySelf).join() + ']';
}
function stringify(value, state) {
    const type = typeof value;
    if (value == null || type === 'undefined') {
        return HASHABLE_TYPES.empty + value;
    }
    if (type === 'object') {
        return stringifyComplexType(value, toString.call(value), 
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        state || { cache: new WeakMap(), id: 1 });
    }
    if (type === 'function' || type === 'symbol') {
        return HASHABLE_TYPES[type] + value.toString();
    }
    if (type === 'boolean') {
        return HASHABLE_TYPES.boolean + +value;
    }
    return HASHABLE_TYPES[type] + value;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function hash(value) {
    return hash$1(stringify(value, undefined));
}

exports.hash = hash;
//# sourceMappingURL=index.cjs.map
