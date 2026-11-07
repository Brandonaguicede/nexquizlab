import { Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { GetIdentity } from '../application/get-identity';
import { RsaIdentityVerifier } from '../infrastructure/rsa-identity-verifier';
import { IdentityController, IdentityGuard, TeacherGuard } from '../presentation/identity.controller';
@Module({ exports: [IdentityGuard, TeacherGuard, GetIdentity], controllers: [IdentityController], providers: [TeacherGuard, IdentityGuard, { provide: GetIdentity, useFactory: () => new GetIdentity(new RsaIdentityVerifier({ issuer: process.env.JWT_ISSUER || 'https://auth.nexquiz.example', audience: process.env.JWT_AUDIENCE || 'nexquiz-game-api', keyId: process.env.JWT_KEY_ID || 'nexquiz-key-1', publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || resolve(__dirname, '../../../../secrets/jwt-public.pem') })) }] })
export class IdentityModule {}
