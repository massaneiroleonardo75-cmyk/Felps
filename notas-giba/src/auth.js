import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

const COOKIE = 'giba_sessao';
const DIAS = 60;
const segredo = () => config.segredoSessao || `giba:${config.senha}`;
const assinar = (texto) => createHmac('sha256', segredo()).update(texto).digest('base64url');

export const protegido = () => Boolean(config.senha);

function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function senhaCorreta(senha) {
  return protegido() && iguais(senha, config.senha);
}

function lerCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function logado(req) {
  if (!protegido()) return true;
  const v = lerCookie(req);
  if (!v) return false;
  const [exp, nonce, ass] = v.split('.');
  if (!exp || !nonce || !ass || Number(exp) < Date.now()) return false;
  return iguais(ass, assinar(`${exp}.${nonce}`));
}

export function criarSessao(req, res) {
  const exp = Date.now() + DIAS * 864e5;
  const nonce = randomBytes(9).toString('base64url');
  const valor = `${exp}.${nonce}.${assinar(`${exp}.${nonce}`)}`;
  res.cookie(COOKIE, valor, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: DIAS * 864e5, path: '/' });
}

export function encerrarSessao(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function exigirLogin(req, res, next) {
  if (logado(req)) return next();
  res.status(401).json({ erro: 'Faça login para continuar.' });
}
