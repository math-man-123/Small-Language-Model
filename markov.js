import { Hashmap } from './hashmap.js';


/**
 * Checks if array equals given target.
 * @param {any[]} target array to check
 * @returns {boolean} true if equal
 */
Array.prototype.equals = function(target) {
    // check if target is even an array
    if (!Array.isArray(target)) return false;

    // check length and compare shallow values
    if (this.length != target.length) return false;
    return this.every((val, i) => val == target[i]);
}

/**
 * Checks if array matches given tail.
 * @param {any[]} tail to check
 * @returns {boolean} true if match
 */
Array.prototype.endsWith = function(tail) {
    return this.slice(-tail.length).equals(tail);
}

/**
 * Returns last element of array.
 * @returns {any} last element
 */
Array.prototype.last = function() { 
    return this[this.length - 1] || ''; 
}


/** @class  */
class Edge {
    /**
     * Creates a edge instance consisting of its target's 
     * ID and its weight. Weights are handled as integers.
     * @param {string} targetID identifier of target
     * @param {int} weight natural number >= 1
     */
    constructor({ targetID, weight = 1 }) {
        Object.assign(this, { targetID, weight });
    }

    /**
     * Simply adds given weight to edge weight.
     * @param {int} weight natural number >= 1
     */
    addWeight(weight) { this.weight += weight; }
}


/** @class  */
class Vertex {
    _edges; // all outgoing edges
    get edges() { return this._edges; }

    /**
     * Creates a vertex instance consisting
     * of its ID and all its current edges.
     * @param {string[]} ID unique identifier
     * @param {Edge[]} edges array of edges
     */
    constructor({ ID, edges = [] }) {
        Object.assign(this, { ID });
        this._edges = edges;

        // find initial total weight
        const total = (sum, e) => sum + e.weight;
        this.weight = edges.reduce(total, 0);
    }

    /**
     * Finds edge with given target identifier.
     * Returns undefined if no such edge exists.
     * @param {string[]} targetID identifier of target
     * @returns {Edge} edge instance or undefined
     */
    _findEdge(targetID) {
        const match = (e) => e.targetID.equals(targetID);
        return this._edges.find(match);
    }

    /**
     * Creates new edge to target vertex given by
     * identifier with given weigth. If such an
     * edge already exists just updates its weight.
     * @param {string[]} targetID identifier of target
     * @param {int} weight natural number >= 1
     */
    addEdge({ targetID, weight = 1 }) {
        this.weight += weight; // update total weight

        // if edge already exists just update weight
        let edge = this._findEdge(targetID);
        if (edge) { edge.addWeight(weight); return; }
        
        // else create new edge and add it to _edges
        edge = new Edge({ targetID, weight });
        this._edges.push(edge); 
    }
}


/** @class  */
export class Chain {
    _vertices = new Hashmap(); // all vertices
    _state = undefined; // current chain state
    get state() { return this._state; }
    get ID() { return `${this.name}${this.depth}`; }
    
    /**
     * Creates an Chain instance either with an empty
     * hashmap, or by training it from split training
     * data, or by loading a pretrained hashmap model.
     * @param {string} name of the model
     * @param {string[]} token split training data
     * @param {int} depth maximum training depth
     * @param {obj} model saved pretrained hashmap
     */
    constructor({ name, token, depth = 1, model } = {}) { 
        // create from token list
        if (token) {
            Object.assign(this, { name, depth });
            this.trainFrom(token, depth);
        }

        // create from model file
        else if (model) {
            this.name = model.name;
            this.depth = model.depth;
            this._vertices = new Hashmap(model.map);
        }
    }

    /**
     * Finds vertex with given ID. Returns 
     * undefined if nothing was found.
     * @param {string[]} ID identifier of target
     * @returns {Vertex} vertex or random
     */
    _findVertex(ID) {
        const match = (v) => v.ID.equals(ID);
        return this._vertices.find(ID, match);
    }

    /** 
     * Creates new vertex with given identifier
     * and with given edges. If such an vertex 
     * already exists just updates its edges.
     * @param {string[]} ID identifier of vertex
     * @param {obj} edges { targetID, weight }[] 
     */
    addVertex({ ID, edges = [] }) {
        // if vertex already exists just update edges
        let vertex = this._findVertex(ID);
        const update = edge => vertex.addEdge(edge);
        if (vertex) { edges.forEach(update); return; }

        // else create new vertex and add it to _vertices
        vertex = new Vertex({ ID });
        const create = edge => vertex.addEdge(edge);
        edges.forEach(create);

        this._vertices.add(ID, vertex);
    }

    /**
     * Tries to set state to vertex with given ID.
     * Reduces ID depth if no state was found until
     * ID is empty. Then it returns and sets undefined.
     * @param {string[]} ID of vertex to set
     * @returns {Vertex} set vertex 
     */
    setState(ID) {
        let subID = ID.slice(-this.depth);

        // reduce ID depth until vertex matches
        let vertex = this._findVertex(subID);
        while(!vertex && subID.length) {
            subID.shift();
            vertex = this._findVertex(subID);
        }

        this._state = vertex;

        if (!this._state) return;
        return vertex;
    }

    /**
     * Checks if given ID represents a model state.
     * @param {string[]} ID indetifier to check
     * @returns {boolean} true: ID is model state
     */
    testState(ID) { return !!this._findVertex(ID); }

    /**
     * Advances state of markov chain. If chain contains edges that 
     * point to targets that do not exist (wrong target ID) returns 
     * undefined. If current state is undefined picks random state.
     * @param {int} depth depth to pick randomly if needed
     * @returns {Vertex} new current vertex of model state
     */
    nextState(depth = this.depth) {
        // if current state undefined overwrite with random one
        if (!this._state) this._state = this._vertices.getRandom(depth);

        // returns a random integer in {0,...,N-1}
        const randInt = (N) => Math.floor(Math.random() * N);

        // pick random edge according to their weights
        // and advance current state to target vertex
        const pivot = randInt(this._state.weight);
        let threshold = 0;
        
        for (const { weight, targetID } of this._state.edges) {
            // update threshold with weight then check pivot
            if ((threshold += weight) > pivot) {
                this._state = this._findVertex(targetID);
                return this._state;
            }
        }
    }

    /**
     * Creates an ID array of a token subset.
     * @param {string[]} token split input data
     * @param {int} depth length of subset
     * @param {int} i index of possible joined ID
     * @returns {string[]} ID array
     */
    _depthID(token, depth, i) { 
        return token.slice(i, i + depth); 
    }

    /**
     * Builds up the markov chain(s) from a given list of tokens. Each 
     * unique token gets a vertex with an edge to the next token in 
     * the list. If an edge is encountered twice updates its weight.
     * @param {string[]} token split input data (token.length > depth)
     * @param {int} depth number of chains / num token to combine
     */
    trainFrom(token, depth = this.depth) {
        if (depth != this.depth) this.depth = depth;

        // needs to be an arrow function so this = chain
        const train = (depth) => {
            const ID = (i) => this._depthID(token, depth, i);
            
            // iterate token list and create vertices accordingly
            for (let i = 0; i < token.length - depth; i++) {
                const edges = [{ targetID: ID(i + 1) }];
                const vertex = { ID: ID(i), edges };
                this.addVertex(vertex);
            }
        }

        // create a separate markov chain for each depth
        do train(depth); while (--depth > 0);
    }

    /**
     * Returns a copy of all edges of given vertex.
     * @param {string[]} ID identifier of vertex
     * @returns {Edge[]} all edges of vertex
     */
    getEdges(ID = this._state?.ID) {
        const vertex = this._findVertex(ID);
        if (!vertex) return undefined;
        else return [...vertex.edges];
    }

    /**
     * Generates output token based on given seed.
     * Tries to increase context depth with each
     * generated token until maximum is reached.
     * Keeps going until ender is met if not empty.
     * @param {string[]} seed input token
     * @param {int} length to generate 
     * @param {string[]} ender to check at end
     * @param {string[]} save max token to generate
     * @param {int} depth max context to use
     * @returns {string[]} output token
     */
    generate(
        { seed, length, ender = [], save = 100, depth = this.depth }
    ) {
        // do not exceed maximum model depth
        depth = Math.min(depth, this.depth);
        const output = [];
        
        // try to increase currently used context
        let context = Math.min(seed.length, depth);
        let vertex = {};
        do {
            const i = Math.max(seed.length - context, 0);
            const ID = this._depthID(seed, context, i);
            
            // if ID is empty get random vertex instead
            if (!ID.length) 
                vertex = this._vertices.getRandom(depth);

            else vertex = this.setState(ID);
        }
        // pre-decrement to not include depth = 0
        while(!vertex && --context > 0);
        

        // if max context generate until length = 0 
        // and correct end but no more then save
        if (context == depth) {
            let keepGoing = true;
            while((length-- > 0 || keepGoing) && save-- > 0) {
                const vertex = this.nextState();
                const token = vertex.ID.last();
                output.push(token);

                // check for correct ending
                keepGoing = !ender.includes(output.last());
                if (!ender.length) keepGoing = false;
            }
        }

        else {
            // context + 1 since its decremented onec extra
            const vertex = this.nextState(context + 1);
            const token = vertex.ID.last();
            output.push(token);

            // include new token and retry increasing depth
            const newSeed = [...seed, token]; length--;
            const subset = this.generate(
                { seed: newSeed, length, ender, save, depth });
            output.push(...subset);
        }
        
        return output;
    }

    /**
     * Parses a given token list, reconstructs
     * biggest possible state chain, and finally
     * calculates convex combination of average
     * and median of all transitions u_scores.
     * @param {string[]} token input
     * @param {int} depth max context
     * @param {float} alpha median factor 
     * @returns 
     */
    U_SCORE(token, depth, alpha = 0.6) {
        /**
         * Uniqueness score i.e. lieklihood of NOT
         * choosing a given connection (given by IDs).
         * @param {string[]} ID1 of first state
         * @param {string[]} ID2 of second state
         * @returns {float} likelihood NOT connected
         */
        const uniqueness = (ID1, ID2) => {
            const edges = this.getEdges(ID1);
            // if (!edges) throw new Error('U_SCORE: NO EDGES');

            const target = (edge) => edge.targetID.equals(ID2);
            const choiceWeight = edges.find(target)?.weight || 0;

            const sumWeight = (sum, edge) => sum + edge.weight;
            const totalWeight = edges.reduce(sumWeight, 0);
            // if (!totalWeight) throw new Error('U_SCORE: NO TOTAL');

            return 1 - choiceWeight / totalWeight;
        };

        /**
         * Convex combination of average and 
         * median of given uniqueness scores.
         * @param {float[]} U_SCORE all scores
         * @param {float} alpha median factor
         * @returns {float} convex combination
         */
        const convex = (U_SCORE, alpha) => {
            // first sort given U_SCORE ascending
            U_SCORE.sort((a, b) => a - b);

            let median;
            // if even average two middle values
            if (!(U_SCORE.length % 2)) {
                let upper = U_SCORE[U_SCORE.length / 2];
                let lower = U_SCORE[U_SCORE.length / 2 - 1];
                median = (lower + upper) / 2;
            }
            // if odd just pick the middle value
            else median = U_SCORE[(U_SCORE.length - 1) / 2];

            let average = 0;
            for (let score of U_SCORE) average += score;
            average /= U_SCORE.length;

            // convex combination of median and average
            let score = alpha * median;
            score += (1 - alpha) * average;

            return score;
        };

        // gets IDs of adjacent states from token
        const ID = (depth) => {
            depth = Math.min(depth, token.length - 1);

            const ID1 = token.slice(0, depth);
            const ID2 = token.slice(1, depth + 1);

            return { ID1, ID2 };
        };

        // checks if states given by IDs are connected
        const connected = (ID1, ID2) => {
            const edges = this.getEdges(ID1);
            if (!edges) return false;

            const target = (edge) => edge.targetID.equals(ID2);

            return edges.some(target);
        };

        // prepare token tail for testing criteria
        // by removing all non states from tail
        while (token.length) {
            const ID = [token.last()];
            if (this.testState(ID)) break;
            token.pop();
        }

        // go over all token while reconstructing
        // biggest possible states for u_scores
        const U_SCORE = [];
        out: while (token.length) {
            // start with biggest depth then reduce
            for (let i = 0; i < depth; i++) {
                const { ID1, ID2 } = ID(depth - i);
                if (!connected(ID1, ID2)) continue;

                // if states can be connected push u_score
                const score = uniqueness(ID1, ID2);
                U_SCORE.push(score);

                // since token get shifted after this - 1
                const length = token.length - 1 == ID2.length;
                if ( length && token.endsWith(ID2)) break out;
                break; // always break at least inner loop
            }
            token.shift();
        }

        return convex(U_SCORE, alpha);
    }

    /**
     * MUST BE RUN IN NODE.JS!
     * Compresses and saves the Chain's hashmap
     * as name.json.gz to be loaded up later.
     * @param {string} name file name
     */
    async saveModel() {
        const zlib = await import('zlib');
        const fs = await import('fs');
        const { name, depth } = this;
        
        console.log(`\n>> creating model ${name}`);
        const json = JSON.stringify({ 
            name, depth, map: this._vertices
        });

        const model = zlib.gzipSync(json);
        fs.writeFileSync(`./model/${name}.json.gz`, model, 'utf-8');

        const size = `(${(model.length / 1024).toFixed(1)} KB)`;
        console.log(`${name}.json.gz saved ${size}`);
    }
}
