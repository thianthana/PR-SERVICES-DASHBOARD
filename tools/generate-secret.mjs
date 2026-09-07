import {randomBytes} from 'node:crypto';
// Run locally and paste into Apps Script Properties only; never commit the output.
console.log(randomBytes(32).toString('hex'));
