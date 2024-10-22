import { loadPyodide } from 'pyodide';

async function main() {
  try {
    // Load Pyodide
    const pyodide = await loadPyodide();

    // Load 'micropip' module
    await pyodide.loadPackage('micropip');

    // Install 'guessit' and its dependencies via micropip
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(['guessit'])
`);

    // Define the input string
    const inputString = "ONE PIECE DVD HDTV EPISODES (1~395) MOVIE SPECIAL";

    // Set the input string in the Python environment
    pyodide.globals.set('input_string', inputString);

    // Run Python code to parse the input string using guessit
    const result = await pyodide.runPythonAsync(`
from guessit import guessit
import json

guess_result = guessit(input_string)
json.dumps(guess_result)
`);

    // Parse the JSON result back into JavaScript
    const parsedResult = JSON.parse(result);

    console.log('Parsed Result:', parsedResult);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();
