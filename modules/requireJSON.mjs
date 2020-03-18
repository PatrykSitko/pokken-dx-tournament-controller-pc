import fs from 'fs';
import { __home } from '../constants.mjs';

export default path => JSON.parse(fs.readFileSync(`${__home}/${path}`));
