import { ExecutionContext } from '@nestjs/common';
import { TeacherGuard } from '../src/presentation/identity.controller';
import { SessionController } from '../src/presentation/session.controller';
import { ManageSessions } from '../src/application/manage-sessions';
import { PlaySessions } from '../src/application/play-sessions';
describe('Account role authorization', () => {
 const context = (role?: string) => ({ switchToHttp: () => ({ getRequest: () => ({ identity: { role } }) }) }) as ExecutionContext;
 it('allows teachers and rejects students and tokens without a role', () => {
  const guard = new TeacherGuard();
  expect(guard.canActivate(context('TEACHER'))).toBe(true);
  for (const role of ['STUDENT', undefined]) expect(() => guard.canActivate(context(role))).toThrow();
 });
 it('rejects a teacher joining without creating participation', () => {
  const play = { join: jest.fn() };
  const controller = new SessionController({} as ManageSessions, play as unknown as PlaySessions);
  const req = { identity: { userId: 'teacher', role: 'TEACHER' } } as Parameters<SessionController['join']>[0];
  expect(() => controller.join(req, { code: 'ABC234' })).toThrow();
  expect(play.join).not.toHaveBeenCalled();
 });
 it('allows a student to join with the authenticated name', () => {
  const play = { join: jest.fn().mockReturnValue('joined') };
  const controller = new SessionController({} as ManageSessions, play as unknown as PlaySessions);
  const req = { identity: { userId: 'student', name: 'Ana', role: 'STUDENT' } } as Parameters<SessionController['join']>[0];
  expect(controller.join(req, { code: 'ABC234' })).toBe('joined');
  expect(play.join).toHaveBeenCalledWith('ABC234', 'student', 'Ana');
 });
});
