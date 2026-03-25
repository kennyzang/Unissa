import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET ?? 'fallback-secret'
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '4h'

export interface JwtPayload {
  userId: string
  role: string
  username: string
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions)

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, SECRET) as JwtPayload
