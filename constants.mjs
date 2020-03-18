import { dirname } from 'path';
import { fileURLToPath } from 'url';

export const __home = (() => dirname(fileURLToPath(import.meta.url)))();
