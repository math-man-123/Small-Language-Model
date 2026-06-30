# Introduction
This project provides a fully from scratch implementation of a "small" language model. It is based on Markov chains and has a context window of up to 3 tokens, producing locally coherent but globally ridiculous outputs. Covers tokenization, training, generating, and efficient lookups using hashmaps. A [full write-up](https://philsfun.com/SLM/index.html) as well as a live demo are on my website.

<p align="center">
<img width="500" alt="example" src="https://github.com/user-attachments/assets/49ed87b5-2f1a-4194-bb50-82834b376043" />
</p>

# Overview
First, given training data is divided into sequences of tokens (e.g. words or parts of them). Next, for each subsequence of the desired context length + 1 the corresponding transition probability [token-2,token-1] -> [token+0] is updated. Once this is done, each sub-sequence of tokens with up to context length gives a probability distribution over all possible next tokens. To generate the next output token, simply pull from that distribution (i.e. walk along the Markov chain).

# Features
Lets you train your own Markov chain based language models provided any training data. Live demo contains 4 different models trained on vastly different types of data. It also allows viewing the distribution over all possible next tokens, as well as the current context and tokenized text.
