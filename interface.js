import { Tokenizer } from './tokenizer.js';
import { Chain } from './markov.js';

const tokenizer = new Tokenizer();

// ---------------------------------------------------------------
// ---------------------- HTML ELEMENT GRAB ----------------------
// ---------------------------------------------------------------

const $ = (ID) => document.getElementById(ID);

// complete interface element
const interfaceHTML = $('interface');

// suggestion bubbles of interface
const suggestionHTML = $('suggestion');
const bubblesHTML = $("bubbles");

// textarea element of interface
const tokMarkerHTML = $('token-marker');
const textHTML = $('textarea');

// select elements of interface
const modelHTML = $('model');
const contextHTML = $('context');

// button elements of interface
const generateBTN = $('generate-btn');
const tokenBTN = $('tokenizer-btn');
const contextBTN = $('context-btn');

// score element of interface
const scoreHTML = $('u-score');


// ---------------------------------------------------------------
// -------------------- FANCY TEXT OUTPUT CODE -------------------
// ---------------------------------------------------------------

// Clears the textarea.
textHTML.clear = function() {
    this.value = '';
}

// Trims the textarea.
textHTML.trim = function() {
    this.value = this.value.trim();
}

/**
 * Simple log function to teaxtarea.
 * @param {string} msg to log 
 */
textHTML.log = function(msg) {
    this.value += msg;
}

/**
 * Fancy logging method. Writes char by char
 * of given msg with given delay between each.
 * @param {string} msg to log
 * @param {int} delay to wait
 */
textHTML.write = async function(msg, delay = 10) {
    for(const char of msg) {
        this.log(char); 

        // update all UI elements
        renderToken(); renderContext();
        updateModelState(); updateScore();
 
        await time(delay);
    }
}

/**
 * Returns copy of string called but 
 * with first character capitalized.
 * @returns {str} same but first big 
 */
String.prototype.capFirst = function() {
    if (!this?.length) return this;
    return this[0].toUpperCase() + this.slice(1);
}

/**
 * Writes a given list of token nicely to the 
 * textarea. Waits for delay after each char.
 * @param {string[]} token to write
 * @param {boolean} useSpace false: no space
 * @param {int} delay to wait in ms 
 */
textHTML.writeToken = async function(
    token, useSpace = true, delay = 10
) {
    let space = ' ', special = ['.', '!', '?'];
    let capitalize = false; this.readOnly = true;

    // if flag is set turn space into empty string
    if (!useSpace) space = '';

    // finds next non special token if possible
    const nextNonSpecial = () => {
        let tok = token.shift();
        while (special.includes(tok) && token.length)
            tok = token.shift(); 

        return tok;
    }

    // initial clean up of textarea
    this.trim();
    this.value = this.value.capFirst();

    // if textarea empty wirte first non
    // special token with cap first to it
    if (!this.value) {
        let tok = nextNonSpecial();
        await this.write(tok.capFirst(), delay);
    }

    // if textarea has text check if last char is special if 
    // so wirte first non special token with cap first to it
    else if (special.includes(this.value.at(-1))) {
        let tok = nextNonSpecial();
        await this.write(space + tok.capFirst(), delay);
    }
    
    for (let tok of token) {
        // cap first if needed (after special char)
        if (capitalize) {
            tok = tok.capFirst();
            capitalize = false;
        }

        // prefix space only for normal words
        if (!special.includes(tok)) 
            tok = space + tok;
        else capitalize = true;

        await this.write(tok, delay);
    }

    this.readOnly = false;
}

/**
 * Used to wait for a given ms.
 * Call e.g. as await time(10).
 * @param {int} ms to wait (non blocking)
 * @returns {Promise} resolves after ms
 */
function time(ms) {
    return new Promise(r => setTimeout(r, ms));
}


// ---------------------------------------------------------------
// ------------------ SUGGESTION ELEMENT LOGIC -------------------
// ---------------------------------------------------------------

/**
 * Resizes the suggestion element 
 * to the width of the textarea.
 */
function resizeSuggestion() {
    let width = textHTML.offsetWidth;
    const { paddingRight, paddingLeft } = getComputedStyle(suggestionHTML);
    width -= parseFloat(paddingLeft) + parseFloat(paddingRight);
    
    suggestionHTML.style.width = width  + 'px';
}

// apply resize on resize and initial resize on load
(new ResizeObserver(resizeSuggestion)).observe(textHTML);
resizeSuggestion();

/**
 * Makes bubbles scroll horizontally.
 * @param {obj} event scroll
 */
function scrollHorizontally(event) {
    event.preventDefault();
    bubblesHTML.scrollLeft += event.deltaY;
}

// aplly scroll on wheel
bubblesHTML.onwheel = scrollHorizontally;

/**
 * Handles keyboard input for navigation. 
 * @param {obj} event given by keydown
 */
function navigateSuggestions(event) {
    let bubbles = bubblesHTML.querySelectorAll('.bubble');
    if (!(bubbles = [...bubbles])) return;

    const selected = (el) => el.classList.contains('selected');
    const currentIndex = bubbles.findIndex(selected);

    const select = (el) => el?.classList.add('selected');
    const unselect = (el) => el?.classList.remove('selected'); 

    switch (event.code) {
        // move seletion to next bubble
        case 'Tab': 
            event.preventDefault();

            unselect(bubbles[currentIndex]);          
            select(bubbles[currentIndex + 1]);
            break;

        // unselect current bubble (reset tab)
        case 'Escape':
            unselect(bubbles[currentIndex]); 
            break;

        // click currently selected bubble
        case 'Space':
            bubbles[currentIndex]?.onclick();
            break;
    }
}
textHTML.onkeydown = navigateSuggestions;


/**
 * Updates model state and creates
 * corresponding suggestions bubbles.
 */
function updateModelState() {
    bubblesHTML.innerHTML = '';

    const model = MODEL[modelHTML.value];
    if (!model) return;

    // set current state according to sub ID
    const { subID, restID } = getSplit(textHTML.value);
    model.setState(subID);

    // get input filtered edges from current state
    const matchingStart = (edge) => 
        edge.targetID.last().startsWith(restID.last());
    let edges = model.getEdges()?.filter(matchingStart);

    // if no edges spawn <random> bubble
    if (!edges?.length) { spawnBubble('&lt;random&gt;' ,1); return; }
    
    // sort remaining edges by their weight
    const descending = (a,b) => b.weight - a.weight;
    edges.sort(descending);
    
    // find full edge weight of active edges
    const fullWeight = edges.reduce(
        (full, edge) => full + edge.weight, 0);
    
    edges.forEach(edge => {
        const text = edge.targetID.last();
        const score = edge.weight / fullWeight;

        spawnBubble(text, score)
    });

    /**
     * Creates and appends an bubble element
     * with given text and score to suggestions.
     * @param {string} text suggested next word
     * @param {float} score likelihood of word
     */
    function spawnBubble(text, score) {
        const bubble = document.createElement('span');
        bubble.className = 'bubble';
        
        bubble.dataset.text = text;
        score = score < 0.01 ? '<0.01' : score.toFixed(2);
        bubble.innerHTML = `${text}&nbsp;<span class="score">[${score}]</span>`;

        // helper code for onmouse enter / leave
        const select = (el) => el?.classList.add('selected');
        const unselect = (el) => el?.classList.remove('selected'); 

        // select and unselect bubble with mouse
        bubble.onmouseenter = function () { 
            const bubbles = bubblesHTML.querySelectorAll('.bubble');
            bubbles.forEach(bubble => unselect(bubble)); select(this)
        };
        bubble.onmouseleave = function () { unselect(this); };

        // write bubble text to teaxtarea 
        // and create new suggestions
        bubble.onclick = async function () {
            if (this.disabled) return;
            this.disabled = true;

            // pick random next state if needed
            if (text == '&lt;random&gt;') {
                text = model.nextState(1).ID.last(); 
                await textHTML.writeToken([text]);
                return;
            }
            
            // find overlaping part of next word
            const start = restID.last(); 
            text = text.slice(start.length);

            // only use space when new word
            const useSpace = start.length ? false : true;
            await textHTML.writeToken([text], useSpace);
        };

        return bubblesHTML.appendChild(bubble);
    }
}


// ---------------------------------------------------------------
// ----------------------- MODEL LOAD CODE -----------------------
// ---------------------------------------------------------------

/**
 * Reads a model.json.gz file, decompresses it
 * and parses it into a usable Chain object.
 * @param {string} ID of the model
 * @returns {Chain} ready to use model
 */
async function readModelFile(ID) {
    // read model.json.gz file
    const arrayBuffer = await runAndLogTime(
        () => readFile(ID), 'reading model file');

    // decompress read data
    const text = await runAndLogTime(
        () => decompress(arrayBuffer), 'decompressing data');

    // parse data into json
    const model = await runAndLogTime(
        () => parseJSON(text), 'parsing into json');

    // initialize model
    const chain = await runAndLogTime(
        () => new Chain({ model }), 'initializing model');

    return chain;

    /**
     * Runs a given piece of code and measures its
     * taken time. Outputs given msg to teaxarea.
     * @param {function} code to run (with await)
     * @param {string} msg to log to teaxtarea
     * @returns {any} return value of given code
     */
    async function runAndLogTime(code, msg) {
        // output initial text message
        textHTML.log(`\n> ${msg}`);

        // run code and measure time taken
        const start = performance.now();
        const result = await code();
        const end = performance.now();

        // output time taken and result
        textHTML.log(`\t✅ (${end - start} ms)`);
        return result;
    }

    /**
     * Reads file at ./model/${name}.json.gz.
     * @param {str} ID of the file
     * @returns {ArrayBuffer} content
     */
    async function readFile(ID) {
        const path = `./model/${ID}.json.gz`;
        const response = await fetch(path);
        return response.arrayBuffer();
    }

    /**
     * Checks if given buffer contains gzip data by
     * comparing first 3 bytes (should be 1F 8B 08).
     * @param {int[]} buffer data
     * @returns {boolean} true if gzip
     */
    function isGzip(buffer) {
        const bytes = new Uint8Array(buffer);
        return (
            bytes.length >= 3 &&
            bytes[0] === 0x1f &&
            bytes[1] === 0x8b &&
            bytes[2] === 0x08
        );
    }

    /**
     * Decompresses a given blob.
     * @param {Blob} blob to use
     * @returns {string} content
     */
    function decompress(buffer) {
        if (!isGzip(buffer))
            return new Response(buffer).text();

        const blob = new Blob([buffer]);
        const ds = new DecompressionStream('gzip');

        const decompressedStream = blob.stream().pipeThrough(ds);
        return new Response(decompressedStream).text();
    }

    /**
     * Offloads heavy json parsing to webworker.
     * Returns parsed json (actually promise).
     * @param {string} text to parse
     * @returns {string} parsed json
     */
    function parseJSON(text) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(
                './json-worker.js', { type: 'module' });

            // handle finished worker
            worker.onmessage = (event) => {
                resolve(event.data); worker.terminate();
            };

            // start parsing worker
            worker.onerror = reject;
            worker.postMessage(text);
        });
    }
}

// messages to print when loading models
const MSG = {
    loading: (ID) => `Loading model ${ID}. This may take a while, please standby.`,
    ready: (ID) => `\n> ${ID} ready`,
    greeting: (ID) => `Welcome to model ${ID}. Here are some fun seeds for you to try:${MSG.seed[ID]}`,
    
    // TODO: ADD CORRECT SEED MSG FOR MODELS
    seed: {
        'president3': `\n> America\n> The people\n> I will`,
        'books3': `\n> Why should\n> I shall\n> God will`,
        'reviews3': `\n> The movie\n> I liked\n> I hated`,
        'webtext3': `\n> Electronic\n> The big\n> Original`,
    }
}

// global model access
const MODEL = {};

/**
 * Loads model from file into global MODEL variable.
 * Locks interface during that time and writes msg.
 * @param {string} ID of model
 * @returns {Promise} to wait for
 */
async function loadModel(ID) {
    // lock interface and indicate load
    interfaceHTML.setAttribute('inert', 'true');
    document.body.style.cursor = 'progress';
    
    // clear teaxtarea and log initial msg
    textHTML.clear(); 
    textHTML.log(MSG.loading(ID));

    // actually load the model file
    return readModelFile(ID).then(async model => {
        MODEL[model.ID] = model;
        
        // log load confirmation and wait 1s
        textHTML.log(MSG.ready(ID));
        await time(1000); textHTML.clear(); 

        // unlock interface and remove indicator
        interfaceHTML.removeAttribute('inert');
        document.body.style.cursor = 'auto';

        // write greeting and seed suggestions
        await textHTML.write(MSG.greeting(ID));
    });
}


// ---------------------------------------------------------------
// ------------------------ BUTTON CODE --------------------------
// ---------------------------------------------------------------

let BLOCK_GEN = false;

/**
 * Generates output token in given range from 
 * given seed. Tries to end with '.', '!', '?'.
 * @param {obj} event given by onclick
 * @param {int} length minimum output token
 * @param {int} save maximum output token
 */
async function generate(event, length = 10, save = 50) {
    if (BLOCK_GEN) return; BLOCK_GEN = true;
    generateBTN.classList.toggle('active');

    // grab textarea input and tokenize it
    const input = textHTML.value;
    const seed = tokenizer.split(input);

    // setup model options as choosen by UI
    const depth = contextHTML.value;
    const ender = ['.', '!', '?'];
    const options = { seed, length, depth, ender, save };
    
    // generate output token and write them
    const model = MODEL[modelHTML.value];
    const output = model.generate(options);
    await textHTML.writeToken(output);

    BLOCK_GEN = false;
    generateBTN.classList.toggle('active');
}

generateBTN.onclick = generate;


// ---------------------------------------------------------------
// ---------------------- SHOW TOKEN CODE ------------------------
// ---------------------------------------------------------------

let SHOW_TOKEN = false;
// simply toggle token on each click
tokenBTN.onclick = () => { 
    SHOW_CONTEXT = false;
    contextBTN.classList.remove('active');

    SHOW_TOKEN = !SHOW_TOKEN;
    tokenBTN.classList.toggle('active');

    renderToken();
};

// immediately create new suggestions
// and token marker if new UI input
textHTML.oninput = () => {
    // limit input to abc, ABC, space and newline, and . ! ? >
    const regex = /[^A-Za-z.!?>\s]/g;
    textHTML.value = textHTML.value.replace(regex, '');

    updateModelState(); updateScore();
    renderToken(); renderContext();
}


/**
 * If 'toggle token' button is active renders 
 * all markers of current token in textarea.
 */
function renderToken() {
    // delete markers and return if toggled off
    if(!SHOW_TOKEN) { tokMarkerHTML.innerHTML = ''; return; }
    const token = tokenizer.split(textHTML.value);

    renderAfter(token);
}

/**
 * Marks given token in order starting from given
 * index. Live updates textarea marker layer.
 * @param {string[]} token to mark
 * @param {int} index to start parsing 
 */
async function renderAfter(token, index = 0) {
    tokMarkerHTML.innerHTML = '';

    let color = 0;
    const mark = (tok) =>
        `<span class="mark" data-color=${color++ % 3}>${tok}</span>`;

    // escape special regex characters in tok
    const escape = (tok) => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // keep part before given index untouched
    let html = textHTML.value.slice(0, index);
    let text = textHTML.value.slice(index);

    for (const tok of token) {
        const regex = new RegExp(escape(tok), 'i');
        const search = text.search(regex);

        // replace spaces before token with dots
        const dots = text.slice(0, search)
            .replace(/ /g, '<span class="dot"> </span>');

        // mark token and update text to parse
        html += dots + mark(tok);
        text = text.slice(search + tok.length);

        // live update textarea marker layer
        tokMarkerHTML.innerHTML = html;
        await Promise.resolve();
    }

    // final update is still needed
    tokMarkerHTML.innerHTML = html;
}


// ---------------------------------------------------------------
// --------------------- SHOW CONTEXT CODE -----------------------
// ---------------------------------------------------------------

let SHOW_CONTEXT = false;
// simply toggle context on each click
contextBTN.onclick = () => {
    SHOW_TOKEN = false;
    tokenBTN.classList.remove('active');

    SHOW_CONTEXT = !SHOW_CONTEXT;
    contextBTN.classList.toggle('active');

    renderContext();
}

/**
 * Tokenizes input string and checks from the right
 * for valid model state ID. Offsets to the left until
 * it can find an ID of any depth at that offset. 
 * @param {string} input to parse
 * @returns {obj} { sub, rest }
 */
function getSplit(input) {
    const model = MODEL[modelHTML.value];
    if (!model) return;

    // get initial sub ID candidate
    const token = tokenizer.split(input);
    const maxDepth = contextHTML.value;
    const N = token.length;

    // increase offset and check for each depth level
    for (let offset = 0; offset < N; offset++) {
        for (let depth = maxDepth; depth > 0; depth--) {
            const pos = Math.max(N - depth - offset, 0);
            
            // if found valid sub ID return it
            const subID = token.slice(pos, N - offset);
            const restID = token.slice(N - offset);

            if (model.testState(subID)) return { subID, restID };
        }
    }

    // if loops fail no split ID available
    return { subID: [], restID: [] };
}

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
 * If 'toggle context' button is active renders 
 * all markers of current context token in textarea.
 */
function renderContext() {
    // delete markers and return if toggled off
    if(!SHOW_CONTEXT) { tokMarkerHTML.innerHTML = ''; return; }

    // grab sub and rest ID
    const input = textHTML.value;
    const { subID, restID } = getSplit(input);
    const fullID = [...subID, ...restID];

    // find starting index of sub ID 
    let index;
    for (let offset = 0; offset <= input.length; offset++) {
        const effect = offset || input.length;
        const token = tokenizer.split(input.slice(-effect));

        if (token.equals(fullID)) { 
            index = input.length - effect; break;
        }
    }

    // render sub ID i.e. context
    renderAfter(subID, index);
}


// ---------------------------------------------------------------
// ------------------- SELECT ELEMENT LOGIC ----------------------
// ---------------------------------------------------------------

/**
 * Resizes select elements to hardcoded widths
 * as they don't cooperate well with normal css.
 * @param {obj} target html select object 
 */
function resizeSelect({ target }) {
    const width = {
        'president': 85, 'books': 67, 
        'reviews': 76, 'webtext': 78,
        '1': 43, '2': 68, '3': 47,
    };

    // set hardcoded width to target style
    target.style.width = width[target.value] + 'px';
}

// apply resize on change and load model
modelHTML.onchange = async ({ target }) => {
    resizeSelect({ target });

    // remove suggestion bubbles
    bubblesHTML.innerHTML = '';

    // remove context highlighting
    contextBTN.classList.remove('active');
    SHOW_CONTEXT = false; renderContext();

    // remove token highlighting
    tokenBTN.classList.remove('active');
    SHOW_TOKEN = false; renderToken();

    // load model if still needed
    const ID = target.value;
    if (!MODEL[ID]) await loadModel(ID);
    
    // else show greeting message
    else { 
        textHTML.clear(); 
        await textHTML.write(MSG.greeting(ID));
    }
};

// apply resize on change and show
// context and suggestions if needed
contextHTML.onchange = ({ target }) => {
    resizeSelect({ target });
    renderContext();
    updateModelState();
    updateScore();
}

// initial resize and load on page enter
contextHTML.dispatchEvent(new Event('change'));
modelHTML.dispatchEvent(new Event('change'));


// ---------------------------------------------------------------
// ------------------------ U SCORE LOGIC ------------------------
// ---------------------------------------------------------------

/**
 * Splits interval [min, max] into pieces according
 * to given limits and returns left piece threasholds.
 * @param {float} min lower bound of area
 * @param {float} max upper bound of area
 * @param {float[]} limits percentile (0-1) of areas
 * @returns {float[]} threasholds according to limits
 */
function thresholds({ min, max, limits }) {
    // sort into descending order
    limits.sort((a, b) => b - a);

    const thresholds = [], delta = max - min;
    for (const limit of limits) 
        thresholds.push(min + delta * limit);
    
    return thresholds;
}

/**
 * Wraps a given insert in red, yellow, green color brackets
 * depending on which limit between min, max was crossed.
 * @param {float} min lower bound of area
 * @param {float} max upper bound of area
 * @param {float[3]} limits percentile (0-1) of areas
 * @param {boolean} inverted if true swaps red and green
 * @returns {string} <colorName>insert<colorName>
 */
function wrapLimitColor({ 
    insert, min, max, limits = [0.7, 0.3, 0], inverted = false, extra = '' 
}) {
    const htmlColor = (name, insert) => `<${name}>${insert}</${name}>`;
    const colorNames = inverted ? ['red', 'yellow', 'green'] : ['green', 'yellow', 'red'];
    
    for (let [i, threshold] of thresholds({ min, max, limits }).entries())
        if (insert >= threshold) return htmlColor(colorNames[i], insert + extra);   
}

/**
 * Updates the uniqueness score element.
 * Calculates U_SCORE from textarea input
 * and wraps it in red, yellow, or green.
 */
function updateScore() {
    const model = MODEL[modelHTML.value];
    if (!model) return;

    // get input token and settings
    const token = tokenizer.split(textHTML.value);
    const depth = contextHTML.value;

    // calculate U_SCORE and wrap it
    let U_SCORE = model.U_SCORE(token, depth).toFixed(2);
    U_SCORE = wrapLimitColor({ insert: U_SCORE, min: 0, max: 1 });
    scoreHTML.innerHTML = `<span id="u-score">${U_SCORE || '---'}</span>`;
}
