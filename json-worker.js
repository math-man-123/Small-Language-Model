// parses given text into json
self.onmessage = (event) => {
    const text = event.data;
    const json = JSON.parse(text);
    postMessage(json);
};
