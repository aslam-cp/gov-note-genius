import { createServer } from 'node:http';
import { toNodeListener } from 'h3-v2';
import { fetch } from './dist/server/server.js';

const port = process.env.PORT || 3000;
const listener = toNodeListener(fetch);

console.log(`Starting production server on port ${port}...`);

createServer(listener).listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
