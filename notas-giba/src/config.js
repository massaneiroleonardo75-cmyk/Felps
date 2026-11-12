import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  raiz,
  dataDir: env.DATA_DIR || join(raiz, 'data'),
  get dbPath() {
    return env.DB_PATH || join(this.dataDir, 'giba.db');
  },
  get uploadsDir() {
    return join(this.dataDir, 'notas');
  },
  senha: env.APP_PASSWORD || '',
  segredoSessao: env.SESSION_SECRET || '',
  ia: {
    habilitada: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
    modelo: env.CLAUDE_MODEL || 'claude-opus-5-5',
  },
};
