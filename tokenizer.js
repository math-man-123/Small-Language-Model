/** @class  */
export class Tokenizer {
    /**
     * Creates a Tokenizer instance with given
     * seperator and special characters saved.
     * @param {string[]} seperator splits input at these
     * @param {string[]} special char treated as token
     */
    constructor({ 
        separator = [' ', '\n', '\r'], 
        special = ['.', '!', '?'], 
        // TODO: change this to whitelist
        ignore = [',', ':', ';', '-', '—', '_', '“', '”', '"', "'", '(', ')', '[', ']', '*'] 
    } = {}) { 
        Object.assign(this, { separator, special, ignore });
    }

    /**
     * Tokenizes given input string into units seperated
     * by any char in this.seperator as well as into
     * special tokens consisting of char in this.sepcial.
     * @param {string} input training data
     * @returns {string[]} token list
     */
    split(input) {
        const { separator, special, ignore } = this;
        input = input.trim().toLowerCase();
        input += separator[0]; // include last

        // pushes current token then resets it
        const output = []; let token = '';
        const flush = (str) => {
            if (!str.length) return;
            output.push(str); token = '';
        };

        // builds up token and checks when to flush
        for (const char of input) {
            // skip over chars in ignore
            const ignoChar = ignore.includes(char);
            if (ignoChar) continue;

            // check for full words and special chars
            const fullWord = separator.includes(char);
            const specChar = special.includes(char);

            // special characters form token on their own
            if (fullWord || specChar) flush(token);
            if (specChar) flush(char);
            
            if (!fullWord && !specChar) token += char;
        }

        return output;
    }
}
