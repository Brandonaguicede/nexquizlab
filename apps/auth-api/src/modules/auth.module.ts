import { Module } from '@nestjs/common';
import { Authentication } from '../application/authentication';
import { ACCESS_TOKENS, AccessTokens, IDENTITY_REPOSITORY, IdentityRepository, PASSWORD_HASHER, PasswordHasher, TRAFFIC_GATE, TrafficGate } from '../application/identity.ports';
import { PrismaService } from '../infrastructure/prisma.service';
import { PrismaIdentityRepository, PrismaTrafficGate } from '../infrastructure/identity.repository';
import { RandomSessionSecrets, ScryptPasswords } from '../infrastructure/passwords';
import { RsaAccessTokens, tokenConfiguration } from '../infrastructure/access-tokens';
import { AuthController, JwksController } from '../presentation/auth.controller';
import { AccessGuard, SessionMutationGuard } from '../presentation/auth.guards';
@Module({ controllers: [AuthController, JwksController], providers: [PrismaService, AccessGuard, SessionMutationGuard,
 { provide: IDENTITY_REPOSITORY, useFactory: (db: PrismaService) => new PrismaIdentityRepository(db), inject: [PrismaService] },
 { provide: TRAFFIC_GATE, useFactory: (db: PrismaService) => new PrismaTrafficGate(db), inject: [PrismaService] },
 { provide: PASSWORD_HASHER, useClass: ScryptPasswords },
 { provide: ACCESS_TOKENS, useFactory: () => new RsaAccessTokens(tokenConfiguration()) },
 { provide: Authentication, useFactory: (repo: IdentityRepository, passwords: PasswordHasher, tokens: AccessTokens, traffic: TrafficGate) => new Authentication(repo, passwords, tokens, new RandomSessionSecrets(), traffic), inject: [IDENTITY_REPOSITORY, PASSWORD_HASHER, ACCESS_TOKENS, TRAFFIC_GATE] },
] })
export class AuthModule {}
