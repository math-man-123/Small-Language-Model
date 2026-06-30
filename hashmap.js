/** @class */
export class Hashmap {
    _map; _power; _total = 0;

    /**
     * Creates an Hashmap instance with 2^k map 
     * buckets and a given load threashold alpha.
     * @param {int} power power = k
     * @param {float} alpha load threashold
     * @param {int} total number of elements
     * @param {any[]} map array to build from
     */
    constructor({ power = 4, alpha = 0.7, total, map } = {}) {
        this._power = power; this.alpha = alpha;

        if (total && map) {
            this._total = total; this._map = map;
        }
        else this._map = this._initMap(power);
    }

    /**
     * Creates an empty 2-dim array of sike 2^k.
     * @param {int} power power = k
     * @returns {any[][]} 2-dim empty array
     */
    _initMap(power) {
        const map = [], size = 1 << power;
        for (let i = 0; i < size; i++) map[i] = [];
        return map;
    }

    /**
     * DJB2a hash (DJB = Daniel J. Bernstein, a = xor-variant). 
     * Computes [h_{i} ​= ((h_{i−1} ​× lambda) xor c_i​) mod 2^32]. 
     * - h_0 = 5381 | lambda = 33 | c_i = character code
     * - h_0, lambda values are found empirically to work best
     * - multiplication by 33 is done via: (hash << 5) + hash
     * - modulo 2^32 is done via: hash >>> 0
     * - final hash is h_n where n = length of the given string
     * @param {string} string to be hashed
     * @returns {int} unsigned 32-bit integer
     */
    _hashDJB2a(string) {
        let hash = 5381;
        for (let i = 0; i < string.length; i++) {
            // multiplication with 33 via left shift
            hash = (hash << 5) + hash;
            hash ^= string.charCodeAt(i);
        }

        // modulo 2^32 via unsigned right shift
        return hash >>> 0;
    }

    /**
     * Wrapper function for the actual hash above.
     * Allows to also hash entire string arrays.
     * @param {string} input to be hashed
     * @param {string[]} input to be hashed
     * @returns unsigned 32-bit integer
     */
    _hash(input) {
        if (Array.isArray(input)) input = input.join();
        return this._hashDJB2a(input);
    }

    /**
     * Gets the bucket index matching given ID.
     * - uses hash on ID to do this quickly
     * - modulo via: A & (2^k - 1) = A mod 2^k
     * @param {string} ID identifier of element
     * @returns {int} corresponding index
     */
    _index(ID) {
        let index = this._hash(ID);
        index &= (1 << this._power) - 1;
        return index;
    }

    /**
     * Doubles the number of buckets in the current map
     * and redistributes all elements according to their
     * new hash indices. Caps out 2^32 buckets since we
     * work with a 32-bit unsigned integer hash.
     */
    _resize() {
        // limit size to 2^32 (32-bit unsigned int)
        if (this._power >= 32) return;
        
        this._power += 1;
        const map = this._initMap(this._power);

        // copy old elements but using new hash index
        for (const bucket of this._map)
            for (const el of bucket)
                map[this._index(el.ID)].push(el);
            
        this._map = map;
    }

    /**
     * Quickly adds given element to map by hashing 
     * its ID. Resizes map by factor of 2 if needed.
     * @param {string} ID identifier of element
     * @param {any} el actual element to store
     */
    add(ID, el) {
        this._map[this._index(ID)].push(el);
        this._total += 1;

        // trigger resize if N / M > alpha where
        // N = total elements and M = total buckets
        const load = this._total / (1 << this._power);
        if (load > this.alpha) this._resize();
    }

    /**
     * Quickly finds matching element by hashing its ID.
     * Returns undefined when given empty ID (length = 0).
     * @param {string} ID identifier of element
     * @param {function} match condition to match
     * @returns {any} matching element with ID 
     */
    find(ID, match) {
        if (!ID?.length) return undefined;
        return this._map[this._index(ID)].find(match);
    }

    /**
     * Creates custom JSON representation of 
     * the hashmap. Includes private fields.
     * @returns {obj} JSON representation
     */
    toJSON() {
        // since vertex edges are private we need this
        const map = this._map.map((bucket) => bucket.map(
            (el) => ({ ID: el.ID, weight: el.weight, edges: el.edges })));

        return {
            total: this._total, power: this._power,
            alpha: this.alpha, hash: 'DJB2a', map }
    }

    /**
     * Returns random element of hashmap.
     * @param {int} depth of element ID
     * @returns {any} choosen element
     */
    getRandom(depth) {
        const randIdx = (N) => Math.floor(Math.random() * N);

        let bucket, element;
        do {
            // pick random bucket that has elements
            do bucket = this._map[randIdx(this._map.length)]; 
            while (!bucket.length);

            // pick random element and check it
            element = bucket[randIdx(bucket.length)];
        } while (element.ID.length != depth);

        return element;
    }

    /**
     * Executes given callback function 
     * on each element of the hashmap.
     * @param {function} callback 
     */
    forEach(callback) {
        for (const bucket of this._map)
            for (const el of bucket) callback(el, el.ID);
    }
}
