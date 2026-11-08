import { Body, Controller, Get, Header, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response, CookieOptions } from 'express';
import { Authentication } from '../application/authentication';
import { ACCESS_TOKENS, AccessTokens } from '../application/identity.ports';
import { AuthErrorDto, LoginDto, ProfileDto, RegisterDto, SessionDto } from './auth.dto';
import { AccessGuard, bearer, SessionMutationGuard } from './auth.guards';
function cookieName() { return process.env.NODE_ENV === 'production' ? '__Host-nexquiz_refresh' : 'nexquiz_refresh'; }
function cookieOptions(): CookieOptions { return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' }; }
function refreshCookie(req: Request) {
 const values = (req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(cookieName()+'='));
 return values.length === 1 ? values[0]!.slice(cookieName().length + 1) : '';
}
@ApiTags('Authentication')
@ApiResponse({ status: 400, description: 'Invalid input', type: AuthErrorDto })
@ApiResponse({ status: 413, description: 'JSON body exceeds 16 KB', type: AuthErrorDto })
@ApiResponse({ status: 401, description: 'Invalid credentials, expired or revoked session', type: AuthErrorDto })
@ApiResponse({ status: 403, description: 'Missing CSRF header or untrusted Origin', type: AuthErrorDto })
@ApiResponse({ status: 429, description: 'Too many attempts; Retry-After in seconds', type: AuthErrorDto })
@ApiResponse({ status: 503, description: 'Password processing capacity exhausted', type: AuthErrorDto })
@ApiResponse({ status: 500, description: 'Internal server error', type: AuthErrorDto })
@Controller('auth')
export class AuthController {
 constructor(private readonly auth: Authentication) {}
 private sendSession(result: Awaited<ReturnType<Authentication['login']>>, res: Response) {
  const { refreshToken, refreshExpiresAt, ...body } = result;
  res.cookie(cookieName(), refreshToken, { ...cookieOptions(), expires: refreshExpiresAt });
  res.setHeader('Cache-Control', 'no-store');
  return body;
 }
 @Post('register') @UseGuards(SessionMutationGuard)
 @ApiHeader({ name: 'X-NexQuiz-CSRF', required: true, schema: { type: 'string', enum: ['1'] } })
 @ApiOperation({ summary: 'Register and start a seven-day session', description: 'Sets an HttpOnly refresh cookie. Access token expires in 300 seconds. Passwords are never returned.' })
 @ApiResponse({ status: 201, type: SessionDto }) @ApiResponse({ status: 409, description: 'Email already registered', type: AuthErrorDto })
 async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) { return this.sendSession(await this.auth.register(dto), res); }
 @Post('login') @HttpCode(200) @UseGuards(SessionMutationGuard)
 @ApiHeader({ name: 'X-NexQuiz-CSRF', required: true, schema: { type: 'string', enum: ['1'] } })
 @ApiOperation({ summary: 'Login with email and password' }) @ApiResponse({ status: 200, type: SessionDto })
 async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) { return this.sendSession(await this.auth.login(dto), res); }
 @Post('refresh') @HttpCode(200) @UseGuards(SessionMutationGuard)
 @ApiHeader({ name: 'X-NexQuiz-CSRF', required: true, schema: { type: 'string', enum: ['1'] } })
 @ApiOperation({ summary: 'Rotate the HttpOnly refresh cookie', description: 'Absolute session lifetime: seven days. Reusing a consumed token revokes its session. Do not retry refresh after an uncertain response.' })
 @ApiResponse({ status: 200, type: SessionDto })
 async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  try { return this.sendSession(await this.auth.refresh(refreshCookie(req)), res); }
  catch (error) { res.clearCookie(cookieName(), cookieOptions()); throw error; }
 }
 @Get('profile') @UseGuards(AccessGuard) @Header('Cache-Control', 'no-store') @ApiBearerAuth()
 @ApiOperation({ summary: 'Read the authenticated user profile', description: 'Requires a valid JWT and a non-revoked Auth session.' }) @ApiResponse({ status: 200, type: ProfileDto })
 profile(@Req() req: Request) { return this.auth.profile(bearer(req)); }
 @Post('logout') @HttpCode(204) @UseGuards(SessionMutationGuard)
 @ApiHeader({ name: 'X-NexQuiz-CSRF', required: true, schema: { type: 'string', enum: ['1'] } })
 @ApiOperation({ summary: 'Revoke the current refresh session', description: 'Idempotent. Clears the cookie and prevents refresh and Auth profile. Already issued Game access tokens may remain valid for up to 300 seconds.' })
 @ApiResponse({ status: 204, description: 'Session revoked; refresh cookie cleared' })
 async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { await this.auth.logout(refreshCookie(req)); res.clearCookie(cookieName(), cookieOptions()); res.setHeader('Cache-Control','no-store'); }
}
@ApiTags('Public keys')
@Controller('.well-known')
export class JwksController {
 constructor(@Inject(ACCESS_TOKENS) private readonly tokens: AccessTokens) {}
 @Get('jwks.json') @Header('Cache-Control', 'public, max-age=300')
 @ApiOperation({ summary: 'Public RSA signing key (never private key material)', description: 'Provision public keys to Game explicitly during rotation; this endpoint does not enable arbitrary remote key discovery.' })
 @ApiResponse({ status: 200, schema: { type: 'object', properties: { keys: { type: 'array', items: { type: 'object', properties: { kty: { type: 'string' }, kid: { type: 'string' }, n: { type: 'string' }, e: { type: 'string' }, alg: { type: 'string' }, use: { type: 'string' } } } } } } })
 keys() { return this.tokens.jwks(); }
}
