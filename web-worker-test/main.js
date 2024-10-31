// main.js

// Function to create a worker and handle communication
function runWorker(workerScript, workerData) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerScript);

        worker.onmessage = function(event) {
            if (event.data.error) {
                reject(event.data.error);
            } else {
                resolve(event.data.result);
            }
            worker.terminate();
        };

        worker.onerror = function(error) {
            reject(error.message);
            worker.terminate();
        };

        worker.postMessage(workerData);
    });
}

// Example usage for nyaa_html_finder
async function testWorker() {
    try {
        const nyaaResult = await runWorker('nyaa_worker.js', {
            functionName: 'nyaa_html_finder',
            query: 'One+Piece',
            set_title: 'One Piece',
            season_number: 1,
            episode_number: 1,
            dub: false
        });
        console.log('Nyaa Results:', nyaaResult);

        displayResults(nyaaResult);

        /*
        // Similarly, you can call other workers
        const animeDexResult = await runWorker('anime_dex_worker.js', {
            functionName: 'anime_dex_finder',
            query: 'One%20Piece',
            set_title: 'One Piece',
            season_number: 1,
            episode_number: 1,
            dub: false
        });
        console.log('AnimeDex Results:', animeDexResult);

        // And so on for seadex_finder and hikaritv_anime_extract */

    } catch (error) {
        console.error('Error:', error);
    }
}

function displayResults(results) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.textContent = JSON.stringify(results, null, 2);
}

testWorker();
