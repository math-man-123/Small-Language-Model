// THIS FILE MUST BE RUN IN NODE.JS
import { Tokenizer } from './tokenizer.js';
import { Chain } from './markov.js';
import fs from 'fs';


// create tokenizer to use
const tokenizer = new Tokenizer();


/**
 * Crawls entire folder given by its path
 * and tokenizes every textfile it can find.
 * @param {Tokenizer} tokenizer 
 * @param {string} path data folder
 * @returns {string[]} tokenized data
 */
function crawlInputData(tokenizer, path = './data') {
    const start = performance.now();
    console.log(`\n>> entering ${path}`);

    const token = [], folder = fs.readdirSync(path);
    for (const entry of folder) {
        // if textfile open it and read its token
        if (entry.endsWith('.txt')) {
            console.log(`reading token from ${path}/${entry}`);
            const data = fs.readFileSync(`${path}/${entry}`, 'utf-8');

            // push each element on its own as using
            // push(...newToken) hits size limits
            const newToken = tokenizer.split(data);
            newToken.forEach((tok) => token.push(tok));
        }

        // if folder open it and crawl its content
        else {
            const newToken = crawlInputData(tokenizer, `${path}/${entry}`);
            newToken.forEach((tok) => token.push(tok));
        }
    }

    const end = performance.now();
    console.log(`${path} took ${(end - start).toFixed()} ms`);
    return token;
}


/**
 * Trains and saves a markov chain model.
 * @param {string} name of the model
 * @param {string[]} token training data 
 * @param {int} depth maximum training depth
 */
function createModel(name, token, depth = 1) {
    const start = performance.now();
    console.log(`\n>> starting training (${token.length} token)`);

    const chain = new Chain({ name, token, depth });
    const end = performance.now();
    console.log(`training took ${(end - start).toFixed()} ms`);

    chain.saveModel();
}
