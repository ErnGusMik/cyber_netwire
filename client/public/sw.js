self.addEventListener('install', () => {
    console.log('installing sw');
})

self.addEventListener('activate', () => {
    console.log('activating sw');
})

let key = null;

self.onmessage = (event) => {

    if (event.data.type === 'setKey') {
        console.log('setting key');
        key = event.data.key;
        event.source.postMessage({
            type: 'success',
        });
    }

    if (event.data.type === 'decrypt') {
        if (key === null) {
            event.source.postMessage({
                type: 'decryptionError',
                error: 'No key set',
            });
            return;
        }

        const ciphertext = event.data.ciphertext;
        console.log(ciphertext);
        crypto.subtle.decrypt(
            {
                name: 'RSA-OAEP',

            },
            key,
            ciphertext
        ).then(decrypted=> {
            event.source.postMessage({
                status: 'success',
                plaintext: new TextDecoder().decode(decrypted),
            });
        })
        .catch(error => {
            event.source.postMessage({
                status: 'decryptionError',
                error: error,
            });
        })

    }
}