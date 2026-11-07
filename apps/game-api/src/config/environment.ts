import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min, validateSync } from 'class-validator';
class Environment {
 @IsIn(['development','test','production']) NODE_ENV = 'development';
 @IsString() @IsNotEmpty() DATABASE_URL!: string;
 @IsString() @IsNotEmpty() CORS_ORIGINS!: string;
 @IsInt() @Min(1) @Max(65535) PORT!: number;
}
export function environment() {
 const config = plainToInstance(Environment, { NODE_ENV: process.env.NODE_ENV ?? 'development', DATABASE_URL: process.env.GAME_DATABASE_URL, CORS_ORIGINS: process.env.CORS_ORIGINS, PORT: Number(process.env.GAME_PORT ?? 3002) });
 if (validateSync(config).length) throw new Error('Invalid environment: check NODE_ENV, database URL, CORS_ORIGINS and service port');
 if (!process.env.JWT_ISSUER || !process.env.JWT_AUDIENCE || !process.env.JWT_KEY_ID || !/^[a-zA-Z0-9_-]{1,100}$/.test(process.env.JWT_KEY_ID)) throw new Error('JWT issuer, audience and safe key ID are required');
 const issuer = new URL(process.env.JWT_ISSUER);
 if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.hash) throw new Error('JWT issuer must be a stable HTTPS identifier');
 const url = new URL(config.DATABASE_URL);
 if (!['postgres:','postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL URL required');
 if (config.CORS_ORIGINS.split(',').some(origin => { try { const u = new URL(origin); return !['http:','https:'].includes(u.protocol) || u.origin !== origin; } catch { return true; } })) throw new Error('CORS_ORIGINS requires exact HTTP origins');
 if (!url.username || !url.password || url.pathname !== '/nexquiz_game') throw new Error('Expected dedicated database and credentials');
 if (config.NODE_ENV === 'production' && (config.DATABASE_URL.includes('CHANGE_') || config.CORS_ORIGINS.split(',').some(origin => !origin.startsWith('https://')))) throw new Error('Production requires secure credentials and HTTPS origins');
 return config;
}
